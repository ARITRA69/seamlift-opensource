import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "../src/ffmpeg";

export const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";

export const tempDir = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "seamtranscode-test-"));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
};

type ClipOptions = {
  width?: number;
  height?: number;
  seconds?: number;
  fps?: number;
  audio?: boolean;
  /** stored landscape, displayed turned this many degrees, like phone video */
  rotation?: 90 | 270;
};

/** A test-pattern clip, made with ffmpeg's lavfi sources. */
export const makeClip = async (file: string, options: ClipOptions = {}) => {
  const {
    width = 640,
    height = 360,
    seconds = 8,
    fps = 25,
    audio = true,
  } = options;
  await run(ffmpeg, [
    "-y",
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=${width}x${height}:rate=${fps}:duration=${seconds}`,
    ...(audio
      ? ["-f", "lavfi", "-i", `sine=frequency=330:duration=${seconds}`]
      : []),
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    ...(audio ? ["-c:a", "aac", "-shortest"] : []),
    options.rotation ? `${file}.tmp.mp4` : file,
  ]);
  if (options.rotation) {
    await run(ffmpeg, [
      "-y",
      "-v",
      "error",
      "-display_rotation",
      String(options.rotation === 90 ? -90 : 90),
      "-i",
      `${file}.tmp.mp4`,
      "-c",
      "copy",
      file,
    ]);
    await rm(`${file}.tmp.mp4`);
  }
  return file;
};
