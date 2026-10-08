import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  encoderArgs,
  pixelFormat,
  resolveEncoder,
  type EncoderChoice,
  type EncoderSettings,
} from "./encoders";
import { SeamtranscodeError, throwIfAborted } from "./errors";
import {
  fileArg,
  INPUT_GUARD,
  resolveTools,
  run,
  type FfmpegOptions,
} from "./ffmpeg";
import {
  buildMasterPlaylist,
  measureMediaPlaylist,
  segmentCodecs,
} from "./hls";
import {
  DEFAULT_RENDITIONS,
  planLadder,
  type PlannedRendition,
  type RenditionInput,
} from "./ladder";
import {
  makeLocalPreviews,
  resolveSpec,
  uploadPreviews,
  type PreviewSizes,
  type Previews,
} from "./previews";
import { probe, type ProbeResult } from "./probe";
import { joinKey, type Storage } from "./storage/types";
import {
  defaultStorage,
  exists,
  fetchInput,
  makeWorkDir,
  outputFile,
  putDir,
  putFile,
  type Input,
  type OutputFile,
} from "./work";

/**
 * Everything decided before encoding: plain JSON, so it can go through a
 * queue or a function call to another machine. Every machine encodes with
 * the same keyframe times from it, so sizes made on different machines
 * still line up into one stream.
 */
export type TranscodePlan = {
  version: 1;
  input: Input;
  output: string;
  source: ProbeResult;
  renditions: PlannedRendition[];
  encoder: EncoderChoice;
  encoderSettings: EncoderSettings;
  /** seconds per HLS segment */
  segmentDuration: number;
  /**
   * A local copy of the source shared by the machines (a Modal Volume, an
   * NFS mount). encodeRendition() reads it instead of fetching the input.
   */
  sourceCache?: string;
  cacheControl?: string;
};

export type RenditionResult = {
  name: string;
  width: number;
  height: number;
  playlist: OutputFile;
  /** peak bits per second over the segments */
  bandwidth: number;
  averageBandwidth: number;
  codecs: string | null;
  segments: number;
  /** the encoder that made it */
  encoder: string;
};

export type TranscodeResult = {
  /** master.m3u8: give this to the player */
  playlist: OutputFile;
  renditions: RenditionResult[];
  previews: Previews | null;
  source: ProbeResult;
  /** things that went wrong without stopping the job */
  warnings: string[];
};

export type TranscodeProgress = {
  stage: "downloading" | "analyzing" | "encoding" | "finishing";
  /** 0 → 1 over the whole job */
  progress: number;
  /** seconds left, once there's enough to estimate */
  eta: number | null;
  /** the rendition being encoded, and how far through it (0 → 1) */
  rendition?: string;
  renditionProgress?: number;
};

type CommonOptions = FfmpegOptions & {
  /** default: files on this machine */
  storage?: Storage;
  signal?: AbortSignal;
  /** where temporary files go; default the OS temp folder */
  workDir?: string;
};

export type PlanOptions = CommonOptions & {
  input: Input;
  /** key prefix (a folder, for local storage) everything is written to */
  output: string;
  /** short sides to make; default [360, 720, 1080], never above the source */
  renditions?: readonly RenditionInput[];
  /**
   * default "libx264". "auto" picks a working hardware encoder on the machine
   * that encodes: VideoToolbox on Macs, NVENC, Quick Sync.
   */
  encoder?: EncoderChoice;
  /** libx264 preset; default "fast" */
  preset?: string;
  /** seconds per HLS segment; default 6 */
  segmentDuration?: number;
  /** see TranscodePlan.sourceCache: the input is downloaded here */
  sourceCache?: string;
  /** Cache-Control for everything uploaded */
  cacheControl?: string;
};

const nonNull = <T>(value: T | undefined, key: string) =>
  value === undefined ? {} : { [key]: value };

