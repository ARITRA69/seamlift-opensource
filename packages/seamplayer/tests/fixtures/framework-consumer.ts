import {
  createSeamPlayer,
  renderPoster,
  type SeamPlayerOptions,
} from "seamplayer/core";
import { defineSeamPlayer, type SeamPlayerElement } from "seamplayer/element";
const options: SeamPlayerOptions = {
  src: "/film.mp4",
  chapters: [{ start: 0, title: "Intro" }],
};
renderPoster(options);
const player = createSeamPlayer(document.createElement("div"), options);
player.update(options);
player.destroy();
defineSeamPlayer();
const element: SeamPlayerElement = document.createElement("seam-player");
element.options = options;
element.chapters = options.chapters;
element.play();
