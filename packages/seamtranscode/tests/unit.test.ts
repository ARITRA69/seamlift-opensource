import { describe, expect, test } from "bun:test";
import { SeamtranscodeError } from "../src/errors";
import { buildMasterPlaylist } from "../src/hls";
import { defaultBitrate, planLadder } from "../src/ladder";
import { toSeamPlayer } from "../src/player";
import { fillGaps, resolveSpec, scrubPlan } from "../src/previews";
import { isVideoContainer } from "../src/probe";
import { Lane } from "../src/server/lane";
import { isSafeKey } from "../src/server/validate";
import {
  signWebhook,
  verifyWebhook,
  WebhookVerificationError,
} from "../src/webhooks";

describe("planLadder", () => {
  const hd = { width: 1920, height: 1080, fps: 30 };

  test("keeps the requested sizes at or below the source, smallest first", () => {
    const ladder = planLadder(hd, [1080, 2160, 360, 720]);
    expect(ladder.map((r) => r.name)).toEqual(["360p", "720p", "1080p"]);
    expect(ladder.map((r) => [r.width, r.height])).toEqual([
      [640, 360],
      [1280, 720],
      [1920, 1080],
    ]);
  });

  test("a size is the short side, so portrait video keeps its resolution", () => {
    const ladder = planLadder(
      { width: 1080, height: 1920, fps: 30 },
      [360, 1080]
    );
    expect(ladder.map((r) => [r.width, r.height])).toEqual([
      [360, 640],
      [1080, 1920],
    ]);
  });

  test("never upscales: a small source gets one rendition at its own size", () => {
    const ladder = planLadder({ width: 426, height: 241, fps: 25 }, [360, 720]);
    expect(ladder).toHaveLength(1);
    expect([ladder[0]!.name, ladder[0]!.width, ladder[0]!.height]).toEqual([
      "240p",
      424,
      240,
    ]);
  });

  test("odd aspect ratios round to even widths", () => {
    const [r] = planLadder({ width: 1000, height: 750, fps: 30 }, [360]);
    expect([r!.width, r!.height]).toEqual([480, 360]);
    const [s] = planLadder({ width: 2048, height: 858, fps: 24 }, [720]);
    expect(s!.width % 2).toBe(0);
  });

  test("bitrates: the table, more for high frame rates, caps above", () => {
    expect(defaultBitrate(720, 30)).toBe(2500);
    expect(defaultBitrate(720, 60)).toBe(3750);
    const [r] = planLadder(hd, [{ size: 720, bitrate: 3000 }]);
    expect([r!.videoBitrate, r!.maxrate, r!.bufsize]).toEqual([
      3000, 4500, 6000,
    ]);
  });

  test("no video stream, or nonsense sizes, are errors with a kind", () => {
    expect(() => planLadder({ width: null, height: null, fps: null })).toThrow(
      SeamtranscodeError
    );
    try {
      planLadder(hd, [10]);
    } catch (err) {
      expect((err as SeamtranscodeError).kind).toBe("invalid_options");
    }
  });
});

describe("buildMasterPlaylist", () => {
  test("lists every rendition with real bandwidths and codecs", () => {
    const text = buildMasterPlaylist(
      [
        {
          name: "360p",
          width: 640,
          height: 360,
          bandwidth: 900_000,
          averageBandwidth: 700_000,
          codecs: "avc1.64001e,mp4a.40.2",
        },
        {
          name: "720p",
          width: 1280,
          height: 720,
          bandwidth: 2_800_000,
          averageBandwidth: 2_000_000,
          codecs: null,
        },
      ],
      29.97
    );
    expect(text).toBe(
      [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        "#EXT-X-INDEPENDENT-SEGMENTS",
        '#EXT-X-STREAM-INF:BANDWIDTH=900000,AVERAGE-BANDWIDTH=700000,RESOLUTION=640x360,FRAME-RATE=29.970,CODECS="avc1.64001e,mp4a.40.2"',
        "360p/index.m3u8",
        "#EXT-X-STREAM-INF:BANDWIDTH=2800000,AVERAGE-BANDWIDTH=2000000,RESOLUTION=1280x720,FRAME-RATE=29.970",
        "720p/index.m3u8",
        "",
      ].join("\n")
    );
  });
});

describe("isVideoContainer", () => {
  test.each([
    ["mov,mp4,m4a,3gp,3g2,mj2", true],
    ["matroska,webm", true],
    ["mpegts", true],
    ["hls", false],
    ["concat", false],
    ["image2", false],
    ["mov,mp4,hls", false],
    ["", false],
    [undefined, false],
  ])("%s → %s", (name, ok) => {
    expect(isVideoContainer(name as string | undefined)).toBe(ok);
  });
});

