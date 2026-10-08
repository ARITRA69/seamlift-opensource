import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileArg, INPUT_GUARD, run, type Tools } from "./ffmpeg";

export type MediaPlaylistStats = {
  /** peak bits per second over the segments: the playlist's BANDWIDTH */
  bandwidth: number;
  /** bits per second over the whole rendition */
  averageBandwidth: number;
  segments: string[];
  duration: number;
};

/** Parse a media playlist and measure the bitrate its segments really have. */
export const measureMediaPlaylist = async (
  playlist: string,
  segmentSecs: number
): Promise<MediaPlaylistStats> => {
  const dir = path.dirname(playlist);
  const lines = (await readFile(playlist, "utf8")).split(/\r?\n/);
  const entries: { file: string; duration: number }[] = [];
  let pending: number | null = null;
  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      pending = parseFloat(line.slice(8));
    } else if (line && !line.startsWith("#") && pending !== null) {
      entries.push({ file: line.trim(), duration: pending });
      pending = null;
    }
  }
  const sized = await Promise.all(
    entries.map(async (e) => ({
      ...e,
      bytes: (await stat(path.join(dir, e.file))).size,
    }))
  );
  const totalBytes = sized.reduce((sum, s) => sum + s.bytes, 0);
  const duration = sized.reduce((sum, s) => sum + s.duration, 0);
  // A short tail segment opens on a keyframe and reads as a spike: leave it
  // out of the peak unless it's all there is.
  const full = sized.filter((s) => s.duration >= segmentSecs / 2);
  const peakOf = full.length ? full : sized;
  const peak = Math.max(
    0,
    ...peakOf.map((s) => (s.duration > 0 ? (s.bytes * 8) / s.duration : 0))
  );
  return {
    bandwidth: Math.ceil(peak),
    averageBandwidth: duration > 0 ? Math.ceil((totalBytes * 8) / duration) : 0,
    segments: entries.map((e) => e.file),
    duration,
  };
};

const AVC_PROFILES: Record<string, string> = {
  Baseline: "4200",
  "Constrained Baseline": "42E0",
  Main: "4D40",
  High: "6400",
};

/** The CODECS attribute for a segment, e.g. "avc1.64001f,mp4a.40.2". */
export const segmentCodecs = async (
  tools: Tools,
  segment: string
): Promise<string | null> => {
  try {
    const out = await run(tools.ffprobe, [
      ...INPUT_GUARD,
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,profile,level",
      "-of",
      "json",
      fileArg(segment),
    ]);
    const streams =
      (
        JSON.parse(out) as {
          streams?: {
            codec_type?: string;
            codec_name?: string;
            profile?: string;
            level?: number;
          }[];
        }
      ).streams ?? [];
    const codecs: string[] = [];
    const video = streams.find((s) => s.codec_type === "video");
    if (video?.codec_name !== "h264") return null;
    const profile = AVC_PROFILES[video.profile ?? ""];
    if (!profile || !video.level || video.level < 0) return null;
    codecs.push(
      `avc1.${profile}${video.level.toString(16).padStart(2, "0")}`.toLowerCase()
    );
    const audio = streams.find((s) => s.codec_type === "audio");
    if (audio?.codec_name === "aac") codecs.push("mp4a.40.2");
    return codecs.join(",");
  } catch {
    return null;
  }
};

export type MasterEntry = {
  name: string;
  width: number;
  height: number;
  bandwidth: number;
  averageBandwidth: number;
  codecs: string | null;
};

export const buildMasterPlaylist = (
  renditions: readonly MasterEntry[],
  fps: number | null
) => {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-INDEPENDENT-SEGMENTS"];
  for (const r of renditions) {
    const attrs = [
      `BANDWIDTH=${r.bandwidth}`,
      `AVERAGE-BANDWIDTH=${r.averageBandwidth}`,
      `RESOLUTION=${r.width}x${r.height}`,
    ];
    if (fps) attrs.push(`FRAME-RATE=${Math.min(fps, 60).toFixed(3)}`);
    if (r.codecs) attrs.push(`CODECS="${r.codecs}"`);
    lines.push(`#EXT-X-STREAM-INF:${attrs.join(",")}`, `${r.name}/index.m3u8`);
  }
  return lines.join("\n") + "\n";
};
