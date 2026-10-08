import { SeamtranscodeError } from "./errors";
import { run, type Tools } from "./ffmpeg";

/** H.264 encoders seamtranscode knows how to drive. */
export type Encoder =
  "libx264" | "h264_videotoolbox" | "h264_nvenc" | "h264_qsv";

export const ENCODERS: readonly Encoder[] = [
  "libx264",
  "h264_videotoolbox",
  "h264_nvenc",
  "h264_qsv",
];

export type EncoderChoice = Encoder | "auto";

export type EncoderSettings = {
  /** libx264 only; default "fast" */
  preset?: string;
};

/** The pixel format the encoder takes; the scale filter ends in it. */
export const pixelFormat = (encoder: Encoder) =>
  encoder === "h264_qsv" ? "nv12" : "yuv420p";

/**
 * Encoder flags. Rate control (bitrate, maxrate, bufsize) and keyframes are
 * added by the caller: they're the same for every encoder.
 */
export const encoderArgs = (
  encoder: Encoder,
  settings: EncoderSettings = {}
): string[] => {
  switch (encoder) {
    case "libx264":
      // sc_threshold 0: no extra keyframes at scene cuts, so every size
      // splits into segments at exactly the same moments
      return [
        "-c:v",
        "libx264",
        "-preset",
        settings.preset ?? "fast",
        "-profile:v",
        "high",
        "-sc_threshold",
        "0",
      ];
    case "h264_videotoolbox":
      return ["-c:v", "h264_videotoolbox", "-profile:v", "high"];
    case "h264_nvenc":
      return [
        "-c:v",
        "h264_nvenc",
        "-preset",
        "p5",
        "-profile:v",
        "high",
        "-rc",
        "vbr",
        "-forced-idr",
        "1",
      ];
    case "h264_qsv":
      return ["-c:v", "h264_qsv", "-preset", "medium", "-profile:v", "high"];
  }
};

export const isEncoder = (value: string): value is Encoder =>
  (ENCODERS as readonly string[]).includes(value);

// Hardware first, in the order they're likely to be fastest on this OS.
const candidates = (): Encoder[] =>
  process.platform === "darwin"
    ? ["h264_videotoolbox"]
    : ["h264_nvenc", "h264_qsv"];

const detected = new Map<string, Promise<Encoder>>();

// Listed isn't enough: an NVENC build on a machine without an NVIDIA card
// lists h264_nvenc and fails on the first frame. Encode a few frames to know.
const works = async (tools: Tools, encoder: Encoder) => {
  try {
    await run(tools.ffmpeg, [
      "-hide_banner",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=black:s=256x144:r=30:d=0.5",
      "-vf",
      `format=${pixelFormat(encoder)}`,
      ...encoderArgs(encoder),
      "-b:v",
      "500k",
      "-f",
      "null",
      "-",
    ]);
    return true;
  } catch {
    return false;
  }
};

const detect = async (tools: Tools): Promise<Encoder> => {
  const list = await run(tools.ffmpeg, ["-hide_banner", "-encoders"]);
  const listed = (name: string) => new RegExp(`\\s${name}\\s`).test(list);
  for (const encoder of candidates()) {
    if (listed(encoder) && (await works(tools, encoder))) return encoder;
  }
  if (!listed("libx264")) {
    throw new SeamtranscodeError(
      "ffmpeg_missing",
      "This ffmpeg has no H.264 encoder (libx264). Install a full ffmpeg build."
    );
  }
  return "libx264";
};

/**
 * The encoder to use on this machine. "auto" picks a working hardware
 * encoder (VideoToolbox on Macs, NVENC, Quick Sync) and falls back to
 * libx264; the answer is remembered for the process.
 */
export const resolveEncoder = (
  tools: Tools,
  choice: EncoderChoice = "libx264"
): Promise<Encoder> => {
  if (choice !== "auto") {
    if (!isEncoder(choice)) {
      return Promise.reject(
        new SeamtranscodeError(
          "invalid_options",
          `Unknown encoder "${choice}". Use one of: auto, ${ENCODERS.join(", ")}`
        )
      );
    }
    return Promise.resolve(choice);
  }
  let pending = detected.get(tools.ffmpeg);
  if (!pending) {
    pending = detect(tools);
    detected.set(tools.ffmpeg, pending);
    pending.catch(() => detected.delete(tools.ffmpeg));
  }
  return pending;
};
