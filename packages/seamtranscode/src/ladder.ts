import { SeamtranscodeError } from "./errors";

/**
 * One size to make. A number is the short side in pixels, the way "1080p"
 * is meant: a portrait phone video at 1080 comes out 1080 × 1920.
 */
export type RenditionInput =
  | number
  | {
      size: number;
      /** video kbps; default by size and frame rate */
      bitrate?: number;
      /** AAC kbps; default 128 */
      audioBitrate?: number;
    };

export const DEFAULT_RENDITIONS: readonly number[] = [360, 720, 1080];

export type PlannedRendition = {
  /** "720p"; also its folder in the output */
  name: string;
  /** short side */
  size: number;
  width: number;
  height: number;
  /** kbps */
  videoBitrate: number;
  maxrate: number;
  bufsize: number;
  audioBitrate: number;
};

// kbps at 30 fps, by short side. Sizes in between follow the curve below.
const BITRATES: Record<number, number> = {
  240: 400,
  360: 800,
  480: 1400,
  540: 1800,
  720: 2500,
  1080: 5000,
  1440: 9000,
  2160: 18000,
};

/** Video kbps for a size: the table, else 1080p's scaled by pixel count. */
export const defaultBitrate = (size: number, fps: number | null) => {
  const base =
    BITRATES[size] ??
    Math.round((5000 * Math.pow((size * size) / (1080 * 1080), 0.75)) / 50) *
      50;
  // 50 and 60 fps carry nearly twice the frames
  return fps && fps > 40 ? Math.round(base * 1.5) : base;
};

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

const normalise = (input: RenditionInput) => {
  const r = typeof input === "number" ? { size: input } : input;
  if (!Number.isFinite(r.size) || r.size < 64 || r.size > 4320) {
    throw new SeamtranscodeError(
      "invalid_options",
      `Rendition size ${r.size} is out of range (64–4320)`
    );
  }
  return { ...r, size: even(r.size) };
};

/**
 * The sizes to make for a source: never larger than it, smallest first. If
 * every requested size is larger, one rendition at the source's own size.
 */
export const planLadder = (
  source: { width: number | null; height: number | null; fps: number | null },
  requested: readonly RenditionInput[] = DEFAULT_RENDITIONS
): PlannedRendition[] => {
  const { width, height, fps } = source;
  if (!width || !height) {
    throw new SeamtranscodeError(
      "no_video_stream",
      "The file has no video stream"
    );
  }
  if (requested.length === 0) {
    throw new SeamtranscodeError("invalid_options", "No renditions requested");
  }
  const short = Math.min(width, height);
  const landscape = width >= height;

  const bySize = new Map<number, ReturnType<typeof normalise>>();
  for (const r of requested.map(normalise)) bySize.set(r.size, r);
  let chosen = [...bySize.values()]
    .filter((r) => r.size <= short)
    .sort((a, b) => a.size - b.size);
  if (chosen.length === 0) {
    const smallest = [...bySize.values()].sort((a, b) => a.size - b.size)[0]!;
    chosen = [{ ...smallest, size: Math.floor(short / 2) * 2 }];
  }

  return chosen.map((r) => {
    const videoBitrate = r.bitrate ?? defaultBitrate(r.size, fps);
    return {
      name: `${r.size}p`,
      size: r.size,
      width: landscape ? even((width * r.size) / height) : r.size,
      height: landscape ? r.size : even((height * r.size) / width),
      videoBitrate,
      // room for hard scenes, but bounded so the stream's peak stays near
      // what the playlist promises
      maxrate: Math.round(videoBitrate * 1.5),
      bufsize: videoBitrate * 2,
      audioBitrate: r.audioBitrate ?? 128,
    };
  });
};