const plannedSource = async (
  input: Input,
  storage: Storage,
  options: CommonOptions & { sourceCache?: string }
) => {
  if (typeof input === "string") return { file: path.resolve(input) };
  if (options.sourceCache) {
    if (!(await exists(options.sourceCache))) {
      await mkdir(path.dirname(options.sourceCache), { recursive: true });
      await fetchInput(input, storage, options.sourceCache, options.signal);
    }
    return { file: options.sourceCache };
  }
  const work = await makeWorkDir(options.workDir);
  const file = await fetchInput(
    input,
    storage,
    path.join(work, "source"),
    options.signal
  );
  return { file, cleanup: () => rm(work, { recursive: true, force: true }) };
};

/**
 * Step 1 of 3: read the source and decide what to make. Fast; the source is
 * downloaded once to read it (into `sourceCache`, when given).
 */
export const planTranscode = async (
  options: PlanOptions
): Promise<TranscodePlan> => {
  const storage = options.storage ?? defaultStorage();
  const segmentDuration = options.segmentDuration ?? 6;
  if (!(segmentDuration >= 1 && segmentDuration <= 30)) {
    throw new SeamtranscodeError(
      "invalid_options",
      "segmentDuration must be between 1 and 30 seconds"
    );
  }
  const source = await plannedSource(options.input, storage, options);
  try {
    const meta = await probe(source.file, {
      ...nonNull(options.ffmpegPath, "ffmpegPath"),
      ...nonNull(options.ffprobePath, "ffprobePath"),
      ...nonNull(options.signal, "signal"),
    });
    return {
      version: 1,
      input: options.input,
      output: options.output,
      source: meta,
      renditions: planLadder(meta, options.renditions ?? DEFAULT_RENDITIONS),
      encoder: options.encoder ?? "libx264",
      encoderSettings: options.preset ? { preset: options.preset } : {},
      segmentDuration,
      ...nonNull(options.sourceCache, "sourceCache"),
      ...nonNull(options.cacheControl, "cacheControl"),
    };
  } finally {
    await source.cleanup?.().catch(() => {});
  }
};

export type EncodeOptions = CommonOptions & {
  /** 0 → 1 for this rendition, with seconds left once known */
  onProgress?: (progress: number, eta: number | null) => void;
  /** a local copy of the source, so it isn't fetched again */
  source?: string;
};

const findRendition = (plan: TranscodePlan, name: string | number) => {
  const wanted = typeof name === "number" ? `${name}p` : name;
  const rendition = plan.renditions.find((r) => r.name === wanted);
  if (!rendition) {
    throw new SeamtranscodeError(
      "invalid_options",
      `The plan has no rendition "${wanted}" (it has ${plan.renditions.map((r) => r.name).join(", ")})`
    );
  }
  return rendition;
};

/**
 * Step 2 of 3: encode one rendition and upload it. Renditions are
 * independent, so they can run one after another or on separate machines.
 */
