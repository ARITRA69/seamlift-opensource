import path from "node:path";
import { SeamtranscodeError } from "./errors";
import {
  fileArg,
  INPUT_GUARD,
  resolveTools,
  run,
  type FfmpegOptions,
  type Tools,
} from "./ffmpeg";

export type ProbeResult = {
  /** ffprobe's container name, e.g. "mov,mp4,m4a,3gp,3g2,mj2" */
  container: string;
  /** seconds */
  duration: number | null;
  /** as displayed: phone videos' rotation is already applied */
  width: number | null;
  height: number | null;
  /** degrees clockwise the stored frames are turned for display */
  rotation: 0 | 90 | 180 | 270;
  codec: string | null;
  /** bits per second, the whole file */
  bitrate: number | null;
  fps: number | null;
  audio: {
    codec: string | null;
    channels: number | null;
    sampleRate: number | null;
  } | null;
  /** HDR (PQ or HLG). Outputs are SDR, converted without tone mapping. */
  hdr: boolean;
};

// Containers a real video upload comes in. Anything else (hls, concat,
// image2, tty, ...) is refused before ffmpeg decodes a frame of it.
const VIDEO_CONTAINERS = new Set([
  "mov",
  "mp4",
  "m4a",
  "3gp",
  "3g2",
  "mj2",
  "matroska",
  "webm",
  "avi",
  "mpegts",
  "mxf",
  "flv",
  "mpeg",
  "ogg",
  "asf",
  "dv",
]);

export const isVideoContainer = (formatName: string | undefined) =>
  !!formatName &&
  formatName.split(",").every((f) => VIDEO_CONTAINERS.has(f.trim()));

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "tif",
  "tiff",
  "bmp",
  "svg",
  "avif",
]);

// ffprobe rates are rationals ("30000/1001"). avg_frame_rate is the real
// average; r_frame_rate is a nominal base that can be wildly high for
// variable-rate sources, so it's only a fallback.
const parseRate = (value?: string): number | null => {
  if (!value) return null;
  const [num, den] = value.split("/").map(Number);
  if (!num || !Number.isFinite(num)) return null;
  const fps = den && Number.isFinite(den) ? num / den : num;
  return fps > 0 && fps < 1000 ? Math.round(fps * 1000) / 1000 : null;
};

const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

type RawStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  channels?: number;
  sample_rate?: string;
  color_transfer?: string;
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
  disposition?: { attached_pic?: number };
};

type RawProbe = {
  streams?: RawStream[];
  format?: { duration?: string; bit_rate?: string; format_name?: string };
};

const rawProbe = async (tools: Tools, file: string, signal?: AbortSignal) => {
  const out = await run(
    tools.ffprobe,
    [
      ...INPUT_GUARD,
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      fileArg(file),
    ],
    signal ? { signal } : {}
  ).catch((err: unknown) => {
    if (err instanceof SeamtranscodeError && err.kind === "ffmpeg_failed") {
      throw new SeamtranscodeError(
        "unsupported_input",
        "Not a video file we can read",
        err.log === undefined ? { cause: err } : { log: err.log, cause: err }
      );
    }
    throw err;
  });
  return JSON.parse(out) as RawProbe;
};

const rotationOf = (stream: RawStream): ProbeResult["rotation"] => {
  const raw =
    stream.side_data_list?.find((d) => typeof d.rotation === "number")
      ?.rotation ?? Number(stream.tags?.rotate ?? 0);
  const turned = (((Math.round(raw / 90) * 90) % 360) + 360) % 360;
  return turned as ProbeResult["rotation"];
};

/**
 * Read a video's size, length, frame rate and streams. Refuses anything that
 * isn't a real video container, before decoding a frame of it.
 */
export const probe = async (
  file: string,
  options: FfmpegOptions & { signal?: AbortSignal } = {}
): Promise<ProbeResult> => {
  const tools = resolveTools(options);
  const json = await rawProbe(tools, file, options.signal);
  const container = json.format?.format_name ?? "";
  if (!isVideoContainer(container)) {
    throw new SeamtranscodeError(
      "unsupported_input",
      `Not a video file we can read (container: ${container || "unknown"})`
    );
  }

  // Cover art in an mp4 is a "video" stream too; skip it.
  const video = json.streams?.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic
  );
  const audio = json.streams?.find((s) => s.codec_type === "audio");
  const rotation = video ? rotationOf(video) : 0;
  const sideways = rotation === 90 || rotation === 270;
  const codedWidth = video?.width ?? null;
  const codedHeight = video?.height ?? null;

  return {
    container,
    duration: positive(json.format?.duration),
    width: sideways ? codedHeight : codedWidth,
    height: sideways ? codedWidth : codedHeight,
    rotation,
    codec: video?.codec_name ?? null,
    bitrate: positive(json.format?.bit_rate),
    fps: parseRate(video?.avg_frame_rate) ?? parseRate(video?.r_frame_rate),
    audio: audio
      ? {
          codec: audio.codec_name ?? null,
          channels: audio.channels ?? null,
          sampleRate: positive(audio.sample_rate),
        }
      : null,
    hdr:
      video?.color_transfer === "smpte2084" ||
      video?.color_transfer === "arib-std-b67",
  };
};

/**
 * "image" or "video": by extension first, then by what ffprobe makes of it.
 * Anything unreadable comes back "video", and probe then refuses it.
 */
export const detectKind = async (
  file: string,
  name: string,
  tools: Tools,
  signal?: AbortSignal
): Promise<"video" | "image"> => {
  const ext = path.extname(name).slice(1).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  try {
    const json = await rawProbe(tools, file, signal);
    const format = json.format?.format_name ?? "";
    if (/(^|,)(image2|[a-z0-9]+_pipe|svg)(,|$)/.test(format)) return "image";
  } catch {
    // probe() reports it properly
  }
  return "video";
};
