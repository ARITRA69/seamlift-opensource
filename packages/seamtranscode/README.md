# seamtranscode

Video in, adaptive HLS, a poster and a filmstrip scrub sheet out. MIT licensed. Run the same Node package locally, in a service, in Docker, or one rendition per worker on Modal or your own queue.

## Install

```sh
npm install seamtranscode
# Install ffmpeg and ffprobe on the machine that encodes:
brew install ffmpeg                 # macOS
# sudo apt-get install ffmpeg       # Debian / Ubuntu
```

Requires Node 18.17+ or Bun. Video encoding and video previews do not require optional dependencies. Install `sharp` for image/SVG previews, and `@aws-sdk/client-s3` for S3/R2 storage.

## From an upload to a player

```ts
import { local, transcode, toSeamPlayer } from "seamtranscode";
const result = await transcode({
  input: "uploads/film.mp4",
  storage: local({ root: "public", publicUrl: "/" }),
  output: "videos/film",
});
const media = toSeamPlayer(result);
// React: <SeamPlayer {...media} title="Film" />
// Plain JS: createSeamPlayer(element, { ...media, title: "Film" })
```

`result` is JSON: `playlist` (master.m3u8), `renditions`, `previews` (poster and scrub sheet), `source` (dimensions, duration, frame rate), and `warnings`. Output files contain a storage `key` and a `url` when the adapter has a public URL. `toSeamPlayer(result, { baseUrl: "/videos" })` supplies URLs when the storage does not. Browser code should import the mapping from `seamtranscode/player`, which does not import Node or ffmpeg.

The defaults are 360, 720 and 1080 short-side pixels, never above the source, libx264, six-second aligned segments, a poster and a scrub sheet. Portrait rotation is respected. Bitrate peaks are capped and measured in the master playlist. Source URLs are not downloaded automatically: use a local file or a storage key.

## Progress and cancellation

```ts
const abort = new AbortController();
await transcode({
  input: "film.mp4",
  output: "out/film",
  encoder: "auto",
  renditions: [360, 720],
  signal: abort.signal,
  onProgress: ({ progress, eta }) => console.log(progress, eta),
  onPreviews: (images) => console.log(images.poster),
  onRendition: (rendition) => console.log("Playable:", rendition.playlist),
});
```

Progress is 0–1. The smallest rendition finishes first; each callback arrives after its outputs have uploaded. `encoder: "auto"` tests VideoToolbox, NVENC or Quick Sync and falls back to libx264. `previews: false` skips all images; `previews: { scrub: false }` skips only the scrub sheet. Abort terminates ffmpeg and cleans temporary files. Output already uploaded before an abort remains in storage.

`SeamtranscodeError` has a `kind`, a readable message and optional ffmpeg log. Kinds include `unsupported_input`, `no_video_stream`, `invalid_options`, `aborted` and `ffmpeg_failed`. Nonfatal preview errors appear in `warnings`. Decoding accepts supported media containers with file-only protocols; renamed playlists and concat inputs are rejected.

## Storage

```sh
npm install @aws-sdk/client-s3
```

```ts
import { transcode } from "seamtranscode";
import { r2, s3 } from "seamtranscode/s3";
const storage = r2({
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucket: "videos",
  publicUrl: "https://cdn.example.com",
});
await transcode({
  storage,
  input: { key: "uploads/film.mp4" },
  output: "videos/film",
});
// S3 / MinIO: s3({ bucket, region, endpoint?, forcePathStyle?, publicUrl? })
```

Any adapter implements `Storage.get(key, file, { signal? })` and `Storage.put(key, file, { contentType, cacheControl?, signal? })`, plus optional `url(key)`. `local({ root })` keeps keys within that folder. Make output prefixes unique per job.

## Previews only

```ts
import { previews } from "seamtranscode";
await previews({ input: "film.mp4", output: "out/previews" });
// With npm install sharp:
await previews({ input: "photo.png", output: "out/photo", kind: "image" });
```

Video posters use a representative frame. Scrub sheets use midpoint frames with metadata matching seamplayer. Image previews respect EXIF rotation and retain transparency. SVGs that reference external resources are refused.

## CLI

```sh
npx seamtranscode film.mp4 -o ./film
npx seamtranscode film.mp4 --renditions 360,720 --no-scrub --json
npx seamtranscode preview ./film       # localhost:4800; needs internet for the player CDN
npx seamtranscode previews photo.png
npx seamtranscode probe film.mp4
npx seamtranscode --help
```

The CLI defaults to `encoder: auto`, writes `seamtranscode.json`, and prints JSON to stdout with `--json`. Progress goes to stderr. `--background` lowers ffmpeg's priority.

## HTTP worker

