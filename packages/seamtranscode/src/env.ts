import { SeamtranscodeError } from "./errors";
import { local } from "./storage/local";
import type { Storage } from "./storage/types";

type Env = Record<string, string | undefined>;

/**
 * Storage from environment variables, for the CLI, Docker and Modal:
 *
 *   SEAMTRANSCODE_STORAGE   local | s3 | r2 (default: r2 if R2_ACCOUNT_ID is
 *                           set, s3 if S3_BUCKET is, else local)
 *   SEAMTRANSCODE_ROOT      local: the folder keys live in (default: cwd)
 *   SEAMTRANSCODE_PUBLIC_URL  where the files are served from
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_FORCE_PATH_STYLE, and the usual
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or any AWS credential source)
 */
export const storageFromEnv = async (
  env: Env = process.env
): Promise<Storage> => {
  const kind =
    env.SEAMTRANSCODE_STORAGE ??
    (env.R2_ACCOUNT_ID ? "r2" : env.S3_BUCKET ? "s3" : "local");
  const publicUrl = env.SEAMTRANSCODE_PUBLIC_URL;
  const withUrl = publicUrl ? { publicUrl } : {};

  if (kind === "local") {
    return local({ root: env.SEAMTRANSCODE_ROOT ?? process.cwd(), ...withUrl });
  }
  if (kind !== "s3" && kind !== "r2") {
    throw new SeamtranscodeError(
      "invalid_options",
      `SEAMTRANSCODE_STORAGE must be local, s3 or r2 (got "${kind}")`
    );
  }

  let adapters: typeof import("./storage/s3");
  try {
    adapters = await import("./storage/s3");
  } catch (err) {
    throw new SeamtranscodeError(
      "invalid_options",
      "S3 and R2 storage need the AWS SDK: npm install @aws-sdk/client-s3",
      { cause: err }
    );
  }

  const need = (name: string) => {
    const value = env[name];
    if (!value) {
      throw new SeamtranscodeError(
        "invalid_options",
        `Set ${name} for ${kind} storage`
      );
    }
    return value;
  };

  if (kind === "r2") {
    return adapters.r2({
      accountId: need("R2_ACCOUNT_ID"),
      accessKeyId: need("R2_ACCESS_KEY_ID"),
      secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
      bucket: env.R2_BUCKET ?? env.R2_BUCKET_NAME ?? need("R2_BUCKET"),
      ...withUrl,
    });
  }
  const region = env.S3_REGION ?? env.AWS_REGION;
  return adapters.s3({
    bucket: need("S3_BUCKET"),
    ...(region ? { region } : {}),
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    ...(env.S3_FORCE_PATH_STYLE === "true" ? { forcePathStyle: true } : {}),
    ...withUrl,
  });
};
