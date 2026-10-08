import { SeamtranscodeError } from "../errors";
import type { RenditionInput } from "../ladder";
import { resolveSpec, type PreviewSizes } from "../previews";

const fail = (message: string): never => {
  throw new SeamtranscodeError("invalid_options", message);
};

/**
 * A storage key a caller may name: relative, no "." or ".." segments, no
 * backslashes or control characters.
 */
export const isSafeKey = (key: unknown): key is string =>
  typeof key === "string" &&
  key.length > 0 &&
  key.length <= 1024 &&
  !key.startsWith("/") &&
  // eslint-disable-next-line no-control-regex
  !/[\u0000-\u001f\u007f\\]/.test(key) &&
  key.split("/").every((part) => part !== "." && part !== "..");

const key = (body: Record<string, unknown>, name: string) => {
  const value = body[name];
  if (!isSafeKey(value)) {
    fail(`"${name}" must be a relative storage key without "." or ".." parts`);
  }
  return (value as string).replace(/\/+$/, "");
};

const webhook = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return fail(`"webhook" must be a URL`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(`"webhook" must be a URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    fail(`"webhook" must be an http(s) URL`);
  }
  return url.toString();
};

const renditions = (value: unknown): RenditionInput[] | undefined => {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 8 ||
    !value.every((v) => Number.isInteger(v) && v >= 64 && v <= 4320)
  ) {
    fail(`"renditions" must be 1–8 sizes between 64 and 4320`);
  }
  return value as number[];
};

const previewSizes = (value: unknown): boolean | PreviewSizes | undefined => {
  if (value === undefined || typeof value === "boolean") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(`"previews" must be true, false or an object of sizes`);
  }
  const v = value as Record<string, unknown>;
  const sizes: PreviewSizes = {};
  if (v.posterSize !== undefined) sizes.posterSize = Number(v.posterSize);
  if (v.smallSize !== undefined) sizes.smallSize = Number(v.smallSize);
  if (typeof v.scrub === "boolean") sizes.scrub = v.scrub;
  else if (typeof v.scrub === "object" && v.scrub !== null) {
    const s = v.scrub as Record<string, unknown>;
    sizes.scrub = {};
    for (const k of [
      "frameSize",
      "maxFrames",
      "minInterval",
      "columns",
    ] as const) {
      if (s[k] !== undefined) sizes.scrub[k] = Number(s[k]);
    }
  }
  resolveSpec(sizes); // bounds-checked: throws invalid_options
  return sizes;
};

const object = (body: unknown) => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    fail("The body must be a JSON object");
  }
  return body as Record<string, unknown>;
};

export type TranscodeBody = {
  input: string;
  output: string;
  renditions?: RenditionInput[];
  previews?: boolean | PreviewSizes;
  webhook?: string;
  metadata?: unknown;
};

export const parseTranscodeBody = (raw: unknown): TranscodeBody => {
  const body = object(raw);
  const result: TranscodeBody = {
    input: key(body, "input"),
    output: key(body, "output"),
  };
  const r = renditions(body.renditions);
  if (r) result.renditions = r;
  const p = previewSizes(body.previews);
  if (p !== undefined) result.previews = p;
  const w = webhook(body.webhook);
  if (w) result.webhook = w;
  if (body.metadata !== undefined) result.metadata = body.metadata;
  return result;
};

export type PreviewsBody = {
  input: string;
  output: string;
  kind?: "video" | "image";
  sizes: PreviewSizes;
  webhook?: string;
  metadata?: unknown;
};

export const parsePreviewsBody = (raw: unknown): PreviewsBody => {
  const body = object(raw);
  const sizes = previewSizes({
    posterSize: body.posterSize,
    smallSize: body.smallSize,
    scrub: body.scrub,
  }) as PreviewSizes;
  const result: PreviewsBody = {
    input: key(body, "input"),
    output: key(body, "output"),
    sizes,
  };
  if (body.kind !== undefined) {
    if (body.kind !== "video" && body.kind !== "image") {
      fail(`"kind" must be "video" or "image"`);
    }
    result.kind = body.kind as "video" | "image";
  }
  const w = webhook(body.webhook);
  if (w) result.webhook = w;
  if (body.metadata !== undefined) result.metadata = body.metadata;
  return result;
};
