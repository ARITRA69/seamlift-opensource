import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { SeamtranscodeError, throwIfAborted } from "./errors";
import {
  fileArg,
  imageSize,
  INPUT_GUARD,
  resolveTools,
  run,
  type FfmpegOptions,
  type Tools,
} from "./ffmpeg";
import { detectKind, probe, type ProbeResult } from "./probe";
import { joinKey, type Storage } from "./storage/types";
import {
  defaultStorage,
  exists,
  fetchInput,
  inputName,
  makeWorkDir,
  outputFile,
  putFile,
  type Input,
  type OutputFile,
} from "./work";

export type ScrubOptions = {
  /** longest side of each frame; default 320 */
  frameSize?: number;
  /** at most this many frames; default 200 */
  maxFrames?: number;
  /** seconds; frames are at least this far apart; default 1 */
  minInterval?: number;
  /** frames per row of the sheet; default 10 */
  columns?: number;
};

export type PreviewSizes = {
  /** longest side of poster.jpg; default 1280 */
  posterSize?: number;
  /** longest side of poster-small.jpg; default 480 */
  smallSize?: number;
  /** the hover-scrub sprite sheet (videos only); default true */
  scrub?: boolean | ScrubOptions;
};

export type PreviewImage = OutputFile & { width: number; height: number };

/**
 * A sprite sheet of `count` frames, `columns` per row, each
 * `frameWidth` × `frameHeight`; frame i shows (i + 0.5) × `interval` seconds.
 */
export type ScrubSheet = PreviewImage & {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  count: number;
  interval: number;
};

export type Previews = {
  /** a representative frame (not the black first one), at posterSize */
  poster: PreviewImage;
  /** the same frame at smallSize, for grids and lists */
  posterSmall: PreviewImage;
  scrub: ScrubSheet | null;
};

export type PreviewsOptions = FfmpegOptions &
  PreviewSizes & {
    input: Input;
    /** key prefix (a folder, for local storage) the images are written to */
    output: string;
    /** default: files on this machine */
    storage?: Storage;
    /** default: by extension, then by what ffprobe makes of the file */
    kind?: "video" | "image";
    /** Cache-Control for the uploaded images */
    cacheControl?: string;
    signal?: AbortSignal;
    /** where temporary files go; default the OS temp folder */
    workDir?: string;
    /** a local copy of the input, so it isn't fetched again */
    source?: string;
  };

export type PreviewsResult = Previews & {
  kind: "video" | "image";
  /** things that went wrong without stopping the job */
  warnings: string[];
};

type LocalImage = {
  name: string;
  file: string;
  width: number;
  height: number;
};
type LocalScrub = LocalImage & Omit<ScrubSheet, keyof PreviewImage>;
type LocalPreviews = {
  poster: LocalImage;
  posterSmall: LocalImage;
  scrub: LocalScrub | null;
  warnings: string[];
};

type Spec = {
  posterSize: number;
  smallSize: number;
  scrub: Required<ScrubOptions> | null;
};

// Scrub frames are seeked one by one, each to its exact moment: a hover has
// to show what's really there, and decoding from the nearest keyframe keeps
// each seek to a handful of frames. They're independent, so a few run at
// once.
const SCRUB_SEEKS_AT_ONCE = 4;
// Clips this short gain nothing from a hover preview.
const SCRUB_MIN_DURATION = 2;
// ffmpeg's `thumbnail` filter keeps the most representative of this many
// frames, so a flash or a black frame loses.
const POSTER_CANDIDATES = 24;

const bounded = (name: string, value: number, min: number, max: number) => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new SeamtranscodeError(
      "invalid_options",
      `${name} must be between ${min} and ${max}`
    );
  }
  return value;
};

export const resolveSpec = (sizes: PreviewSizes = {}): Spec => {
  const scrub =
    sizes.scrub === false
      ? null
      : {
          frameSize: 320,
          maxFrames: 200,
          minInterval: 1,
          columns: 10,
          ...(sizes.scrub === true || !sizes.scrub ? {} : sizes.scrub),
        };
  return {
    posterSize: bounded("posterSize", sizes.posterSize ?? 1280, 16, 4096),
    smallSize: bounded("smallSize", sizes.smallSize ?? 480, 16, 4096),
    scrub: scrub && {
      frameSize: bounded("scrub.frameSize", scrub.frameSize, 16, 1024),
      maxFrames: bounded("scrub.maxFrames", scrub.maxFrames, 1, 1000),
      minInterval: bounded("scrub.minInterval", scrub.minInterval, 0.1, 3600),
      columns: bounded("scrub.columns", scrub.columns, 1, 50),
    },
  };
};

