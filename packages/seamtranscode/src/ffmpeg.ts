import { spawn } from "node:child_process";
import { setPriority } from "node:os";
import path from "node:path";
import { SeamtranscodeError } from "./errors";

export type FfmpegOptions = {
  /** default: $FFMPEG_PATH, then "ffmpeg" on PATH */
  ffmpegPath?: string;
  /** default: $FFPROBE_PATH, then "ffprobe" on PATH */
  ffprobePath?: string;
  /**
   * "background" runs ffmpeg at low priority, so encoding in a desktop app
   * doesn't make the machine stutter. Default "normal".
   */
  priority?: "normal" | "background";
};

export type Tools = { ffmpeg: string; ffprobe: string; background: boolean };

export const resolveTools = (options: FfmpegOptions = {}): Tools => ({
  ffmpeg: options.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobe: options.ffprobePath ?? process.env.FFPROBE_PATH ?? "ffprobe",
  background: options.priority === "background",
});

const INSTALL_HINT: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "brew install ffmpeg",
  linux: "sudo apt install ffmpeg (or your distro's package)",
  win32: "winget install ffmpeg",
};

// Every input is a file on this machine, so nothing else may be opened while
// reading it. Without this, an upload that's really an HLS playlist or a
// concat list (named .mp4) makes ffmpeg fetch any URL it names, or read other
// files on this machine into the output. Goes before each "-i".
export const INPUT_GUARD = ["-protocol_whitelist", "file"];

// "file:" stops a name like "concat:a|b" or "http:..." being read as a
// protocol, whatever the file is called.
export const fileArg = (file: string) => `file:${path.resolve(file)}`;

type RunOptions = {
  signal?: AbortSignal;
  background?: boolean;
  onStdout?: (chunk: string) => void;
};

/** Run ffmpeg or ffprobe; resolves with stdout. */
export const run = (bin: string, args: string[], options: RunOptions = {}) =>
  new Promise<string>((resolve, reject) => {
    const { signal, background, onStdout } = options;
    if (signal?.aborted) {
      reject(new SeamtranscodeError("aborted", "Aborted"));
      return;
    }
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    if (background && child.pid) {
      try {
        setPriority(child.pid, 10);
      } catch {
        // not allowed here: run at normal priority
      }
    }

    let stdout = "";
    let stderr = "";
    let aborted = false;
    const onAbort = () => {
      aborted = true;
      child.kill("SIGKILL");
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (onStdout) onStdout(chunk);
      else stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 16_000) stderr = stderr.slice(-8000);
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      signal?.removeEventListener("abort", onAbort);
      if (err.code === "ENOENT") {
        const hint = INSTALL_HINT[process.platform];
        reject(
          new SeamtranscodeError(
            "ffmpeg_missing",
            `Couldn't find ${bin}. seamtranscode needs ffmpeg and ffprobe` +
              (hint ? `: ${hint}` : "") +
              `, or pass ffmpegPath / ffprobePath.`,
            { cause: err }
          )
        );
      } else reject(err);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (aborted) reject(new SeamtranscodeError("aborted", "Aborted"));
      else if (code === 0) resolve(stdout);
      else {
        const log = stderr.slice(-4000).trim();
        const last = log.split("\n").filter(Boolean).pop() ?? "";
        reject(
          new SeamtranscodeError(
            "ffmpeg_failed",
            `${path.basename(bin)} exited with ${code}${last ? `: ${last}` : ""}`,
            { log }
          )
        );
      }
    });
  });

/** Width × height of an image we wrote ourselves. */
export const imageSize = async (tools: Tools, file: string) => {
  const out = await run(tools.ffprobe, [
    ...INPUT_GUARD,
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    fileArg(file),
  ]);
  const stream = (
    JSON.parse(out) as { streams?: { width?: number; height?: number }[] }
  ).streams?.[0];
  return { width: stream?.width ?? 0, height: stream?.height ?? 0 };
};
