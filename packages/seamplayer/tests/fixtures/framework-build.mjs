import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { compile } from "svelte/compiler";
const source = await readFile("Player.svelte", "utf8");
const result = compile(source, {
  filename: "Player.svelte",
  generate: "client",
});
assert(
  !result.warnings.some((warning) => warning.code === "non_reactive_update")
);
assert(result.js.code.includes("seamplayer/element"));
const html = await readFile("dist/index.html", "utf8");
assert(html.includes("<seam-player"));
assert(html.includes("Play Film"));
const scripts = (await readdir("dist/_astro")).filter((name) =>
  name.endsWith(".js")
);
assert(scripts.length > 0);
const bundle = (
  await Promise.all(
    scripts.map((name) => readFile(`dist/_astro/${name}`, "utf8"))
  )
).join("\n");
assert(
  bundle.includes("seam-player"),
  "Registration must survive tree-shaking"
);
assert(!bundle.includes("react-dom"));