// Fit the longest side to `max`, never enlarging; the other side stays even.
const fit = (max: number) =>
  `scale='if(gte(iw,ih),min(${max},iw),-2)':'if(gte(iw,ih),-2,min(${max},ih))'`;

/** About a tenth of the way in, past fade-ins and slates, at most 30 s. */
export const posterTime = (duration: number | null) =>
  duration ? Math.min(duration * 0.1, 30) : 0;

/** Every slot filled from its nearest neighbour; null if nothing came out. */
export const fillGaps = <T>(slots: (T | null)[]): T[] | null => {
  const first = slots.find((s) => s !== null);
  if (first === undefined || first === null) return null;
  let last: T = first;
  return slots.map((s) => (s === null ? last : (last = s)));
};

export const scrubPlan = (
  duration: number | null,
  spec: Pick<Required<ScrubOptions>, "maxFrames" | "minInterval">
) => {
  if (!duration || duration < SCRUB_MIN_DURATION) return null;
  const interval = Math.max(spec.minInterval, duration / spec.maxFrames);
  return {
    interval,
    count: Math.max(
      1,
      Math.min(spec.maxFrames, Math.floor(duration / interval))
    ),
  };
};

const videoStills = async (
  tools: Tools,
  src: string,
  dir: string,
  spec: Spec,
  duration: number | null,
  signal?: AbortSignal
) => {
  const poster = path.join(dir, "poster.jpg");
  const small = path.join(dir, "poster-small.jpg");
  // One decode for both sizes: scale first so the candidate frames stay small.
  const args = (seek: number) => [
    "-hide_banner",
    "-y",
    ...(seek > 0 ? ["-ss", seek.toFixed(3)] : []),
    ...INPUT_GUARD,
    "-i",
    fileArg(src),
    "-an",
    "-sn",
    "-dn",
    "-filter_complex",
    `[0:v:0]${fit(spec.posterSize)},thumbnail=${POSTER_CANDIDATES},split=2[l][b];[b]${fit(spec.smallSize)}[s]`,
    "-map",
    "[l]",
    "-frames:v",
    "1",
    "-update",
    "1",
    "-q:v",
    "3",
    poster,
    "-map",
    "[s]",
    "-frames:v",
    "1",
    "-update",
    "1",
    "-q:v",
    "4",
    small,
  ];
  const at = posterTime(duration);
  const opts = { background: tools.background, ...(signal ? { signal } : {}) };
  try {
    await run(tools.ffmpeg, args(at), opts);
  } catch (err) {
    if (at === 0 || signal?.aborted) throw err;
    // A wrong duration can seek past the end: the start still works.
    await run(tools.ffmpeg, args(0), opts);
  }
  if (!(await exists(poster)) || !(await exists(small))) {
    throw new SeamtranscodeError(
      "ffmpeg_failed",
      "ffmpeg produced no still frame"
    );
  }
  return {
    poster: {
      name: "poster.jpg",
      file: poster,
      ...(await imageSize(tools, poster)),
    },
    posterSmall: {
      name: "poster-small.jpg",
      file: small,
      ...(await imageSize(tools, small)),
    },
  };
};