describe("previews planning", () => {
  test("fillGaps keeps every slot in place", () => {
    expect(fillGaps(["a", null, "c", null])).toEqual(["a", "a", "c", "c"]);
    expect(fillGaps([null, null, "c", "d"])).toEqual(["c", "c", "c", "d"]);
    expect(fillGaps([null, null])).toBeNull();
  });

  test("scrubPlan: a frame a second for short clips, at most maxFrames", () => {
    const spec = { maxFrames: 200, minInterval: 1 };
    expect(scrubPlan(12, spec)).toEqual({ interval: 1, count: 12 });
    const long = scrubPlan(600, spec)!;
    expect(long.count).toBe(200);
    expect(long.interval).toBeCloseTo(3);
    expect(scrubPlan(1.5, spec)).toBeNull();
    expect(scrubPlan(null, spec)).toBeNull();
  });

  test("resolveSpec has defaults and refuses giant images", () => {
    expect(resolveSpec()).toEqual({
      posterSize: 1280,
      smallSize: 480,
      scrub: { frameSize: 320, maxFrames: 200, minInterval: 1, columns: 10 },
    });
    expect(resolveSpec({ scrub: false }).scrub).toBeNull();
    expect(() => resolveSpec({ posterSize: 100_000 })).toThrow(
      SeamtranscodeError
    );
    expect(() => resolveSpec({ scrub: { maxFrames: 5000 } })).toThrow(
      SeamtranscodeError
    );
  });
});

describe("isSafeKey", () => {
  test.each([
    ["uploads/abc.mp4", true],
    ["videos/abc/", true],
    ["/etc/passwd", false],
    ["videos/../secrets", false],
    ["./a", false],
    ["a\\b", false],
    ["a\nb", false],
    ["", false],
    [42, false],
  ])("%p → %p", (key, ok) => {
    expect(isSafeKey(key)).toBe(ok);
  });
});

describe("toSeamPlayer", () => {
  const result = {
    playlist: { key: "v/master.m3u8", url: "https://cdn.test/v/master.m3u8" },
    source: { duration: 12.5, fps: 29.97 } as never,
    previews: {
      poster: {
        key: "v/poster.jpg",
        url: "https://cdn.test/v/poster.jpg",
        width: 1280,
        height: 720,
      },
      posterSmall: { key: "v/poster-small.jpg", width: 480, height: 270 },
      scrub: {
        key: "v/scrub.jpg",
        url: "https://cdn.test/v/scrub.jpg",
        width: 3200,
        height: 180,
        frameWidth: 320,
        frameHeight: 180,
        columns: 10,
        count: 12,
        interval: 1,
      },
    },
  };

  test("maps a result to SeamPlayer props", () => {
    expect(toSeamPlayer(result)).toEqual({
      src: "https://cdn.test/v/master.m3u8",
      poster: "https://cdn.test/v/poster.jpg",
      duration: 12.5,
      fps: 29.97,
      thumbnails: {
        url: "https://cdn.test/v/scrub.jpg",
        width: 320,
        height: 180,
        columns: 10,
        count: 12,
        interval: 1,
      },
    });
  });

  test("builds URLs from baseUrl when the storage had none, and says so when neither", () => {
    const bare = {
      ...result,
      playlist: { key: "v/master.m3u8" },
      previews: null,
    };
    expect(toSeamPlayer(bare, { baseUrl: "/media/" }).src).toBe(
      "/media/v/master.m3u8"
    );
    expect(() => toSeamPlayer(bare)).toThrow(/publicUrl/);
  });
});

describe("webhooks", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({
    id: "evt_1",
    type: "transcode.completed",
    job: "job_1",
    data: {},
    metadata: { videoId: "a" },
  });

  test("a signed body verifies and parses", async () => {
    const header = await signWebhook(body, secret);
    const event = await verifyWebhook(body, header, secret);
    expect(event.metadata).toEqual({ videoId: "a" });
  });

  test("tampered, wrongly signed, stale or missing signatures are refused", async () => {
    const header = await signWebhook(body, secret, 1_000_000);
    const now = 1_000_000;
    await expect(
      verifyWebhook(body.replace("a", "b"), header, secret, { now })
    ).rejects.toThrow(WebhookVerificationError);
    await expect(verifyWebhook(body, header, "other", { now })).rejects.toThrow(
      WebhookVerificationError
    );
    await expect(
      verifyWebhook(body, header, secret, { now: now + 301 })
    ).rejects.toThrow(/too old/);
    await expect(verifyWebhook(body, undefined, secret)).rejects.toThrow(
      /Missing/
    );
    await expect(verifyWebhook(body, "garbage", secret)).rejects.toThrow(
      /Malformed/
    );
  });

  test("accepts any of several v1 signatures, for rotating secrets", async () => {
    const header = await signWebhook(body, secret);
    const [t, v1] = header.split(",");
    expect(
      await verifyWebhook(body, `${t},v1=${"0".repeat(64)},${v1}`, secret)
    ).toBeTruthy();
  });

  test("bytes verify the same as text", async () => {
    const header = await signWebhook(body, secret);
    expect(
      await verifyWebhook(new TextEncoder().encode(body), header, secret)
    ).toBeTruthy();
  });
});

describe("Lane", () => {
  test("runs at most `concurrency` at once, in order", async () => {
    const lane = new Lane(1);
    const order: string[] = [];
    let release!: () => void;
    const first = lane.run(
      () =>
        new Promise<void>((r) => {
          order.push("a");
          release = r;
        })
    );
    const second = lane.run(async () => {
      order.push("b");
    });
    expect(lane.pending).toBe(1);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["a", "b"]);
  });

  test("a waiting task whose signal aborts never starts", async () => {
    const lane = new Lane(1);
    let release!: () => void;
    const first = lane.run(() => new Promise<void>((r) => (release = r)));
    const controller = new AbortController();
    let ran = false;
    const second = lane.run(async () => {
      ran = true;
    }, controller.signal);
    controller.abort();
    await expect(second).rejects.toThrow("Aborted");
    release();
    await first;
    expect(ran).toBe(false);
    expect(lane.pending).toBe(0);
  });
});
