/**
 * Where sources come from and outputs go. Two functions, so any store
 * works: see `local()` and `s3()` / `r2()` from "seamtranscode/s3".
 */
export type Storage = {
  /** Copy the object at `key` into the local file `file`. */
  get(
    key: string,
    file: string,
    options?: { signal?: AbortSignal }
  ): Promise<void>;
  /** Store the local file `file` at `key`. */
  put(
    key: string,
    file: string,
    options: {
      contentType: string;
      cacheControl?: string;
      signal?: AbortSignal;
    }
  ): Promise<void>;
  /** The public URL a player can load `key` from, if the store serves files. */
  url?(key: string): string;
};

/** Keys of objects that don't exist are never retried. */
export const isMissing = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string; Code?: string }).code;
  return (
    code === "ENOENT" ||
    err.name === "NoSuchKey" ||
    err.name === "NotFound" ||
    /NoSuchKey|does not exist|not found/i.test(err.message)
  );
};

export const joinKey = (...parts: string[]) =>
  parts
    .filter(Boolean)
    .join("/")
    .replace(/\/{2,}/g, "/");

/** A public URL base and a key, with exactly one slash between them. */
export const joinUrl = (base: string, key: string) =>
  `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