const videoScrub = async (
  tools: Tools,
  src: string,
  dir: string,
  spec: Required<ScrubOptions>,
  duration: number | null,
  signal?: AbortSignal
): Promise<LocalScrub | null> => {
  const plan = scrubPlan(duration, spec);
  if (!plan) return null;

  const framesDir = path.join(dir, "scrub-frames");
  await mkdir(framesDir, { recursive: true });
  const frameFile = (i: number) =>
    path.join(framesDir, `${String(i + 1).padStart(4, "0")}.jpg`);
  // Frame i shows (i + 0.5) × interval: the middle of its slice.
  const targets = Array.from({ length: plan.count }, (_, i) => ({
    at: (i + 0.5) * plan.interval,
    file: frameFile(i),
  }));
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      throwIfAborted(signal);
      const { at, file } = targets[next++]!;
      await run(
        tools.ffmpeg,
        [
          "-hide_banner",
          "-y",
          // several seeks run at once; one decoder thread each
          "-threads",
          "1",
          "-ss",
          at.toFixed(3),
          ...INPUT_GUARD,
          "-i",
          fileArg(src),
          "-an",
          "-sn",
          "-dn",
          "-frames:v",
          "1",
          "-update",
          "1",
          "-vf",
          fit(spec.frameSize),
          "-q:v",
          "5",
          file,
        ],
        { background: tools.background, ...(signal ? { signal } : {}) }
      ).catch((err: unknown) => {
        if (signal?.aborted) throw err;
        // a missing frame borrows its neighbour's
      });
    }
  };
  await Promise.all(Array.from({ length: SCRUB_SEEKS_AT_ONCE }, worker));

  // Keep every slot, so frame i stays at (i + 0.5) × interval: one that
  // didn't come out borrows the nearest one that did.
  const made = await Promise.all(targets.map(({ file }) => exists(file)));
  const frames = fillGaps(
    targets.map(({ file }, i) => (made[i] ? file : null))
  );
  if (!frames) return null;
  await Promise.all(
    frames.map((from, i) =>
      from === frameFile(i) ? undefined : copyFile(from, frameFile(i))
    )
  );

  const frame = await imageSize(tools, frames[0]!);
  const columns = Math.min(spec.columns, frames.length);
  const rows = Math.ceil(frames.length / columns);
  const sheet = path.join(dir, "scrub.jpg");
  await run(
    tools.ffmpeg,
    [
      "-hide_banner",
      "-y",
      ...INPUT_GUARD,
      "-framerate",
      "1",
      "-i",
      fileArg(path.join(framesDir, "%04d.jpg")),
      "-vf",
      `tile=${columns}x${rows}`,
      "-frames:v",
      "1",
      "-update",
      "1",
      "-q:v",
      "5",
      sheet,
    ],
    { background: tools.background, ...(signal ? { signal } : {}) }
  );
  await rm(framesDir, { recursive: true, force: true });

  return {
    name: "scrub.jpg",
    file: sheet,
    width: columns * frame.width,
    height: rows * frame.height,
    frameWidth: frame.width,
    frameHeight: frame.height,
    columns,
    count: frames.length,
    interval: plan.interval,
  };
};

/** Poster, small poster and scrub sheet for a video already on disk. */
export const makeVideoPreviews = async (
  tools: Tools,
  src: string,
  dir: string,
  spec: Spec,
  meta: ProbeResult,
  signal?: AbortSignal
): Promise<LocalPreviews> => {
  if (!meta.width || !meta.height) {
    throw new SeamtranscodeError(
      "no_video_stream",
      "The file has no video stream"
    );
  }
  const warnings: string[] = [];
  // Independent decodes of the same file: run them side by side.
  const [stills, scrub] = await Promise.all([
    videoStills(tools, src, dir, spec, meta.duration, signal),
    spec.scrub
      ? videoScrub(tools, src, dir, spec.scrub, meta.duration, signal).catch(
          (err: unknown) => {
            if (signal?.aborted) throw err;
            // the posters still make the file look right; the sheet is a bonus
            warnings.push(
              `Scrub sheet failed: ${err instanceof Error ? err.message : String(err)}`
            );
            return null;
          }
        )
      : null,
  ]);
  return { ...stills, scrub, warnings };
};

type Sharp = typeof import("sharp");

const loadSharp = async (): Promise<Sharp> => {
  try {
    const mod = (await import("sharp")) as unknown as { default?: Sharp };
    return mod.default ?? (mod as unknown as Sharp);
  } catch (err) {
    throw new SeamtranscodeError(
      "sharp_missing",
      "Image previews need sharp: npm install sharp",
      { cause: err }
    );
  }
};

