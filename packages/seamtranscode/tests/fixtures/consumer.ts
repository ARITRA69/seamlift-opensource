import {
  local,
  previews,
  SeamtranscodeError,
  toSeamPlayer,
  transcode,
  type Storage,
  type TranscodeResult,
  type WebhookEvent,
} from "seamtranscode";
import { r2, s3 } from "seamtranscode/s3";
import { createServer } from "seamtranscode/server";
import { verifyWebhook } from "seamtranscode/webhooks";
import {
  toSeamPlayer as clientSafe,
  type SeamPlayerMedia,
} from "seamtranscode/player";

export const run = async (): Promise<SeamPlayerMedia> => {
  const storage: Storage = r2({
    accountId: "a",
    accessKeyId: "b",
    secretAccessKey: "c",
    bucket: "d",
    publicUrl: "https://cdn.example.com",
  });
  const result: TranscodeResult = await transcode({
    storage,
    input: { key: "uploads/a.mp4" },
    output: "videos/a",
    renditions: [360, { size: 720, bitrate: 3000 }],
    encoder: "auto",
    previews: { scrub: { maxFrames: 100 } },
    onProgress: ({ progress, eta }) => void [progress, eta],
    onRendition: (r) => void r.playlist.url,
    onPreviews: (p) => void p.poster.width,
  });
  await previews({ input: "a.png", output: "out", storage: local() });
  createServer({ storage: s3({ bucket: "b" }), secret: "s" });
  const event: WebhookEvent = await verifyWebhook("{}", "t=1,v1=x", "s");
  if (event.type === "transcode.completed") void event.data.playlist.key;
  try {
    throw new SeamtranscodeError("aborted", "x");
  } catch (err) {
    if (err instanceof SeamtranscodeError && err.kind === "unsupported_input")
      return clientSafe(result);
  }
  return toSeamPlayer(result);
};