export const encodeRendition = async (
  plan: TranscodePlan,
  name: string | number,
  options: EncodeOptions = {}
): Promise<RenditionResult> => {
  const rendition = findRendition(plan, name);
  const storage = options.storage ?? defaultStorage();
  const tools = resolveTools(options);
  const { signal } = options;
  const encoder = await resolveEncoder(tools, plan.encoder);
  const work = await makeWorkDir(options.workDir);

  try {
    const src =
      options.source ??
      (plan.sourceCache && (await exists(plan.sourceCache))
        ? plan.sourceCache
        : await fetchInput(
            plan.input,
            storage,
            path.join(work, "source"),
            signal
          ));
    throwIfAborted(signal);

    const dir = path.join(work, rendition.name);
    await mkdir(dir, { recursive: true });
    const duration = plan.source.duration;
    const seg = plan.segmentDuration;
    let outTime = 0;
    let speed = 0;
    let buffer = "";

    await run(
      tools.ffmpeg,
      [
        "-hide_banner",
        "-y",
        "-nostdin",
        ...INPUT_GUARD,
        "-i",
        fileArg(src),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-sn",
        "-dn",
        "-vf",
        `scale=${rendition.width}:${rendition.height},setsar=1,format=${pixelFormat(encoder)}`,
        // slow-motion phone clips can be 240 fps; nobody streams that
        "-fpsmax",
        "60",
        ...encoderArgs(encoder, plan.encoderSettings),
        "-b:v",
        `${rendition.videoBitrate}k`,
        "-maxrate",
        `${rendition.maxrate}k`,
        "-bufsize",
        `${rendition.bufsize}k`,
        // A keyframe on every segment boundary, at the same moments for
        // every rendition, so players switch sizes without a stall.
        "-force_key_frames",
        `expr:gte(t,n_forced*${seg})`,
        "-c:a",
        "aac",
        "-b:a",
        `${rendition.audioBitrate}k`,
        "-ac",
        "2",
        "-ar",
        "48000",
        "-f",
        "hls",
        "-hls_time",
        String(seg),
        "-hls_playlist_type",
        "vod",
        "-hls_flags",
        "independent_segments",
        "-hls_segment_filename",
        path.join(dir, "seg%04d.ts"),
        "-progress",
        "pipe:1",
        "-nostats",
        path.join(dir, "index.m3u8"),
      ],
      {
        background: tools.background,
        ...nonNull(signal, "signal"),
        onStdout: (chunk) => {
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const [key, value = ""] = line.split("=");
            if (key === "out_time_us") {
              const us = Number(value);
              if (Number.isFinite(us)) outTime = us / 1_000_000;
            } else if (key === "speed") speed = parseFloat(value) || 0;
            else if (key === "progress" && duration && options.onProgress) {
              const fraction = Math.min(outTime / duration, 1);
              const eta =
                speed > 0
                  ? Math.max(0, Math.round((duration - outTime) / speed))
                  : null;
              options.onProgress(fraction, eta);
            }
          }
        },
      }
    );

    const playlist = path.join(dir, "index.m3u8");
    const stats = await measureMediaPlaylist(playlist, seg);
    const codecs = stats.segments[0]
      ? await segmentCodecs(tools, path.join(dir, stats.segments[0]))
      : null;
    const prefix = joinKey(plan.output, rendition.name);
    await putDir(storage, prefix, dir, {
      last: "index.m3u8",
      ...nonNull(plan.cacheControl, "cacheControl"),
      ...nonNull(signal, "signal"),
    });

    return {
      name: rendition.name,
      width: rendition.width,
      height: rendition.height,
      playlist: outputFile(storage, joinKey(prefix, "index.m3u8")),
      bandwidth: stats.bandwidth,
      averageBandwidth: stats.averageBandwidth,
      codecs,
      segments: stats.segments.length,
      encoder,
    };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
};

export type FinishOptions = CommonOptions & {
  previews?: Previews | null;
  warnings?: string[];
};

/**
 * Step 3 of 3: write master.m3u8 for the renditions that were made.
 */