const makeImagePreviews = async (
  src: string,
  dir: string,
  spec: Spec
): Promise<LocalPreviews> => {
  const sharp = await loadSharp();
  let meta: Awaited<ReturnType<ReturnType<Sharp>["metadata"]>>;
  try {
    meta = await sharp(src, { animated: false }).metadata();
  } catch (err) {
    throw new SeamtranscodeError(
      "unsupported_input",
      "Not an image we can read",
      { cause: err }
    );
  }
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  // Vectors are drawn at whatever density lands them at the poster size, so
  // a 64 px icon still makes a sharp preview.
  const density =
    meta.format === "svg" && longest
      ? Math.min(2400, Math.max(72, (72 * spec.posterSize) / longest))
      : undefined;
  const open = () =>
    sharp(src, { animated: false, ...(density ? { density } : {}) });

  // Keep transparency only when something is actually see-through.
  const transparent = !!meta.hasAlpha && !(await open().stats()).isOpaque;
  const ext = transparent ? "png" : "jpg";

  const make = async (max: number, base: string): Promise<LocalImage> => {
    const name = `${base}.${ext}`;
    const file = path.join(dir, name);
    const resized = open()
      .rotate() // honour EXIF orientation
      .resize({
        width: max,
        height: max,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColourspace("srgb");
    const info = await (
      transparent
        ? resized.png({ compressionLevel: 9 })
        : resized.jpeg({ quality: 82, mozjpeg: true })
    ).toFile(file);
    return { name, file, width: info.width, height: info.height };
  };

  const [poster, posterSmall] = await Promise.all([
    make(spec.posterSize, "poster"),
    make(spec.smallSize, "poster-small"),
  ]);
  return { poster, posterSmall, scrub: null, warnings: [] };
};

/** Make previews from a local file into `dir`. Used by previews() and transcode(). */
export const makeLocalPreviews = async (
  tools: Tools,
  src: string,
  dir: string,
  spec: Spec,
  kind: "video" | "image",
  signal?: AbortSignal,
  meta?: ProbeResult
): Promise<LocalPreviews> => {
  await mkdir(dir, { recursive: true });
  if (kind === "image") return makeImagePreviews(src, dir, spec);
  const info =
    meta ??
    (await probe(src, {
      ffmpegPath: tools.ffmpeg,
      ffprobePath: tools.ffprobe,
      ...(signal ? { signal } : {}),
    }));
  return makeVideoPreviews(tools, src, dir, spec, info, signal);
};

/** Upload local previews under `output` and describe them. */
export const uploadPreviews = async (
  storage: Storage,
  output: string,
  made: LocalPreviews,
  options: { cacheControl?: string; signal?: AbortSignal } = {}
): Promise<Previews> => {
  const files = [
    made.poster,
    made.posterSmall,
    ...(made.scrub ? [made.scrub] : []),
  ];
  await Promise.all(
    files.map((f) => putFile(storage, joinKey(output, f.name), f.file, options))
  );
  const image = (f: LocalImage): PreviewImage => ({
    ...outputFile(storage, joinKey(output, f.name)),
    width: f.width,
    height: f.height,
  });
  return {
    poster: image(made.poster),
    posterSmall: image(made.posterSmall),
    scrub: made.scrub
      ? {
          ...image(made.scrub),
          frameWidth: made.scrub.frameWidth,
          frameHeight: made.scrub.frameHeight,
          columns: made.scrub.columns,
          count: made.scrub.count,
          interval: made.scrub.interval,
        }
      : null,
  };
};

/**
 * A poster, a small poster and (for videos) a hover-scrub sprite sheet.
 * Images are resized with sharp, which is then needed: `npm install sharp`.
 */
export const previews = async (
  options: PreviewsOptions
): Promise<PreviewsResult> => {
  const tools = resolveTools(options);
  const storage = options.storage ?? defaultStorage();
  const spec = resolveSpec(options);
  const { signal } = options;
  const work = await makeWorkDir(options.workDir);
  try {
    const src =
      options.source ??
      (await fetchInput(
        options.input,
        storage,
        path.join(work, "source"),
        signal
      ));
    const kind =
      options.kind ??
      (await detectKind(src, inputName(options.input), tools, signal));
    const made = await makeLocalPreviews(
      tools,
      src,
      path.join(work, "out"),
      spec,
      kind,
      signal
    );
    const uploaded = await uploadPreviews(storage, options.output, made, {
      ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}),
      ...(signal ? { signal } : {}),
    });
    return { ...uploaded, kind, warnings: made.warnings };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
};
