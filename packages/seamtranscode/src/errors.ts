export type SeamtranscodeErrorKind =
  /** ffmpeg or ffprobe isn't installed, or isn't where the options say */
  | "ffmpeg_missing"
  /** the file isn't a video (or image) we can read */
  | "unsupported_input"
  /** the file has no picture: audio only, or an empty container */
  | "no_video_stream"
  /** ffmpeg ran and failed; `log` has the end of its output */
  | "ffmpeg_failed"
  /** reading or writing storage failed */
  | "storage"
  /** the signal passed in was aborted */
  | "aborted"
  /** something in the options can't work */
  | "invalid_options"
  /** image previews need sharp: `npm install sharp` */
  | "sharp_missing";

/**
 * Every error seamtranscode throws. `kind` is stable, so an app can show
 * "This file isn't a video" instead of an ffmpeg log; the log, when there is
 * one, is on `log`.
 */
export class SeamtranscodeError extends Error {
  readonly kind: SeamtranscodeErrorKind;
  readonly log?: string;

  constructor(
    kind: SeamtranscodeErrorKind,
    message: string,
    options: { log?: string; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? {} : { cause: options.cause });
    this.name = "SeamtranscodeError";
    this.kind = kind;
    if (options.log !== undefined) this.log = options.log;
  }
}

export const isAbort = (err: unknown) =>
  (err instanceof SeamtranscodeError && err.kind === "aborted") ||
  (err instanceof Error && err.name === "AbortError");

export const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new SeamtranscodeError("aborted", "Aborted");
};
