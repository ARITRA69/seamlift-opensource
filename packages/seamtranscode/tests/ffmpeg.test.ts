// Needs ffmpeg and ffprobe on PATH.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  encodeRendition,
  finishTranscode,
  local,
  planTranscode,
  previews,
  probe,
  SeamtranscodeError,
  transcode,
  type TranscodeProgress,
} from "../src/index";
import { makeClip, tempDir } from "./helpers";

let dir = "";
let cleanup = async () => {};
let clip = "";

const kindOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "resolved";
  } catch (err) {
    return err instanceof SeamtranscodeError
      ? err.kind
      : `not a SeamtranscodeError: ${String(err)}`;
  }
};

const durations = async (playlist: string) =>
  (await readFile(playlist, "utf8"))
    .split("\n")
    .filter((l) => l.startsWith("#EXTINF:"))
    .map((l) => parseFloat(l.slice(8)));

beforeAll(async () => {
  ({ dir, cleanup } = await tempDir());
  clip = await makeClip(path.join(dir, "clip.mp4"), {
    width: 1280,
    height: 720,
    seconds: 13,
  });
});
afterAll(() => cleanup());

describe("transcode", () => {
  test("a 13 s 720p clip: two aligned renditions, a poster and a scrub sheet", async () => {
    const out = path.join(dir, "out");
    const progress: TranscodeProgress[] = [];
    const ready: string[] = [];
    let previewsAt = -1;
    const result = await transcode({
      input: clip,
      output: out,
      renditions: [360, 720, 1080],
      onProgress: (p) => progress.push(p),
      onRendition: (r) => ready.push(r.name),
      onPreviews: () => (previewsAt = ready.length),
    });

    // never upscaled: 1080 was asked for, the source is 720
    expect(result.renditions.map((r) => r.name)).toEqual(["360p", "720p"]);
    expect(ready).toEqual(["360p", "720p"]);
    expect(previewsAt).toBeGreaterThanOrEqual(0);
    expect(result.source.width).toBe(1280);
    expect(result.warnings).toEqual([]);

    // every size splits into segments at the same moments
    const a = await durations(path.join(out, "360p/index.m3u8"));
    const b = await durations(path.join(out, "720p/index.m3u8"));
    expect(a).toEqual(b);
    expect(a.slice(0, 2)).toEqual([6, 6]);

    const master = await readFile(path.join(out, "master.m3u8"), "utf8");
    expect(master).toContain("RESOLUTION=640x360");
    expect(master).toContain('CODECS="avc1.');
    for (const r of result.renditions) {
      expect(r.bandwidth).toBeGreaterThan(0);
      expect(r.bandwidth).toBeGreaterThanOrEqual(r.averageBandwidth * 0.9);
    }

    const p = result.previews!;
    expect([p.poster.width, p.poster.height]).toEqual([1280, 720]);
    expect([p.posterSmall.width, p.posterSmall.height]).toEqual([480, 270]);
    expect(p.scrub!.count).toBe(13);
    expect([p.scrub!.frameWidth, p.scrub!.frameHeight]).toEqual([320, 180]);
    expect([p.scrub!.width, p.scrub!.height]).toEqual([3200, 360]);

    expect(progress[0]!.progress).toBe(0);
    expect(progress.at(-1)!.progress).toBe(1);
    expect(
      progress.every(
        (x, i) => i === 0 || x.progress >= progress[i - 1]!.progress
      )
    ).toBe(true);
  }, 120_000);

  test("portrait phone video (rotation metadata) keeps its resolution", async () => {
    const src = await makeClip(path.join(dir, "phone.mp4"), {
      width: 640,
      height: 360,
      seconds: 3,
      rotation: 90,
    });
    const meta = await probe(src);
    expect([meta.width, meta.height]).toEqual([360, 640]);
    const result = await transcode({
      input: src,
      output: path.join(dir, "phone"),
      renditions: [360],
      previews: false,
    });
    expect([result.renditions[0]!.width, result.renditions[0]!.height]).toEqual(
      [360, 640]
    );
    expect(result.previews).toBeNull();
  }, 60_000);

  test("a video without audio still transcodes", async () => {
    const src = await makeClip(path.join(dir, "silent.mp4"), {
      seconds: 3,
      audio: false,
    });
    const result = await transcode({
      input: src,
      output: path.join(dir, "silent"),
      renditions: [360],
    });
    expect(result.renditions[0]!.codecs).toMatch(/^avc1\.[0-9a-f]{6}$/);
  }, 60_000);

  test("storage keys, local root and public URLs", async () => {
    const root = path.join(dir, "bucket");
    await mkdir(path.join(root, "uploads"), { recursive: true });
    await writeFile(path.join(root, "uploads/a.mp4"), await readFile(clip));
    const storage = local({ root, publicUrl: "https://cdn.test" });
    const result = await transcode({
      storage,
      input: { key: "uploads/a.mp4" },
      output: "videos/a",
      renditions: [360],
      previews: { scrub: false },
    });
    expect(result.playlist).toEqual({
      key: "videos/a/master.m3u8",
      url: "https://cdn.test/videos/a/master.m3u8",
    });
    expect(result.previews!.scrub).toBeNull();
    expect((await readdir(path.join(root, "videos/a"))).sort()).toEqual(
      ["360p", "master.m3u8", "poster-small.jpg", "poster.jpg"].sort()
    );
    expect(
      await kindOf(
        transcode({ storage, input: { key: "../clip.mp4" }, output: "x" })
      )
    ).toBe("invalid_options");
    expect(
      await kindOf(
        transcode({
          storage,
          input: { key: "uploads/missing.mp4" },
          output: "x",
        })
      )
    ).toBe("storage");
  }, 60_000);

  test("plan → encode on 'separate machines' → finish matches", async () => {
    const root = path.join(dir, "shared");
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "in.mp4"), await readFile(clip));
    const storage = local({ root });
    const plan = await planTranscode({
      storage,
      input: { key: "in.mp4" },
      output: "out",
      renditions: [360, 720],
    });
    // the plan crosses a process boundary as JSON
    const wire = JSON.parse(JSON.stringify(plan)) as typeof plan;
    const results = await Promise.all(
      wire.renditions.map((r) => encodeRendition(wire, r.name, { storage }))
    );
    const result = await finishTranscode(wire, results, { storage });
    expect(result.renditions.map((r) => r.name)).toEqual(["360p", "720p"]);
    expect(await durations(path.join(root, "out/360p/index.m3u8"))).toEqual(
      await durations(path.join(root, "out/720p/index.m3u8"))
    );
    expect(await kindOf(encodeRendition(wire, "1080p", { storage }))).toBe(
      "invalid_options"
    );
  }, 120_000);

  test("abort kills ffmpeg and rejects with kind aborted", async () => {
    const controller = new AbortController();
    const job = transcode({
      input: clip,
      output: path.join(dir, "aborted"),
      signal: controller.signal,
      onProgress: (p) => {
        if (p.stage === "encoding") controller.abort();
      },
    });
    expect(await kindOf(job)).toBe("aborted");
  }, 60_000);
});