export const finishTranscode = async (
  plan: TranscodePlan,
  renditions: readonly RenditionResult[],
  options: FinishOptions = {}
): Promise<TranscodeResult> => {
  if (renditions.length === 0) {
    throw new SeamtranscodeError(
      "invalid_options",
      "finishTranscode needs at least one rendition"
    );
  }
  const storage = options.storage ?? defaultStorage();
  const sorted = [...renditions].sort(
    (a, b) => a.height * a.width - b.height * b.width
  );
  const work = await makeWorkDir(options.workDir);
  try {
    const master = path.join(work, "master.m3u8");
    await writeFile(master, buildMasterPlaylist(sorted, plan.source.fps));
    const key = joinKey(plan.output, "master.m3u8");
    await putFile(storage, key, master, {
      ...nonNull(plan.cacheControl, "cacheControl"),
      ...nonNull(options.signal, "signal"),
    });
    const warnings = [...(options.warnings ?? [])];
    if (plan.source.hdr) {
      warnings.push(
        "The source is HDR; the renditions are SDR, converted without tone mapping, so colors may look flat"
      );
    }
    return {
      playlist: outputFile(storage, key),
      renditions: sorted,
      previews: options.previews ?? null,
      source: plan.source,
      warnings,
    };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
};

export type TranscodeOptions = PlanOptions & {
  /**
   * Poster, small poster and hover-scrub sheet, made beside the encode so
   * they're ready in seconds. Default true; an object sets their sizes.
   */
  previews?: boolean | PreviewSizes;
  /** what will be made, once the source has been read */
  onPlan?: (plan: TranscodePlan) => void;
  /** the whole job, 0 → 1 */
  onProgress?: (progress: TranscodeProgress) => void;
  /** each rendition as it's uploaded: the first one means playable */
  onRendition?: (rendition: RenditionResult) => void;
  /** the poster and scrub sheet, usually long before the encode is done */
  onPreviews?: (previews: Previews) => void;
};

// Share of the progress bar each stage gets.
const ENCODE_START = 0.05;
const ENCODE_END = 0.97;

/**
 * Turn a video into adaptive HLS with a poster and a scrub sheet:
 * plan → encode each rendition, smallest first → master.m3u8.
 */
export const transcode = async (
  options: TranscodeOptions
): Promise<TranscodeResult> => {
  const storage = options.storage ?? defaultStorage();
  const tools = resolveTools(options);
  const { signal, onProgress } = options;
  const report = (p: TranscodeProgress) => onProgress?.(p);
  const previewSizes =
    options.previews === false
      ? null
      : resolveSpec(
          typeof options.previews === "object" ? options.previews : {}
        );
  const work = await makeWorkDir(options.workDir);

  try {
    report({ stage: "downloading", progress: 0, eta: null });
    const src = await fetchInput(
      options.input,
      storage,
      path.join(work, "source"),
      signal
    );
    report({ stage: "analyzing", progress: 0.02, eta: null });
    const plan = await planTranscode({ ...options, storage, sourceCache: src });
    // the cache is this job's temp copy: don't leak the path into results
    delete plan.sourceCache;
    if (options.sourceCache) plan.sourceCache = options.sourceCache;
    options.onPlan?.(plan);
    const common = {
      storage,
      ...nonNull(options.ffmpegPath, "ffmpegPath"),
      ...nonNull(options.ffprobePath, "ffprobePath"),
      ...nonNull(options.priority, "priority"),
      ...nonNull(signal, "signal"),
      ...nonNull(options.workDir, "workDir"),
    };

    const warnings: string[] = [];
    const previewsDone = previewSizes
      ? makeLocalPreviews(
          tools,
          src,
          path.join(work, "previews"),
          previewSizes,
          "video",
          signal,
          plan.source
        )
          .then(async (made) => {
            warnings.push(...made.warnings);
            const uploaded = await uploadPreviews(
              storage,
              options.output,
              made,
              {
                ...nonNull(options.cacheControl, "cacheControl"),
                ...nonNull(signal, "signal"),
              }
            );
            options.onPreviews?.(uploaded);
            return uploaded;
          })
          .catch((err: unknown) => {
            if (signal?.aborted) throw err;
            warnings.push(
              `Previews failed: ${err instanceof Error ? err.message : String(err)}`
            );
            return null;
          })
      : Promise.resolve(null);
    // Settled either way, so an encode failure never leaves it unhandled.
    previewsDone.catch(() => {});

    const results: RenditionResult[] = [];
    const span = (ENCODE_END - ENCODE_START) / plan.renditions.length;
    for (const [i, rendition] of plan.renditions.entries()) {
      let last = -1;
      const result = await encodeRendition(plan, rendition.name, {
        ...common,
        source: src,
        onProgress: (fraction, eta) => {
          const progress = ENCODE_START + span * (i + fraction);
          if (Math.round(progress * 1000) === last) return;
          last = Math.round(progress * 1000);
          // later renditions are bigger; guess them by pixel count
          const rest = plan.renditions
            .slice(i + 1)
            .reduce(
              (sum, r) =>
                sum +
                (r.width * r.height) / (rendition.width * rendition.height),
              0
            );
          const perRendition =
            eta === null || fraction >= 1 ? null : eta / (1 - fraction || 1);
          report({
            stage: "encoding",
            progress,
            eta:
              eta === null
                ? null
                : Math.round(eta + (perRendition ?? 0) * rest),
            rendition: rendition.name,
            renditionProgress: fraction,
          });
        },
      });
      results.push(result);
      options.onRendition?.(result);
    }

    report({ stage: "finishing", progress: ENCODE_END, eta: null });
    const previews = await previewsDone;
    const result = await finishTranscode(plan, results, {
      ...common,
      previews,
      warnings,
    });
    report({ stage: "finishing", progress: 1, eta: 0 });
    return result;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
};
