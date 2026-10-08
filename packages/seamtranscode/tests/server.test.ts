// Needs ffmpeg and ffprobe on PATH.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer, type SeamtranscodeServer } from "../src/server/index";
import { local } from "../src/storage/local";
import { verifyWebhook, type WebhookEvent } from "../src/webhooks";
import { makeClip, tempDir } from "./helpers";

const SECRET = "test-secret";
let dir = "";
let cleanup = async () => {};
let server: SeamtranscodeServer;
let base = "";
let receiver: ReturnType<typeof Bun.serve>;
const events: WebhookEvent[] = [];
const waiters: {
  match: (e: WebhookEvent) => boolean;
  resolve: (e: WebhookEvent) => void;
}[] = [];

const waitFor = (match: (e: WebhookEvent) => boolean) =>
  new Promise<WebhookEvent>((resolve) => {
    const seen = events.find(match);
    if (seen) return resolve(seen);
    waiters.push({ match, resolve });
  });

const api = (pathname: string, init: RequestInit & { json?: unknown } = {}) =>
  fetch(`${base}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
      ...init.headers,
    },
    ...(init.json !== undefined
      ? { body: JSON.stringify(init.json), method: init.method ?? "POST" }
      : {}),
  });

beforeAll(async () => {
  ({ dir, cleanup } = await tempDir());
  const root = path.join(dir, "bucket");
  await mkdir(path.join(root, "uploads"), { recursive: true });
  const clip = await makeClip(path.join(dir, "clip.mp4"), { seconds: 8 });
  await copyFile(clip, path.join(root, "uploads/clip.mp4"));
  await makeClip(path.join(root, "uploads/long.mp4"), {
    seconds: 60,
    width: 1280,
    height: 720,
  });

  // A receiver that only believes signed events.
  receiver = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const body = await req.text();
      try {
        const event = await verifyWebhook(
          body,
          req.headers.get("seamtranscode-signature"),
          SECRET
        );
        events.push(event);
        for (const w of waiters.filter((w) => w.match(event))) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(event);
        }
        return new Response("ok");
      } catch {
        return new Response("bad signature", { status: 400 });
      }
    },
  });

  server = createServer({
    storage: local({ root, publicUrl: "https://cdn.test" }),
    secret: SECRET,
    webhookUrl: `http://127.0.0.1:${receiver.port}/hooks`,
    renditions: [360],
    logger: false,
  });
  base = `http://127.0.0.1:${await server.listen(0, "127.0.0.1")}`;
});

afterAll(async () => {
  await server.close();
  receiver.stop(true);
  await cleanup();
});

describe("server", () => {
  test("health needs no secret; everything else does", async () => {
    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      ok: true,
      transcode: { active: 0, pending: 0 },
    });
    const denied = await fetch(`${base}/transcode`, {
      method: "POST",
      body: "{}",
    });
    expect(denied.status).toBe(401);
    const wrong = await fetch(`${base}/transcode`, {
      method: "POST",
      headers: { authorization: "Bearer nope" },
    });
    expect(wrong.status).toBe(401);
  });

  test("bad requests say what's wrong", async () => {
    const traversal = await api("/transcode", {
      json: { input: "../etc/passwd", output: "x" },
    });
    expect(traversal.status).toBe(400);
    expect(await traversal.json()).toMatchObject({
      error: { kind: "invalid_request" },
    });
    const sizes = await api("/transcode", {
      json: { input: "a.mp4", output: "x", renditions: [99999] },
    });
    expect(sizes.status).toBe(400);
    const json = await api("/transcode", { method: "POST", body: "{nope" });
    expect(json.status).toBe(400);
    expect((await api("/jobs/job_missing")).status).toBe(404);
  });

  test("a transcode job: signed events in order, metadata echoed, result stored", async () => {
    const res = await api("/transcode", {
      json: {
        input: "uploads/clip.mp4",
        output: "videos/clip",
        metadata: { videoId: "v_1" },
      },
    });
    expect(res.status).toBe(202);
    const { id } = (await res.json()) as { id: string };

    const done = await waitFor(
      (e) =>
        e.job === id &&
        (e.type === "transcode.completed" || e.type === "transcode.failed")
    );
    expect(done.type).toBe("transcode.completed");
    expect(done.metadata).toEqual({ videoId: "v_1" });
    if (done.type !== "transcode.completed") return;
    expect(done.data.playlist.url).toBe(
      "https://cdn.test/videos/clip/master.m3u8"
    );
    expect(done.data.previews?.scrub?.count).toBe(8);

    const mine = events.filter((e) => e.job === id).map((e) => e.type);
    expect(mine).toContain("transcode.rendition");
    expect(mine).toContain("transcode.previews");
    expect(mine.at(-1)).toBe("transcode.completed");

    const job = (await (await api(`/jobs/${id}`)).json()) as {
      status: string;
      progress: number;
    };
    expect(job.status).toBe("completed");
    expect(job.progress).toBe(1);
  }, 120_000);

  test("a failing job reports why", async () => {
    const res = await api("/transcode", {
      json: { input: "uploads/missing.mp4", output: "videos/missing" },
    });
    const { id } = (await res.json()) as { id: string };
    const failed = await waitFor(
      (e) => e.job === id && e.type === "transcode.failed"
    );
    if (failed.type !== "transcode.failed")
      throw new Error("expected a failure");
    expect(failed.data.error.kind).toBe("storage");
  }, 60_000);

  test("DELETE cancels a running job", async () => {
    const res = await api("/transcode", {
      json: {
        input: "uploads/long.mp4",
        output: "videos/long",
        renditions: [720],
        previews: false,
      },
    });
    const { id } = (await res.json()) as { id: string };
    await waitFor((e) => e.job === id && e.type === "transcode.progress");
    expect((await api(`/jobs/${id}`, { method: "DELETE" })).status).toBe(202);
    const failed = await waitFor(
      (e) => e.job === id && e.type === "transcode.failed"
    );
    if (failed.type !== "transcode.failed")
      throw new Error("expected a failure");
    expect(failed.data.error.kind).toBe("aborted");
    const job = (await (await api(`/jobs/${id}`)).json()) as { status: string };
    expect(job.status).toBe("canceled");
  }, 60_000);

  test("a previews job on its own", async () => {
    const res = await api("/previews", {
      json: {
        input: "uploads/clip.mp4",
        output: "previews/clip",
        scrub: false,
        posterSize: 640,
      },
    });
    const { id } = (await res.json()) as { id: string };
    const done = await waitFor(
      (e) => e.job === id && e.type === "previews.completed"
    );
    if (done.type !== "previews.completed")
      throw new Error("expected previews");
    expect(done.data.poster.width).toBe(640);
    expect(done.data.scrub).toBeNull();
  }, 60_000);
});