```ts
import { createServer } from "seamtranscode/server";
import { local } from "seamtranscode";
const worker = createServer({
  storage: local({ root: "./media", publicUrl: "https://cdn.example.com" }),
  secret: process.env.SEAMTRANSCODE_SECRET!,
  concurrency: { transcode: 1, previews: 2 },
});
await worker.listen(8100);
// On shutdown: await worker.close();
```

`GET /health` is public. Every other route requires `Authorization: Bearer <secret>`.

| Route              | Behavior                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `POST /transcode`  | Queue `{ input: "uploads/film.mp4", output: "videos/film", webhook?, metadata? }`; returns 202 and a job id |
| `POST /previews`   | Queue previews with the same input/output keys                                                              |
| `GET /jobs/:id`    | Status, progress, result or error                                                                           |
| `DELETE /jobs/:id` | Cancel a queued or running job                                                                              |

Jobs and history are in memory. Use a durable queue and the library for persistence across restarts or horizontal scaling. Input/output keys are checked; `allowKey` can restrict them further. Put the worker behind your backend; keep storage credentials server-side.

Webhooks are signed with HMAC and a timestamp. Events include `transcode.progress`, `transcode.previews`, `transcode.rendition`, `transcode.completed`, `transcode.failed`, `previews.completed`, and `previews.failed`. Metadata is echoed. Final events retry with backoff; progress events do not.

```ts
import { verifyWebhook } from "seamtranscode/webhooks";
const event = await verifyWebhook(rawBody, signatureHeader, webhookSecret);
// Use the original request bytes and the seamtranscode-signature header.
```

## Service configuration and Docker

```sh
SEAMTRANSCODE_SECRET=your-secret SEAMTRANSCODE_ROOT=./media npx seamtranscode serve
# From the repository:
docker build -t seamtranscode packages/seamtranscode
docker run --rm -p 8100:8100 -e SEAMTRANSCODE_SECRET=your-secret \
  -e SEAMTRANSCODE_ROOT=/media -v "$PWD/media:/media" seamtranscode
```

The mounted local folder must be writable by the container's `node` user. The worker does not serve output media; serve the folder separately or use S3/R2.

| Variable                                                                 | Default / purpose                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `SEAMTRANSCODE_STORAGE`                                                  | `local`, or `r2` if R2_ACCOUNT_ID is set, or `s3` if S3_BUCKET is set |
| `SEAMTRANSCODE_ROOT`                                                     | Working directory; local storage root                                 |
| `SEAMTRANSCODE_PUBLIC_URL`                                               | Public base URL for output files                                      |
| `SEAMTRANSCODE_SECRET`                                                   | Required worker authentication secret                                 |
| `SEAMTRANSCODE_WEBHOOK_SECRET`                                           | Defaults to worker secret                                             |
| `SEAMTRANSCODE_WEBHOOK_URL`                                              | Default callback URL                                                  |
| `SEAMTRANSCODE_PORT`                                                     | 8100                                                                  |
| `SEAMTRANSCODE_WORK_DIR`                                                 | OS temporary directory                                                |
| `SEAMTRANSCODE_RENDITIONS`                                               | `360,720,1080`                                                        |
| `SEAMTRANSCODE_ENCODER`                                                  | libx264                                                               |
| `SEAMTRANSCODE_CONCURRENCY`                                              | One transcode at a time                                               |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | R2 storage                                                            |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`           | S3-compatible storage; normal AWS credentials apply                   |

## Distributed compute

```ts
import {
  planTranscode,
  encodeRendition,
  finishTranscode,
  previews,
} from "seamtranscode";
const plan = await planTranscode({
  storage,
  input: { key: "uploads/film.mp4" },
  output: "videos/film",
});
// Send this plain JSON plan to your queue; each worker runs one rendition.
const renditions = await Promise.all(
  plan.renditions.map((r) => encodeRendition(plan, r.name, { storage }))
);
const images = await previews({
  storage,
  input: plan.input,
  output: plan.output,
  kind: "video",
});
const result = await finishTranscode(plan, renditions, {
  storage,
  previews: images,
});
```

On different machines, use shared object storage and an input key. A local input path works only if it exists on each worker. All workers use the plan's settings, so segment boundaries match. `sourceCache` can point to a shared mounted file to avoid repeated downloads.

The equivalent CLI steps are `plan --key`, `encode --plan @plan.json --rendition 720p`, and `finish --plan @plan.json --results @results.json`. The [Modal recipe](../../recipes/modal/README.md) orchestrates these steps with one container per rendition. It runs the same Node encoder; there is no second Python transcoder.

## Development

```sh
bun run check
bun run verify:package
```

Tests include real ffmpeg video/portrait/image encoding, aligned segments, cancellation, storage, HTTP jobs and signed webhooks. Packing verification installs an isolated tarball with and without optional peers, exercises the Node CLI, and checks ESM/CommonJS declarations.

## License

MIT
