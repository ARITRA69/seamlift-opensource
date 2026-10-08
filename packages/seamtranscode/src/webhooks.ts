import type { SeamtranscodeErrorKind } from "./errors";
import type { Previews, PreviewsResult } from "./previews";
import type {
  RenditionResult,
  TranscodeProgress,
  TranscodeResult,
} from "./transcode";

export type WebhookError = {
  kind: SeamtranscodeErrorKind | "internal";
  message: string;
};

/** The `data` of each event type. */
export type WebhookEventData = {
  "transcode.progress": TranscodeProgress;
  "transcode.previews": Previews;
  "transcode.rendition": RenditionResult;
  "transcode.completed": TranscodeResult;
  "transcode.failed": { error: WebhookError };
  "previews.completed": PreviewsResult;
  "previews.failed": { error: WebhookError };
};

export type WebhookEventType = keyof WebhookEventData;

export type WebhookEvent = {
  [T in WebhookEventType]: {
    /** unique per delivery attempt's event; dedupe on it */
    id: string;
    type: T;
    /** the job id the worker answered with */
    job: string;
    createdAt: string;
    data: WebhookEventData[T];
    /** whatever was sent with the job, untouched */
    metadata: unknown;
  };
}[WebhookEventType];

export const SIGNATURE_HEADER = "seamtranscode-signature";

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

const subtle = async (): Promise<SubtleCrypto> =>
  globalThis.crypto?.subtle ??
  ((await import("node:crypto")).webcrypto.subtle as SubtleCrypto);

const encoder = new TextEncoder();

const hmac = async (secret: string, payload: string) => {
  const crypto = await subtle();
  const key = await crypto.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
};

// Same time whatever matches, so the signature can't be found by timing.
const equal = (a: string, b: string) => {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
};

/**
 * The `seamtranscode-signature` header for a body:
 * `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`.
 */
export const signWebhook = async (
  body: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
) => `t=${timestamp},v1=${await hmac(secret, `${timestamp}.${body}`)}`;

/**
 * Check a webhook came from your worker and is recent, and parse it. Pass
 * the raw body, exactly as received. Throws WebhookVerificationError.
 *
 *     const event = await verifyWebhook(await req.text(),
 *       req.headers.get("seamtranscode-signature"), process.env.SEAMTRANSCODE_SECRET);
 */
export const verifyWebhook = async (
  body: string | Uint8Array,
  header: string | null | undefined,
  secret: string,
  options: { tolerance?: number; now?: number } = {}
): Promise<WebhookEvent> => {
  if (!secret) throw new WebhookVerificationError("No secret to verify with");
  if (!header) {
    throw new WebhookVerificationError(`Missing ${SIGNATURE_HEADER} header`);
  }
  const text = typeof body === "string" ? body : new TextDecoder().decode(body);
  const parts = new Map<string, string[]>();
  for (const part of header.split(",")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key || rest.length === 0) continue;
    parts.set(key, [...(parts.get(key) ?? []), rest.join("=")]);
  }
  const timestamp = Number(parts.get("t")?.[0]);
  if (!Number.isInteger(timestamp)) {
    throw new WebhookVerificationError("Malformed signature header");
  }
  const tolerance = options.tolerance ?? 300;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookVerificationError("Webhook timestamp is too old");
  }
  const expected = await hmac(secret, `${timestamp}.${text}`);
  // several v1 values let a worker sign with an old and a new secret at once
  if (!(parts.get("v1") ?? []).some((sig) => equal(sig, expected))) {
    throw new WebhookVerificationError("Webhook signature doesn't match");
  }
  return JSON.parse(text) as WebhookEvent;
};
