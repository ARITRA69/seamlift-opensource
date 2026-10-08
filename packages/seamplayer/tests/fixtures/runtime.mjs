import { URL } from "node:url";
import console from "node:console";
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { SeamPlayer } from "seamplayer";
const require = createRequire(import.meta.url);
for (const Player of [SeamPlayer, require("seamplayer").SeamPlayer]) {
  const html = renderToString(
    createElement(Player, {
      src: "/film.mp4",
      title: "Film",
      poster: "/poster.jpg",
    })
  );
  assert(html.includes("Play Film"));
  assert(!html.includes("<video"));
  assert(
    html.includes("<style"),
    "SSR must include styles without a CSS import"
  );
  assert(html.includes(":where(.sp)"));
  assert(html.includes('"JetBrains Mono"'), "CSS must remain unescaped");
}
const css = readFileSync(require.resolve("seamplayer/styles.css"), "utf8");
assert(css.includes(".sp"));
for (const path of [
  import.meta.resolve("seamplayer"),
  require.resolve("seamplayer"),
]) {
  const js = readFileSync(
    path.startsWith("file:") ? new URL(path) : path,
    "utf8"
  );
  assert(js.startsWith('"use client";'));
  assert(!js.includes("@repo/"));
  const directory = new URL(".", import.meta.resolve("seamplayer"));
  const bundle = readdirSync(directory)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(new URL(name, directory), "utf8"))
    .join("\n");
  assert(/import\("hls.js"\)/.test(bundle), "HLS must remain a lazy import");
}
console.log(
  "Packed package: ESM, CommonJS, SSR, CSS, client directive, lazy HLS passed"
);
