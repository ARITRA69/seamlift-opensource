import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createSeamPlayer } from "seamplayer/core";
const window = new Window({ url: "https://example.test" });
const document = window.document;
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "customElements",
  "CustomEvent",
  "ResizeObserver",
  "localStorage",
  "navigator",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === "window" ? window : window[key],
  });
}
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
Object.defineProperties(window.HTMLMediaElement.prototype, {
  play: { configurable: true, value: () => Promise.resolve() },
  pause: { configurable: true, value: () => {} },
  load: { configurable: true, value: () => {} },
});
// Upgrade properties assigned before registration, including full options.
const element = document.createElement("seam-player");
element.options = {
  src: "/film.mp4",
  title: "Before registration",
  autoPlay: true,
};
element.chapters = [{ start: 0, title: "Intro" }];
document.body.append(element);
await import("seamplayer/element");
assert(element.video);
assert.equal(element.video.getAttribute("src"), "/film.mp4");
assert.equal(element.options.title, "Before registration");
assert.equal(element.chapters[0].title, "Intro");
element.remove();
await Promise.resolve();
assert.equal(element.video, null);
const root = document.createElement("div");
document.body.append(root);
const player = createSeamPlayer(root, { src: "/film.mp4" });
assert.equal(player.video, null);
player.play();
assert.equal(player.video.getAttribute("src"), "/film.mp4");
player.destroy();
assert.equal(root.children.length, 0);
await window.happyDOM.close();
