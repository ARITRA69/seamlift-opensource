import process from "node:process";
import { setTimeout, clearTimeout } from "node:timers";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";

const { fetch } = globalThis;

const manifest = JSON.parse(await readFile("clip/seamtranscode.json", "utf8"));
manifest.source.codec = "</script><script>unsafe()</script>";
await writeFile("clip/seamtranscode.json", JSON.stringify(manifest));
const child = spawn(
  process.execPath,
  ["node_modules/.bin/seamtranscode", "preview", "clip", "--port", "0"],
  { stdio: ["ignore", "ignore", "pipe"] }
);
try {
  const url = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(new Error("Preview did not start")),
      10000
    );
    child.once("error", reject);
    child.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Preview exited early"));
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
  });
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert(
    html.includes(
      '"react-dom/client":"https://esm.sh/react-dom@19.2.0/client?external=react"'
    )
  );
  assert(!html.includes("<script>unsafe()"));
  assert(html.includes("\\u003c/script>"));
  assert.equal((await fetch(url + "/master.m3u8")).status, 200);
  assert.equal((await fetch(url + "/%ZZ")).status, 400);
  assert.equal((await fetch(url)).status, 200);
} finally {
  child.kill("SIGTERM");
  if (child.exitCode === null) await once(child, "exit");
}
