import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { deliver, makeEvent, type Logger } from "../deliver";
import type { EncoderChoice } from "../encoders";
import { isAbort, SeamtranscodeError } from "../errors";
import type { FfmpegOptions } from "../ffmpeg";
import type { RenditionInput } from "../ladder";
import { previews, type PreviewSizes } from "../previews";
import type { Storage } from "../storage/types";
import { transcode } from "../transcode";
import type {
  WebhookError,
  WebhookEventData,
  WebhookEventType,
} from "../webhooks";
import { Lane } from "./lane";
import {
  parsePreviewsBody,
  parseTranscodeBody,
  type PreviewsBody,
  type TranscodeBody,
} from "./validate";

export { isSafeKey } from "./validate";

export type ServerOptions = FfmpegOptions & {
  storage: Storage;
  /**
   * Callers send it as `Authorization: Bearer <secret>`. It also signs
   * webhooks, unless `webhookSecret` is set.
   */
  secret: string;
  webhookSecret?: string;
  /** where events go for jobs that don't name a webhook */
  webhookUrl?: string;
  /** defaults for every job */
  renditions?: readonly RenditionInput[];
  encoder?: EncoderChoice;
  preset?: string;
  segmentDuration?: number;
  cacheControl?: string;
  /**
   * Jobs at once. Encodes saturate every core, so one at a time gives the
   * job in front the fastest time to playable; previews take seconds and
   * run beside it. Default { transcode: 1, previews: 2 }.
   */
  concurrency?: { transcode?: number; previews?: number };
  /** veto keys beyond the built-in checks, e.g. to keep outputs in one folder */
  allowKey?: (key: string, use: "input" | "output") => boolean;
  workDir?: string;
  /** default console; false for silence */
  logger?: Logger | false;
  /** finished jobs kept for GET /jobs/:id; default 1000 */
  history?: number;
};

type JobStatus = "queued" | "running" | "completed" | "failed" | "canceled";

type Job = {
  id: string;
  type: "transcode" | "previews";
  status: JobStatus;
  progress: number;
  input: string;
  output: string;
  metadata: unknown;
  createdAt: string;
  finishedAt?: string;
  result?: unknown;
  error?: WebhookError;
  warnings: string[];
  webhook?: string;
  controller: AbortController;
};

const MAX_BODY = 64 * 1024;

const publicJob = (job: Job) => ({
  id: job.id,
  type: job.type,
  status: job.status,
  progress: job.progress,
  input: job.input,
  output: job.output,
  metadata: job.metadata,
  createdAt: job.createdAt,
  ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
  ...(job.result !== undefined ? { result: job.result } : {}),
  ...(job.error ? { error: job.error } : {}),
});

const toError = (err: unknown): WebhookError =>
  err instanceof SeamtranscodeError
    ? { kind: err.kind, message: err.message.slice(0, 1000) }
    : {
        kind: "internal",
        message: (err instanceof Error ? err.message : String(err)).slice(
          0,
          1000
        ),
      };

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly kind: string,
    message: string
  ) {
    super(message);
  }
}

const readBody = (req: IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, "too_large", "Body over 64 KB"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        reject(new HttpError(400, "invalid_json", "The body isn't valid JSON"));
      }
    });
    req.on("error", reject);
  });

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

/**
 * An HTTP worker: POST /transcode and /previews queue jobs and answer with
 * an id; signed webhooks report progress and results. See the README for
 * the full contract.
 */