describe("hostile and wrong inputs", () => {
  // An "upload" that is really a playlist naming a URL and a local file:
  // refused before ffmpeg fetches or reads anything.
  test.each([
    [
      "hls.mp4",
      "#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nhttp://127.0.0.1:9/x.ts\n#EXTINF:10,\nfile:///etc/hosts\n#EXT-X-ENDLIST\n",
    ],
    ["concat.mp4", "ffconcat version 1.0\nfile '/etc/hosts'\n"],
    ["text.mp4", "just some text"],
  ])(
    "%s is refused as unsupported_input",
    async (name, body) => {
      const src = path.join(dir, name);
      await writeFile(src, body);
      expect(
        await kindOf(
          transcode({ input: src, output: path.join(dir, `${name}-out`) })
        )
      ).toBe("unsupported_input");
      expect(
        await kindOf(
          previews({
            input: src,
            output: path.join(dir, `${name}-p`),
            kind: "video",
          })
        )
      ).toBe("unsupported_input");
    },
    60_000
  );

  test("a name that looks like a protocol is still just a file", async () => {
    const odd = path.join(dir, "concat:evil.mp4");
    await writeFile(odd, await readFile(clip));
    const meta = await probe(odd);
    expect(meta.width).toBe(1280);
  });

  test("audio only: no_video_stream", async () => {
    const src = path.join(dir, "audio.m4a");
    const { run } = await import("../src/ffmpeg");
    await run("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=2",
      "-c:a",
      "aac",
      src,
    ]);
    expect(
      await kindOf(transcode({ input: src, output: path.join(dir, "audio") }))
    ).toBe("no_video_stream");
  });

  test("a missing ffmpeg says how to install it", async () => {
    const err = await transcode({
      input: clip,
      output: path.join(dir, "x"),
      ffprobePath: "/nope/ffprobe",
    }).catch((e: unknown) => e as SeamtranscodeError);
    expect(err).toBeInstanceOf(SeamtranscodeError);
    expect((err as SeamtranscodeError).kind).toBe("ffmpeg_missing");
    expect((err as SeamtranscodeError).message).toContain("ffprobe");
  });
});

describe("previews", () => {
  test("video previews alone", async () => {
    const result = await previews({
      input: clip,
      output: path.join(dir, "pv"),
    });
    expect(result.kind).toBe("video");
    expect(result.scrub?.count).toBe(13);
  }, 60_000);

  test("images: resized with sharp, transparency kept as PNG", async () => {
    const sharp = (await import("sharp")).default;
    const png = path.join(dir, "logo.png");
    await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 },
      },
    })
      .png()
      .toFile(png);
    const result = await previews({
      input: png,
      output: path.join(dir, "img"),
    });
    expect(result.kind).toBe("image");
    expect(result.poster.key.endsWith("poster.png")).toBe(true);
    expect([result.poster.width, result.poster.height]).toEqual([1280, 640]);
    expect(result.scrub).toBeNull();
  });

  test("an SVG naming an external image never fetches it", async () => {
    let fetched = 0;
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        fetched++;
        return new Response("no", { status: 404 });
      },
    });
    try {
      const src = path.join(dir, "badge.svg");
      await writeFile(
        src,
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64">` +
          `<rect width="64" height="64" fill="#e0115f"/>` +
          `<image href="http://127.0.0.1:${server.port}/x.png" xlink:href="http://127.0.0.1:${server.port}/x.png" width="64" height="64"/>` +
          `</svg>`
      );
      const result = await previews({
        input: src,
        output: path.join(dir, "svg"),
      });
      expect(result.poster.width).toBe(1280);
      expect(fetched).toBe(0);
    } finally {
      server.stop(true);
    }
  });
});
