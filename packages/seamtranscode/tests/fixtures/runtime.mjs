import console from "node:console";
import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import * as root from "seamtranscode";
import * as server from "seamtranscode/server";
import * as webhooks from "seamtranscode/webhooks";
import * as player from "seamtranscode/player";

const require = createRequire(import.meta.url);

// The root and every entry but s3 load without the optional peers installed.
for (const mod of [root, require("seamtranscode")]) {
  for (const name of [
    "transcode",
    "planTranscode",
    "encodeRendition",
    "finishTranscode",
    "previews",
    "probe",
    "local",
    "toSeamPlayer",
    "verifyWebhook",
    "SeamtranscodeError",
  ]) {
    assert.equal(typeof mod[name], "function", `missing export ${name}`);
  }
}
for (const mod of [server, require("seamtranscode/server")]) {
  assert.equal(typeof mod.createServer, "function");
}
for (const mod of [webhooks, require("seamtranscode/webhooks")]) {
  const body = '{"type":"transcode.completed"}';
  const header = await mod.signWebhook(body, "s");
  assert.equal(
    (await mod.verifyWebhook(body, header, "s")).type,
    "transcode.completed"
  );
}
for (const mod of [player, require("seamtranscode/player")]) {
  const media = mod.toSeamPlayer(
    {
      playlist: { key: "a/master.m3u8" },
      previews: null,
      source: { duration: 3, fps: 25 },
    },
    { baseUrl: "/" }
  );
  assert.equal(media.src, "/a/master.m3u8");
}

// s3 says what to install when the SDK is missing
await assert.rejects(import("seamtranscode/s3"));

console.log("runtime ok");
