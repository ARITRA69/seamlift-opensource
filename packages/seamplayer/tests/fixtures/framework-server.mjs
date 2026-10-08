import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { renderPoster, styles } from "seamplayer/core";
import { defineSeamPlayer } from "seamplayer/element";
const require = createRequire(import.meta.url);
for (const render of [renderPoster, require("seamplayer/core").renderPoster]) {
  const html = render({
    src: "/film.mp4",
    title: '<Film> "title"',
    poster: "/poster.jpg",
  });
  assert(html.includes("Play &lt;Film&gt; &quot;title&quot;"));
  assert(!html.includes("<video"));
}
assert(styles.includes(":where(.sp)"));
defineSeamPlayer(); // safe without browser globals
require("seamplayer/element").defineSeamPlayer();