export const createServer = (options: ServerOptions) => {
  if (!options.secret) {
    throw new SeamtranscodeError(
      "invalid_options",
      "createServer needs a secret"
    );
  }
  const logger: Logger =
    options.logger === false
      ? { log: () => {}, error: () => {} }
      : (options.logger ?? console);
  const webhookSecret = options.webhookSecret ?? options.secret;
  const lanes = {
    transcode: new Lane(options.concurrency?.transcode ?? 1),
    previews: new Lane(options.concurrency?.previews ?? 2),
  };
  const jobs = new Map<string, Job>();
  const history = options.history ?? 1000;
  const expected = createHash("sha256")
    .update(`Bearer ${options.secret}`)
    .digest();
  const tools: FfmpegOptions = {
    ...(options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {}),
    ...(options.ffprobePath ? { ffprobePath: options.ffprobePath } : {}),
    ...(options.priority ? { priority: options.priority } : {}),
  };

  // Hashed first, so the compare takes the same time whatever the length.
  const authorized = (header: string | undefined) =>
    timingSafeEqual(
      createHash("sha256")
        .update(header ?? "")
        .digest(),
      expected
    );

  const checkKeys = (body: { input: string; output: string }) => {
    if (options.allowKey && !options.allowKey(body.input, "input")) {
      throw new HttpError(
        403,
        "forbidden_key",
        `Input key not allowed: ${body.input}`
      );
    }
    if (options.allowKey && !options.allowKey(body.output, "output")) {
      throw new HttpError(
        403,
        "forbidden_key",
        `Output key not allowed: ${body.output}`
      );
    }
  };

  const log = (job: Job, message: string) =>
    logger.log(`[${job.type} ${job.id.slice(4, 12)}] ${message}`);

  const emit = <T extends WebhookEventType>(
    job: Job,
    type: T,
    data: WebhookEventData[T]
  ) => {
    if (!job.webhook) return Promise.resolve(false);
    return deliver(
      job.webhook,
      webhookSecret,
      makeEvent(type, job.id, data, job.metadata),
      logger
    );
  };

  const forget = () => {
    const finished = [...jobs.values()].filter((j) => j.finishedAt);
    for (const job of finished.slice(
      0,
      Math.max(0, finished.length - history)
    )) {
      jobs.delete(job.id);
    }
  };

  const settle = async (
    job: Job,
    outcome: { result: unknown } | { error: unknown }
  ) => {
    job.finishedAt = new Date().toISOString();
    const prefix = job.type;
    if ("result" in outcome) {
      job.status = "completed";
      job.progress = 1;
      job.result = outcome.result;
      log(job, "completed");
      await emit(job, `${prefix}.completed`, outcome.result as never);
    } else {
      job.status = job.controller.signal.aborted ? "canceled" : "failed";
      job.error = job.controller.signal.aborted
        ? { kind: "aborted", message: "Canceled" }
        : toError(outcome.error);
      log(job, `${job.status}: ${job.error.message}`);
      await emit(job, `${prefix}.failed`, { error: job.error });
    }
    forget();
  };

  const newJob = (
    type: Job["type"],
    body: {
      input: string;
      output: string;
      webhook?: string;
      metadata?: unknown;
    }
  ): Job => {
    const webhook = body.webhook ?? options.webhookUrl;
    const job: Job = {
      id: `job_${randomUUID()}`,
      type,
      status: "queued",
      progress: 0,
      input: body.input,
      output: body.output,
      metadata: body.metadata ?? null,
      createdAt: new Date().toISOString(),
      warnings: [],
      controller: new AbortController(),
      ...(webhook ? { webhook } : {}),
    };
    jobs.set(job.id, job);
    log(job, `queued ${body.input} → ${body.output}`);
    return job;
  };

  const startTranscode = (job: Job, body: TranscodeBody) => {
    const signal = job.controller.signal;
    const live = () => job.status === "queued" || job.status === "running";
    const sizes =
      body.previews === false
        ? null
        : typeof body.previews === "object"
          ? body.previews
          : {};
    let lastSent = 0;
    let lastProgress = -1;

    // Previews run in their own lane, so a queued upload still gets its
    // poster while another video encodes.
    const previewsDone = sizes
      ? lanes.previews
          .run(async () => {
            if (job.status === "queued") job.status = "running";
            const made = await previews({
              ...tools,
              input: { key: body.input },
              output: body.output,
              storage: options.storage,
              kind: "video",
              ...sizes,
              signal,
              ...(options.cacheControl
                ? { cacheControl: options.cacheControl }
                : {}),
              ...(options.workDir ? { workDir: options.workDir } : {}),
            });
            const result = {
              poster: made.poster,
              posterSmall: made.posterSmall,
              scrub: made.scrub,
            };
            job.warnings.push(...made.warnings);
            if (live()) void emit(job, "transcode.previews", result);
            return result;
          }, signal)
          .catch((err: unknown) => {
            if (!isAbort(err))
              job.warnings.push(`Previews failed: ${toError(err).message}`);
            return null;
          })
      : Promise.resolve(null);

    const encoded = lanes.transcode.run(async () => {
      job.status = "running";
      log(job, "encoding");
      return transcode({
        ...tools,
        input: { key: body.input },
        output: body.output,
        storage: options.storage,
        previews: false,
        signal,
        ...((body.renditions ?? options.renditions)
          ? { renditions: body.renditions ?? options.renditions }
          : {}),
        ...(options.encoder ? { encoder: options.encoder } : {}),
        ...(options.preset ? { preset: options.preset } : {}),
        ...(options.segmentDuration
          ? { segmentDuration: options.segmentDuration }
          : {}),
        ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}),
        ...(options.workDir ? { workDir: options.workDir } : {}),
        onProgress: (p) => {
          job.progress = p.progress;
          const now = Date.now();
          if (now - lastSent < 1000 || p.progress - lastProgress < 0.01) return;
          lastSent = now;
          lastProgress = p.progress;
          void emit(job, "transcode.progress", p);
        },
        onRendition: (r) => {
          log(job, `${r.name} ready`);
          void emit(job, "transcode.rendition", r);
        },
      });
    }, signal);

    void Promise.allSettled([encoded, previewsDone]).then(
      async ([enc, prev]) => {
        if (enc.status === "rejected")
          return settle(job, { error: enc.reason });
        const preview = prev.status === "fulfilled" ? prev.value : null;
        await settle(job, {
          result: {
            ...enc.value,
            previews: preview,
            warnings: [...enc.value.warnings, ...job.warnings],
          },
        });
      }
    );
  };

  const startPreviews = (job: Job, body: PreviewsBody) => {
    const signal = job.controller.signal;
    void lanes.previews
      .run(async () => {
        job.status = "running";
        return previews({
          ...tools,
          input: { key: body.input },
          output: body.output,
          storage: options.storage,
          ...body.sizes,
          ...(body.kind ? { kind: body.kind } : {}),
          signal,
          ...(options.cacheControl
            ? { cacheControl: options.cacheControl }
            : {}),
          ...(options.workDir ? { workDir: options.workDir } : {}),
        });
      }, signal)
      .then(
        (result) => settle(job, { result }),
        (error: unknown) => settle(job, { error })
      );
  };

  const route = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/health" && req.method === "GET") {
      return send(res, 200, {
        ok: true,
        transcode: {
          active: lanes.transcode.active,
          pending: lanes.transcode.pending,
        },
        previews: {
          active: lanes.previews.active,
          pending: lanes.previews.pending,
        },
      });
    }
    if (!authorized(req.headers.authorization)) {
      throw new HttpError(
        401,
        "unauthorized",
        "Send Authorization: Bearer <secret>"
      );
    }

    if (path === "/transcode" || path === "/previews") {
      if (req.method !== "POST")
        throw new HttpError(405, "method_not_allowed", "Use POST");
      const raw = await readBody(req);
      if (path === "/transcode") {
        const body = parseTranscodeBody(raw);
        checkKeys(body);
        const job = newJob("transcode", body);
        startTranscode(job, body);
        return send(res, 202, { id: job.id });
      }
      const body = parsePreviewsBody(raw);
      checkKeys(body);
      const job = newJob("previews", body);
      startPreviews(job, body);
      return send(res, 202, { id: job.id });
    }

    const match = /^\/jobs\/([^/]+)$/.exec(path);
    if (match) {
      const job = jobs.get(decodeURIComponent(match[1]!));
      if (!job) throw new HttpError(404, "not_found", "No such job");
      if (req.method === "GET") return send(res, 200, publicJob(job));
      if (req.method === "DELETE") {
        if (!job.finishedAt) job.controller.abort();
        return send(res, 202, { id: job.id });
      }
      throw new HttpError(405, "method_not_allowed", "Use GET or DELETE");
    }
    throw new HttpError(404, "not_found", "Not found");
  };

  /** A Node request handler, to mount inside your own server. */
  const handler = (req: IncomingMessage, res: ServerResponse) => {
    route(req, res).catch((err: unknown) => {
      if (err instanceof HttpError) {
        return send(res, err.status, {
          error: { kind: err.kind, message: err.message },
        });
      }
      if (err instanceof SeamtranscodeError && err.kind === "invalid_options") {
        return send(res, 400, {
          error: { kind: "invalid_request", message: err.message },
        });
      }
      logger.error("[server]", err);
      send(res, 500, {
        error: { kind: "internal", message: "Internal error" },
      });
    });
  };

  let server: http.Server | undefined;

  return {
    handler,
    /** Start listening; resolves with the port (useful with port 0). */
    listen: (port = 8100, host = "0.0.0.0") =>
      new Promise<number>((resolve, reject) => {
        server = http.createServer(handler);
        server.once("error", reject);
        server.listen(port, host, () => {
          const address = server!.address() as AddressInfo;
          logger.log(
            `seamtranscode listening on http://localhost:${address.port}`
          );
          resolve(address.port);
        });
      }),
    /** Stop listening and cancel every job that hasn't finished. */
    close: () =>
      new Promise<void>((resolve) => {
        for (const job of jobs.values())
          if (!job.finishedAt) job.controller.abort();
        if (!server) return resolve();
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
    /** The job, as GET /jobs/:id shows it. */
    job: (id: string) => {
      const job = jobs.get(id);
      return job ? publicJob(job) : undefined;
    },
  };
};

export type SeamtranscodeServer = ReturnType<typeof createServer>;
export type { PreviewSizes, RenditionInput, Storage };
