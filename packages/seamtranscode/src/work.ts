import { access, mkdtemp, mkdir, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isAbort, SeamtranscodeError, throwIfAborted } from "./errors";
import { local } from "./storage/local";
import { isMissing, joinKey, type Storage } from "./storage/types";

/**
 * A file on this machine (a path), or an object in the storage (a key).
 */
export type Input = string | { key: string };

/** Something written to the storage, with its URL when the store serves it. */
export type OutputFile = { key: string; url?: string };

export const inputName = (input: Input) =>
  typeof input === "string" ? input : input.key;

export const defaultStorage = () => local();

export const outputFile = (storage: Storage, key: string): OutputFile =>
  storage.url ? { key, url: storage.url(key) } : { key };

export const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false
  );

export const makeWorkDir = async (workDir?: string) => {
  const base = workDir ?? path.join(os.tmpdir(), "seamtranscode");
  await mkdir(base, { recursive: true });
  return mkdtemp(path.join(base, "job-"));
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Long transfers drop now and then; a missing object never comes back.
const withRetry = async <T>(
  action: string,
  fn: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    throwIfAborted(signal);
    try {
      return await fn();
    } catch (err) {
      if (isAbort(err) || signal?.aborted) {
        throw new SeamtranscodeError("aborted", "Aborted");
      }
      if (err instanceof SeamtranscodeError) throw err;
      if (isMissing(err) || attempt >= 3) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new SeamtranscodeError("storage", `${action}: ${reason}`, {
          cause: err,
        });
      }
      await sleep(1000 * attempt);
    }
  }
};

/** A local path for the input: the file itself, or a download into `dest`. */
export const fetchInput = async (
  input: Input,
  storage: Storage,
  dest: string,
  signal?: AbortSignal
) => {
  if (typeof input === "string") {
    const file = path.resolve(input);
    if (!(await exists(file))) {
      throw new SeamtranscodeError("storage", `No file at ${input}`);
    }
    return file;
  }
  await withRetry(
    `Couldn't read ${input.key}`,
    () => storage.get(input.key, dest, signal ? { signal } : {}),
    signal
  );
  return dest;
};

export const contentTypeFor = (file: string) => {
  switch (path.extname(file).toLowerCase()) {
    case ".m3u8":
      return "application/vnd.apple.mpegurl";
    case ".ts":
      return "video/mp2t";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
};

export const putFile = (
  storage: Storage,
  key: string,
  file: string,
  options: { cacheControl?: string; signal?: AbortSignal } = {}
) =>
  withRetry(
    `Couldn't write ${key}`,
    () =>
      storage.put(key, file, {
        contentType: contentTypeFor(file),
        ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      }),
    options.signal
  );

const UPLOAD_CONCURRENCY = 8;

/** Every file in `dir` (flat), to `prefix/<name>`; `last` goes up last. */
export const putDir = async (
  storage: Storage,
  prefix: string,
  dir: string,
  options: { last?: string; cacheControl?: string; signal?: AbortSignal } = {}
) => {
  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name !== options.last)
    .map((e) => e.name);
  let next = 0;
  const worker = async () => {
    while (next < names.length) {
      const name = names[next++]!;
      await putFile(
        storage,
        joinKey(prefix, name),
        path.join(dir, name),
        options
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(UPLOAD_CONCURRENCY, names.length) }, worker)
  );
  // The playlist last, so nothing can load it before its segments exist.
  if (options.last) {
    await putFile(
      storage,
      joinKey(prefix, options.last),
      path.join(dir, options.last),
      options
    );
  }
};
