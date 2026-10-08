import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SeamPlayer } from "../src";
import type { SeamPlayerHandle, SeamPlayerProps } from "../src";

const window = new Window({ url: "https://example.test/watch" });
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  localStorage: window.localStorage,
  ResizeObserver: window.ResizeObserver,
  Event: window.Event,
  PointerEvent: window.PointerEvent,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});

const hlsSupported = mock(() => false);
mock.module("hls.js", () => ({ default: { isSupported: hlsSupported } }));

let root: Root;
let container: HTMLDivElement;
const play = mock(() => Promise.resolve());
const pause = mock(() => {});
Object.defineProperties(window.HTMLMediaElement.prototype, {
  play: { configurable: true, value: play },
  pause: { configurable: true, value: pause },
});

beforeEach(() => {
  hlsSupported.mockReset();
  hlsSupported.mockImplementation(() => false);
  play.mockClear();
  pause.mockClear();
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
});

async function render(props: SeamPlayerProps) {
  await act(() => root.render(createElement(SeamPlayer, props)));
}

function metadata(video: HTMLVideoElement, duration = 120) {
  Object.defineProperty(video, "duration", {
    configurable: true,
    value: duration,
  });
  video.dispatchEvent(new Event("loadedmetadata"));
}

describe("player lifecycle", () => {
  test("includes styles and allows per-player color overrides", async () => {
    await render({
      src: "/film.mp4",
      theme: { background: "navy", surface: "blue", text: "ivory" },
    });
    expect(document.querySelector("style")?.textContent).toContain(
      ":where(.sp)"
    );
    const player = container.querySelector<HTMLElement>(".sp")!;
    expect(player.style.getPropertyValue("--sp-bg")).toBe("navy");
    expect(player.style.getPropertyValue("--sp-surface")).toBe("blue");
    expect(player.style.getPropertyValue("--sp-text")).toBe("ivory");
  });

  test("loads no media until play, then honors the starting moment", async () => {
    await render({
      src: "/film.mp4",
      poster: "/poster.jpg",
      title: "Film",
      startTime: 30,
    });
    expect(container.querySelector("video")).toBeNull();
    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="Play Film"]'
    )!;
    await act(() => button.click());
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/film.mp4");
    await act(() => metadata(video));
    expect(video.currentTime).toBe(30);
    expect(play).not.toHaveBeenCalled();
    await act(() => video.dispatchEvent(new Event("seeked")));
    expect(play).toHaveBeenCalledTimes(1);
  });

  test("autoplay seeks before playing and starts muted", async () => {
    await render({ src: "/film.mp4", autoPlay: true, startTime: 42 });
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    expect(play).not.toHaveBeenCalled();
    await act(() => metadata(video));
    expect(video.currentTime).toBe(42);
    await act(() => video.dispatchEvent(new Event("seeked")));
    expect(play).toHaveBeenCalledTimes(1);
  });

  test("the imperative handle seeks within the loaded duration", async () => {
    const ref = createRef<SeamPlayerHandle>();
    await act(() =>
      root.render(
        createElement(SeamPlayer, { src: "/film.mp4", autoPlay: true, ref })
      )
    );
    const video = container.querySelector("video")!;
    await act(() => metadata(video));
    await act(() => ref.current?.seek(999));
    expect(video.currentTime).toBe(120);
    await act(() => ref.current?.seek(-10));
    expect(video.currentTime).toBe(0);
    expect(ref.current?.video).toBe(video);
  });

  test("a media error reaches the callback and recovery UI", async () => {
    const onError = mock(() => {});
    await render({ src: "/missing.mp4", autoPlay: true, onError });
    const video = container.querySelector("video")!;
    await act(() => video.dispatchEvent(new Event("error")));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("This video won’t play right now");
    expect(container.textContent).toContain("Try again");
  });

  test("unsupported HLS reaches the callback and recovery UI", async () => {
    const onError = mock(() => {});
    const reported = new Promise<void>((resolve) => {
      onError.mockImplementation(() => resolve());
    });
    await render({ src: "/stream.m3u8", autoPlay: true, onError });
    await act(async () => {
      await reported;
    });
    expect(onError).toHaveBeenCalledWith(null);
    expect(container.textContent).toContain("Try again");
  });
  test("cancelling a touch hold restores the selected playback speed", async () => {
    await render({ src: "/film.mp4", autoPlay: true });
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "paused", {
      configurable: true,
      value: false,
    });
    const surface = container.querySelector(".sp-surface")!;
    await act(() =>
      surface.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true })
      )
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 470));
    });
    expect(video.playbackRate).toBe(2);
    await act(() =>
      surface.dispatchEvent(
        new PointerEvent("pointercancel", {
          pointerType: "touch",
          bubbles: true,
        })
      )
    );
    expect(video.playbackRate).toBe(1);
    expect(container.querySelector(".sp-fast")).toBeNull();
  });

  test("an HLS initialization exception reaches the recovery UI", async () => {
    hlsSupported.mockImplementationOnce(() => {
      throw new Error("HLS initialization failed");
    });
    const onError = mock(() => {});
    const reported = new Promise<void>((resolve) => {
      onError.mockImplementation(() => resolve());
    });
    await render({ src: "/stream.m3u8", autoPlay: true, onError });
    await act(async () => {
      await reported;
    });
    expect(onError).toHaveBeenCalledWith(null);
    expect(container.textContent).toContain("Try again");
  });
});
