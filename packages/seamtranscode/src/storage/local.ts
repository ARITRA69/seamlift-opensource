import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { SeamtranscodeError } from "../errors";
import { joinUrl, type Storage } from "./types";

export type LocalStorageOptions = {
  /**
   * Keys are paths inside this folder, and can't leave it. Without a root,
   * keys are paths relative to the working directory (or absolute).
   */
  root?: string;
  /**
   * Where the folder is served from, e.g. "/" for a Next.js `public` root or
   * "https://cdn.example.com". Results then carry URLs a player can load.
   */
  publicUrl?: string;
};

/** Files on this machine. The default storage. */
export const local = ({
  root,
  publicUrl,
}: LocalStorageOptions = {}): Storage => {
  const base = root ? path.resolve(root) : undefined;

  const resolve = (key: string) => {
    if (!base) return path.resolve(key);
    const full = path.resolve(base, key);
    if (full !== base && !full.startsWith(base + path.sep)) {
      throw new SeamtranscodeError(
        "invalid_options",
        `Key "${key}" is outside the storage root`
      );
    }
    return full;
  };

  return {
    get: async (key, file) => {
      await copyFile(resolve(key), file);
    },
    put: async (key, file) => {
      const dest = resolve(key);
      if (path.resolve(file) === dest) return;
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(file, dest);
    },
    ...(publicUrl === undefined
      ? {}
      : { url: (key: string) => joinUrl(publicUrl, key) }),
  };
};
