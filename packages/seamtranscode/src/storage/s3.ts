import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { joinUrl, type Storage } from "./types";

export type S3StorageOptions = {
  bucket: string;
  /** an existing client; otherwise one is made from the options below */
  client?: S3Client;
  region?: string;
  /** for S3-compatible stores: MinIO, Backblaze B2, DigitalOcean Spaces... */
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
  forcePathStyle?: boolean;
  /** where the bucket is served from, so results carry player-ready URLs */
  publicUrl?: string;
};

export type R2StorageOptions = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** the bucket's public domain, e.g. "https://media.example.com" */
  publicUrl?: string;
};

/** Amazon S3, or any S3-compatible store. Needs `@aws-sdk/client-s3`. */
export const s3 = (options: S3StorageOptions): Storage => {
  const config: S3ClientConfig = {
    region: options.region ?? "auto",
    // R2 and several other stores reject the SDK's default checksums
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  };
  if (options.endpoint) config.endpoint = options.endpoint;
  if (options.credentials) config.credentials = options.credentials;
  if (options.forcePathStyle) config.forcePathStyle = true;
  const client = options.client ?? new S3Client(config);
  const { bucket, publicUrl } = options;

  return {
    get: async (key, file, { signal } = {}) => {
      const res = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        signal ? { abortSignal: signal } : {}
      );
      if (!res.Body) throw new Error(`Empty body for key: ${key}`);
      await pipeline(res.Body as Readable, createWriteStream(file), {
        ...(signal ? { signal } : {}),
      });
    },
    put: async (key, file, { contentType, cacheControl, signal }) => {
      // Segments and images are a few MB at most. Buffering them avoids the
      // SDK's aws-chunked streaming, which R2 doesn't accept.
      const body = await readFile(file);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ...(cacheControl ? { CacheControl: cacheControl } : {}),
        }),
        signal ? { abortSignal: signal } : {}
      );
    },
    ...(publicUrl === undefined
      ? {}
      : { url: (key: string) => joinUrl(publicUrl, key) }),
  };
};

/** Cloudflare R2. Needs `@aws-sdk/client-s3`. */
export const r2 = (options: R2StorageOptions): Storage =>
  s3({
    bucket: options.bucket,
    region: "auto",
    endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    ...(options.publicUrl === undefined
      ? {}
      : { publicUrl: options.publicUrl }),
  });

export type { Storage } from "./types";
