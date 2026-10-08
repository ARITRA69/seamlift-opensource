import type Hls from "hls.js";
import { Icon, type IconName } from "./icons";
import { PlayerButton, ShortcutSheet, VolumeControl } from "./controls";
import {
  patchProps,
  render,
  renderToString,
  type Props,
  type Style,
} from "./jsx/dom";
import { SPEEDS, SettingsMenu, type CaptionSize } from "./menu";
import { injectStyles } from "./styles";
import { Timeline } from "./timeline";
import type {
  SeamChapter,
  SeamPlayerInstance,
  SeamPlayerOptions,
  SeamTheme,
} from "./types";
import { clamp, cx, formatBytes, formatTime, isHls, store } from "./utils";

// Controls hide after this long without the pointer moving, while playing.
const IDLE_MS = 2000;
// …and after a tap on a phone.
const TOUCH_IDLE_MS = 3000;
// Only show the spinner for stalls longer than this, so it never flickers.
const SPINNER_DELAY_MS = 300;
// Two taps closer than this are a double tap.
const DOUBLE_TAP_MS = 300;
// Holding a finger this long plays at 2×.
const LONG_PRESS_MS = 450;
// Save the position this often while playing.
const SAVE_EVERY_S = 3;
// Nothing to resume in the first and last few seconds.
const RESUME_MARGIN_S = 5;

const PREFS_KEY = "seamplayer:prefs";
const resumeStorageKey = (key: string) => `seamplayer:resume:${key}`;

type Flash = { key: number; icon?: IconName; text?: string };
type Ripple = { key: number; side: "left" | "right"; seconds: number };
type Menu = null | "settings" | "chapters" | "shortcuts";
type Timer = "idle" | "spinner" | "flash" | "ripple" | "tap" | "press";

type State = {
  activated: boolean;
  playing: boolean;
  time: number;
  duration: number;
  buffered: { start: number; end: number }[];
  waiting: boolean;
  failed: boolean;
  ended: boolean;
  volume: number;
  muted: boolean;
  rate: number;
  caption: string;
  captionText: string | null;
  captionSize: CaptionSize;
  levels: number[];
  quality: number;
  /** the height playing now (Auto's pick, or the chosen size) */
  playingHeight: number | null;
  loop: boolean;
  controlsShown: boolean;
  menu: Menu;
  remaining: boolean;
  flash: Flash | null;
  ripple: Ripple | null;
  fast: boolean;
  unmuteHint: boolean;
  resumeAt: number | null;
  fullscreen: boolean;
  pip: boolean;
  pipSupported: boolean;
  scrubbing: boolean;
};

/** The theme as the CSS variables it sets. */
export const themeStyle = (theme: SeamTheme | undefined): Style => ({
  "--sp-accent": theme?.accent,
  "--sp-accent-text": theme?.accentText,
  "--sp-bg": theme?.background,
  "--sp-surface": theme?.surface,
  "--sp-text": theme?.text,
  "--sp-highlight": theme?.highlight,
  "--sp-highlight-text": theme?.highlightText,
  "--sp-radius": theme?.radius,
  "--sp-font": theme?.font,
  "--sp-font-mono": theme?.monoFont,
});

/** The root element's own attributes, the same on the server and the page. */
export const rootAttributes = (options: SeamPlayerOptions) => ({
  role: "group",
  tabIndex: 0,
  "aria-label": `${options.title ?? "Video"}, video player`,
  className: cx("sp", options.className),
  style: { ...themeStyle(options.theme), ...options.style },
});

// Poster first: an image and a button, nothing else loads yet
const PosterButton = ({
  title,
  poster,
  onClick,
}: {
  title: string;
  poster?: string;
  onClick?: () => void;
}) => (
  <button
    type="button"
    className="sp-poster"
    aria-label={`Play ${title}`}
    onClick={onClick}
    style={poster ? { backgroundImage: `url("${poster}")` } : undefined}
  >
    <span className="sp-bigplay">
      <Icon name="play" size={26} />
    </span>
  </button>
);

const posterChips = (
  { duration, startTime }: SeamPlayerOptions,
  resumeAt: number | null,
  onResume?: () => void
) => [
  duration ? (
    <span className="sp-chip sp-chip-right">{formatTime(duration)}</span>
  ) : null,
  !!startTime && startTime > 0 && (
    <span className="sp-chip sp-chip-left">
      Starts at <span className="sp-mono">{formatTime(startTime)}</span>
    </span>
  ),
  !startTime && resumeAt !== null && (
    <button
      type="button"
      className="sp-chip sp-chip-left sp-chip-button"
      onClick={onResume}
    >
      <Icon name="play" size={13} />
      Continue from <span className="sp-mono">{formatTime(resumeAt)}</span>
    </button>
  ),
];

/**
 * The player's markup before anything runs: the poster and its play button.
 * Server renderers put it inside the root so the page shows the poster
 * straight away; the player takes over the element when it starts.
 */
export const renderPoster = (options: SeamPlayerOptions) =>
  renderToString([
    <PosterButton title={options.title ?? "Video"} poster={options.poster} />,
    posterChips(options, null),
  ]);

/**
 * A video player in any element, with no framework: poster first (the video
 * and hls.js load on the first play), one bar of controls that hides while
 * you watch, a filmstrip seek bar, chapters, quality, captions, downloads,
 * links to a moment, and the shortcuts and gestures people already know.
 * Remembers volume, speed, captions and where each viewer stopped.
 *
 * The element becomes the player: it gets the "sp" class and its contents
 * are replaced.
 */
export const createSeamPlayer = (
  root: HTMLElement,
  options: SeamPlayerOptions
): SeamPlayerInstance => new Player(root, options);

class Player implements SeamPlayerInstance {
  private o: SeamPlayerOptions;
  private s: State;
  private videoEl: HTMLVideoElement | null = null;
  private hls: Hls | null = null;
  private readonly timeline: Timeline;
  private settings: SettingsMenu | null = null;
  private readonly volumeDrag = { active: false };
  private readonly timers = new Map<Timer, ReturnType<typeof setTimeout>>();
  private captionCleanup: (() => void) | null = null;
  private rootProps: Props = {};
  private rootClasses: string[] = [];
  private queued = false;
  private destroyed = false;
  private videoMounted = false;
  private attachRun = 0;
  private frame = 0;
  private seq = 0;

  private lastTap: { at: number; side: string } | null = null;
  private pressedFast = false;
  private pointerType = "mouse";
  // a pointerdown outside closed the settings; its click isn't a play/pause
  private closedMenu = false;
  private startAt: number | null;
  // a size switch mid-play picks up playing on the new file
  private resumePlaying = false;
  // play only once the opening seek has landed: no flash of 0:00
  private playAfterSeek = false;
  private wantsPlay: boolean;
  private lastSave = 0;
  private lastCaption: string | null = null;
  // saving waits for the loaded settings, or the defaults would be written
  // over them first
  private prefsReady = false;

  constructor(
    private readonly root: HTMLElement,
    options: SeamPlayerOptions
  ) {
    this.o = options;
    const autoPlay = !!options.autoPlay;
    const { startTime } = options;
    this.startAt = autoPlay && startTime && startTime > 0 ? startTime : null;
    this.wantsPlay = autoPlay;
    this.s = {
      activated: autoPlay,
      playing: false,
      time: 0,
      duration: options.duration ?? 0,
      buffered: [],
      waiting: false,
      failed: false,
      ended: false,
      volume: 1,
      muted: autoPlay,
      rate: 1,
      caption: "off",
      captionText: null,
      captionSize: "md",
      levels: [],
      quality: -1,
      playingHeight: null,
      loop: !!options.loop,
      controlsShown: true,
      menu: null,
      remaining: false,
      flash: null,
      ripple: null,
      fast: false,
      unmuteHint: autoPlay,
      resumeAt: null,
      fullscreen: false,
      pip: false,
      pipSupported: false,
      scrubbing: false,
    };
    this.timeline = new Timeline(this.invalidate);

    injectStyles(root);
    // a server-rendered poster, replaced by the same markup with listeners
    root.replaceChildren();
    this.loadPrefs();
    root.ownerDocument.addEventListener(
      "fullscreenchange",
      this.onFullscreenChange
    );
    this.flush();
  }

  // ── the handle ─────────────────────────────────────────────────────────

  get video() {
    return this.videoEl;
  }

  play = () => {
    if (!this.s.activated) return this.start(this.o.startTime);
    this.set({ ended: false });
    void this.videoEl?.play().catch(() => undefined);
  };

  pause = () => this.videoEl?.pause();

  seek = (t: number) => {
    const video = this.videoEl;
    if (!video) {
      if (!this.s.activated) this.start(t);
      return;
    }
    const next = clamp(t, 0, this.s.duration || video.duration || 0);
    video.currentTime = next;
    this.set({ time: next, ended: false });
  };

  update(options: SeamPlayerOptions) {
    if (this.destroyed) return;
    const before = this.srcKey;
    const old = this.o;
    this.o = options;
    if (this.srcKey !== before) {
      this.startAt =
        options.startTime && options.startTime > 0 ? options.startTime : null;
      this.wantsPlay = this.s.playing || !!options.autoPlay;
      this.set({
        quality: -1,
        levels: [],
        playingHeight: null,
        time: 0,
        duration: options.duration ?? 0,
        buffered: [],
        failed: false,
        ended: false,
      });
      if (this.videoMounted) this.attach();
    } else if (
      options.duration !== old.duration &&
      options.duration !== undefined
    ) {
      this.s.duration = options.duration;
    }
    if (options.loop !== old.loop) {
      this.s.loop = !!options.loop;
      this.applyLoop();
    }
    // Apply track changes after the renderer has updated the <track> elements.
    this.flush();
    if (options.captions !== old.captions) {
      if (
        !(options.captions ?? []).some(
          (caption) => caption.lang === this.s.caption
        )
      ) {
        this.s.caption = "off";
      }
      this.syncCaptions();
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detach();
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.removeAttribute("src");
      this.videoEl.load();
    }
    cancelAnimationFrame(this.frame);
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.captionCleanup?.();
    this.timeline.dispose();
    this.settings?.dispose();
    const doc = this.root.ownerDocument;
    doc.removeEventListener("fullscreenchange", this.onFullscreenChange);
    doc.removeEventListener("pointerdown", this.onOutsideDown);
    render(null, this.root);
    patchProps(this.root, this.rootProps, {});
    this.root.classList.remove(...this.rootClasses);
    this.videoEl = null;
  }

  // ── rendering ──────────────────────────────────────────────────────────

  private readonly invalidate = () => {
    if (this.queued || this.destroyed) return;
    this.queued = true;
    queueMicrotask(() => {
      if (this.queued) this.flush();
    });
  };

  private set(next: Partial<State>) {
    Object.assign(this.s, next);
    this.invalidate();
  }

  private flush() {
    this.queued = false;
    if (this.destroyed) return;
    const { root, s } = this;
    // classes the page added stay
    const classes = cx("sp", this.o.className).split(" ").filter(Boolean);
    for (const c of this.rootClasses) {
      if (!classes.includes(c)) root.classList.remove(c);
    }
    root.classList.add(...classes);
    this.rootClasses = classes;

    const chromeVisible =
      s.activated &&
      !s.failed &&
      (!s.playing || s.controlsShown || s.menu !== null || s.scrubbing);
    const attributes: Props = rootAttributes(this.o);
    delete attributes.className;
    const props: Props = {
      ...attributes,
      "data-chrome": chromeVisible || undefined,
      "data-idle": (s.activated && s.playing && !chromeVisible) || undefined,
      "data-fullscreen": s.fullscreen || undefined,
      onKeyDown: this.onKeyDown,
      onPointerMove: this.onPointerMove,
      onPointerLeave: this.onPointerLeave,
      onContextMenu: this.onContextMenu,
    };
    patchProps(root, this.rootProps, props);
    this.rootProps = props;
    render(this.view(), root);

    // the video exists from here: load it and bring it up to the settings
    if (s.activated && this.videoEl && !this.videoMounted) {
      this.videoMounted = true;
      this.attach();
      this.applyLoop();
      this.syncCaptions();
    }
  }

  // ── remembered settings and position ───────────────────────────────────

  private loadPrefs() {
    try {
      const prefs = JSON.parse(store.get(PREFS_KEY) ?? "{}") as {
        volume?: number;
        rate?: number;
        caption?: string;
        captionSize?: CaptionSize;
      };
      if (typeof prefs.volume === "number") {
        this.s.volume = clamp(prefs.volume, 0, 1);
      }
      if (prefs.rate && (SPEEDS as readonly number[]).includes(prefs.rate)) {
        this.s.rate = prefs.rate;
      }
      if (
        prefs.caption &&
        (this.o.captions ?? []).some((c) => c.lang === prefs.caption)
      ) {
        this.s.caption = prefs.caption;
      }
      if (prefs.captionSize && ["sm", "md", "lg"].includes(prefs.captionSize)) {
        this.s.captionSize = prefs.captionSize;
      }
    } catch {
      // unreadable prefs: defaults
    }
    this.prefsReady = true;
    const { resumeKey } = this.o;
    if (resumeKey) {
      const saved = Number(store.get(resumeStorageKey(resumeKey)));
      if (saved > RESUME_MARGIN_S) this.s.resumeAt = saved;
    }
    const doc = this.root.ownerDocument;
    this.s.pipSupported =
      "pictureInPictureEnabled" in doc && doc.pictureInPictureEnabled;
  }

  private savePrefs() {
    if (!this.prefsReady) return;
    const { volume, rate, caption, captionSize } = this.s;
    store.set(
      PREFS_KEY,
      JSON.stringify({ volume, rate, caption, captionSize })
    );
  }

  private savePosition(t: number, total: number) {
    const { resumeKey } = this.o;
    if (!resumeKey) return;
    const keep = t > RESUME_MARGIN_S && t < total - RESUME_MARGIN_S;
    store.set(resumeStorageKey(resumeKey), keep ? String(t) : null);
  }

  // ── sources ────────────────────────────────────────────────────────────

  // MP4 sizes, largest first; null for one file or an HLS stream
  private get sources() {
    const { src } = this.o;
    return Array.isArray(src)
      ? [...src].sort((a, b) => b.height - a.height)
      : null;
  }

  private get single() {
    return typeof this.o.src === "string" ? this.o.src : null;
  }

  // a stable identity, whatever array the page passes
  private get srcKey() {
    const sources = this.sources;
    return sources ? sources.map((s) => s.src).join("|") : this.single;
  }

  private get downloads() {
    const { download } = this.o;
    return !download || typeof download === "function"
      ? []
      : Array.isArray(download)
        ? download
        : [download];
  }

  // A size by height; Auto is the smallest that's still sharp at the
  // player's height on this screen (the largest if none is enough).
  private pickSource(height: number) {
    const sources = this.sources;
    if (!sources?.length) return null;
    if (height !== -1) {
      return sources.find((s) => s.height === height) ?? sources[0]!;
    }
    const needed = this.root.clientHeight * (window.devicePixelRatio || 1);
    return (
      [...sources].reverse().find((s) => s.height >= needed) ?? sources[0]!
    );
  }

  // ── loading: nothing until the first play ──────────────────────────────

  private attach() {
    const video = this.videoEl;
    if (!video) return;
    this.detach();
    const run = this.attachRun;
    const cancelled = () => run !== this.attachRun || this.destroyed;

    const load = async () => {
      const picked = this.pickSource(this.s.quality);
      const single = this.single;
      if (picked) {
        video.src = picked.src;
        this.set({ playingHeight: picked.height });
      } else if (
        single &&
        isHls(single) &&
        !video.canPlayType("application/vnd.apple.mpegurl")
      ) {
        const { default: HlsJs } = await import("hls.js");
        if (cancelled()) return;
        if (HlsJs.isSupported()) {
          const hls = new HlsJs({ enableWorker: true });
          hls.loadSource(single);
          hls.attachMedia(video);
          hls.on(HlsJs.Events.MANIFEST_PARSED, (_, data) =>
            this.set({
              levels: [...new Set(data.levels.map((l) => l.height))].sort(
                (a, b) => b - a
              ),
            })
          );
          hls.on(HlsJs.Events.LEVEL_SWITCHED, (_, data) =>
            this.set({ playingHeight: hls.levels[data.level]?.height ?? null })
          );
          hls.on(HlsJs.Events.ERROR, (_, data) => {
            if (data.fatal) this.fail(null);
          });
          this.hls = hls;
        } else this.fail(null);
      } else if (single) video.src = single;

      // settings first: an autoplay has to start muted to be allowed
      const { volume, muted, rate } = this.s;
      video.volume = volume;
      video.muted = muted;
      video.defaultPlaybackRate = rate;
      video.playbackRate = rate;
      // with a start point (resume, ?t=), play once the seek lands instead
      if (this.wantsPlay && this.startAt === null) {
        this.wantsPlay = false;
        void video.play().catch(() => this.setPlaying(false));
      }
    };
    void load().catch(() => {
      if (!cancelled()) this.fail(null);
    });
  }

  private detach() {
    this.attachRun++;
    this.hls?.destroy();
    this.hls = null;
  }

  private fail(error: MediaError | null) {
    this.set({ failed: true });
    this.o.onError?.(error);
  }

  // ── the video follows the settings ─────────────────────────────────────

  private applyVolume() {
    const video = this.videoEl;
    if (!video) return;
    video.volume = this.s.volume;
    video.muted = this.s.muted;
  }

  private applyRate() {
    const video = this.videoEl;
    if (!video) return;
    // a new file (a size switch) starts at the default rate
    video.defaultPlaybackRate = this.s.rate;
    if (!this.pressedFast) video.playbackRate = this.s.rate;
  }

  private applyLoop() {
    if (this.videoEl) this.videoEl.loop = this.s.loop;
  }

  // Captions are drawn by the player (so they can move above the bar): the
  // chosen track runs hidden and its cues land in captionText.
  private syncCaptions() {
    this.captionCleanup?.();
    this.captionCleanup = null;
    const video = this.videoEl;
    if (!video) return;
    let active: TextTrack | undefined;
    for (const track of Array.from(video.textTracks)) {
      if (track.language === this.s.caption) {
        track.mode = "hidden";
        active = track;
      } else track.mode = "disabled";
    }
    this.set({ captionText: null });
    if (!active) return;
    const track = active;
    const onCue = () =>
      this.set({
        captionText:
          Array.from(track.activeCues ?? [])
            .map((cue) => (cue as VTTCue).text)
            .join("\n") || null,
      });
    track.addEventListener("cuechange", onCue);
    onCue();
    this.captionCleanup = () => track.removeEventListener("cuechange", onCue);
  }

  private setPlaying(playing: boolean) {
    if (playing === this.s.playing) return;
    this.set({ playing });
    // a smooth playhead while playing
    cancelAnimationFrame(this.frame);
    if (playing) this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = () => {
    const video = this.videoEl;
    if (!video) return;
    this.set({ time: video.currentTime });
    this.frame = requestAnimationFrame(this.tick);
  };

  private after(name: Timer, ms: number, run: () => void) {
    this.clear(name);
    this.timers.set(
      name,
      setTimeout(() => {
        this.timers.delete(name);
        run();
      }, ms)
    );
  }

  private clear(name: Timer) {
    const timer = this.timers.get(name);
    if (timer) clearTimeout(timer);
    this.timers.delete(name);
  }

  private readonly onFullscreenChange = () =>
    this.set({
      fullscreen: this.root.ownerDocument.fullscreenElement === this.root,
    });

  // a press outside the settings closes them
  private readonly onOutsideDown = (e: PointerEvent) => {
    const path = e.composedPath();
    const inSettings = path.some((node) =>
      (node as Element).hasAttribute?.("data-sp-settings")
    );
    if (inSettings) return;
    // only a press on the picture would also reach play/pause
    this.closedMenu = path.includes(this.root);
    this.setMenu(null);
  };

  private setMenu(menu: Menu) {
    if (menu === this.s.menu) return;
    const settings = menu === "settings" || menu === "chapters";
    // each opening starts fresh on its own page
    this.settings?.dispose();
    this.settings = settings
      ? new SettingsMenu(
          menu === "chapters" ? "chapters" : "main",
          this.invalidate
        )
      : null;
    const doc = this.root.ownerDocument;
    doc.removeEventListener("pointerdown", this.onOutsideDown);
    if (settings) doc.addEventListener("pointerdown", this.onOutsideDown);
    this.set({ menu });
  }

  // ── actions ────────────────────────────────────────────────────────────

  // On a fresh load: play if it's the first start held back for its seek,
  // or a size switch made mid-play.
  private wantsPlayNow() {
    if (this.resumePlaying) {
      this.resumePlaying = false;
      return true;
    }
    if (this.wantsPlay) {
      this.wantsPlay = false;
      return true;
    }
    return false;
  }

  private readonly start = (at?: number) => {
    this.startAt = at && at > 0 ? at : null;
    this.wantsPlay = true;
    this.set({ resumeAt: null, activated: true });
    // the poster button is about to go; keep the keyboard on the player
    this.root.focus({ preventScroll: true });
    this.flush();
  };

  private readonly togglePlay = () =>
    this.s.playing ? this.pause() : this.play();

  private showFlash(next: Omit<Flash, "key">) {
    this.set({ flash: { ...next, key: ++this.seq } });
    this.after("flash", 650, () => this.set({ flash: null }));
  }

  private showControls(idleMs = IDLE_MS) {
    this.set({ controlsShown: true });
    this.after("idle", idleMs, () => this.set({ controlsShown: false }));
  }

  private skip(seconds: number) {
    this.seek((this.videoEl?.currentTime ?? this.s.time) + seconds);
    this.showFlash({
      text: `${seconds > 0 ? "+" : "−"}${Math.abs(seconds)}s`,
    });
  }

  private readonly changeVolume = (next: number) => {
    this.set({
      volume: clamp(next, 0, 1),
      muted: next <= 0,
      unmuteHint: false,
    });
    this.applyVolume();
    this.savePrefs();
  };

  private readonly toggleMute = () => {
    const { muted, volume } = this.s;
    this.set({ unmuteHint: false });
    if (muted || volume === 0) {
      this.set({ muted: false, ...(volume === 0 && { volume: 0.8 }) });
    } else this.set({ muted: true });
    this.applyVolume();
    this.savePrefs();
  };

  private readonly setRate = (rate: number) => {
    this.set({ rate });
    this.applyRate();
    this.savePrefs();
  };

  private changeRate(dir: 1 | -1) {
    const i = SPEEDS.indexOf(this.s.rate as (typeof SPEEDS)[number]);
    const next = SPEEDS[clamp((i === -1 ? 2 : i) + dir, 0, SPEEDS.length - 1)]!;
    this.setRate(next);
    this.showFlash({ text: `${next}×` });
  }

  private readonly setCaption = (caption: string) => {
    this.set({ caption });
    this.syncCaptions();
    this.savePrefs();
  };

  private readonly setCaptionSize = (captionSize: CaptionSize) => {
    this.set({ captionSize });
    this.savePrefs();
  };

  private readonly setLoop = (loop: boolean) => {
    this.set({ loop });
    this.applyLoop();
  };

  private readonly toggleCaptions = () => {
    const captions = this.o.captions ?? [];
    if (!captions.length) return;
    if (this.s.caption === "off") {
      this.setCaption(this.lastCaption ?? captions[0]!.lang);
      this.showFlash({ text: "Captions on" });
    } else {
      this.lastCaption = this.s.caption;
      this.setCaption("off");
      this.showFlash({ text: "Captions off" });
    }
  };

  private readonly changeQuality = (height: number) => {
    this.set({ quality: height });
    const hls = this.hls;
    if (hls) {
      hls.currentLevel =
        height === -1 ? -1 : hls.levels.findIndex((l) => l.height === height);
      return;
    }
    // MP4 sizes: swap the file, keep the moment and whether it played
    const video = this.videoEl;
    const next = this.pickSource(height);
    if (!video || !next) return;
    this.set({ playingHeight: next.height });
    this.showFlash({
      text: height === -1 ? `Auto · ${next.height}p` : `${next.height}p`,
    });
    if (new URL(next.src, window.location.href).href === video.currentSrc) {
      return;
    }
    this.resumePlaying = !video.paused;
    this.startAt = video.currentTime;
    video.src = next.src;
  };

  private readonly toggleFullscreen = () => {
    const doc = this.root.ownerDocument;
    const video = this.videoEl as
      (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (doc.fullscreenElement) {
      void doc.exitFullscreen();
    } else if (this.root.requestFullscreen) {
      void this.root
        .requestFullscreen()
        .then(() => {
          // phones turn sideways for a fullscreen video
          if (!matchMedia("(pointer: coarse)").matches) return;
          const orientation = screen.orientation as ScreenOrientation & {
            lock?: (o: string) => Promise<void>;
          };
          return orientation.lock?.("landscape").catch(() => undefined);
        })
        .catch(() => undefined);
    } else video?.webkitEnterFullscreen?.(); // iPhone Safari
  };

  private readonly togglePip = () => {
    const video = this.videoEl;
    if (!video) return;
    if (this.root.ownerDocument.pictureInPictureElement) {
      void this.root.ownerDocument.exitPictureInPicture();
    } else void video.requestPictureInPicture().catch(() => undefined);
  };

  private readonly retry = () => {
    this.set({ failed: false });
    const hls = this.hls;
    if (hls) hls.startLoad();
    else this.videoEl?.load();
    void this.videoEl?.play().catch(() => undefined);
  };

  private readonly replay = () => {
    this.seek(0);
    this.play();
  };

  private currentChapter() {
    const chapters = this.o.chapters ?? [];
    return (
      chapters.filter((c) => c.start <= this.s.time + 0.05).at(-1) ??
      chapters[0] ??
      null
    );
  }

  private readonly goToChapter = (chapter: SeamChapter) => {
    this.setMenu(null);
    this.seek(chapter.start);
  };

  private readonly startDownload = (index = 0) => {
    this.setMenu(null);
    const { download } = this.o;
    if (typeof download === "function") return download();
    const file = this.downloads[index];
    if (!file) return;
    const doc = this.root.ownerDocument;
    const link = doc.createElement("a");
    link.href = file.url;
    link.download = file.filename ?? "";
    link.rel = "noopener";
    doc.body.append(link);
    link.click();
    link.remove();
  };

  // the page's URL with ?t= at the current second
  private readonly copyLink = async () => {
    const { shareUrl } = this.o;
    if (!shareUrl) return;
    const url = new URL(shareUrl, window.location.href);
    const at = Math.floor(this.videoEl?.currentTime ?? this.s.time);
    if (at > 0) url.searchParams.set("t", String(at));
    else url.searchParams.delete("t");
    await navigator.clipboard.writeText(url.toString());
  };

  // ── the video's events ─────────────────────────────────────────────────

  private readonly videoRef = (el: HTMLVideoElement | null) => {
    if (el) this.videoEl = el;
  };

  private readonly onLoadedMetadata = () => {
    const video = this.videoEl!;
    this.set({ duration: video.duration });
    const shouldPlay = this.wantsPlayNow();
    if (this.startAt !== null) {
      this.playAfterSeek = shouldPlay;
      video.currentTime = this.startAt;
      this.startAt = null;
    } else if (shouldPlay) {
      void video.play().catch(() => this.setPlaying(false));
    }
  };

  private readonly onVideoPlay = () => {
    this.setPlaying(true);
    this.set({ ended: false });
    this.showControls();
    this.o.onPlay?.();
  };

  private readonly onVideoPause = () => {
    const video = this.videoEl!;
    this.setPlaying(false);
    this.savePosition(video.currentTime, video.duration);
    this.o.onPause?.();
  };

  private readonly onVideoEnded = () => {
    this.setPlaying(false);
    this.set({ ended: true });
    this.savePosition(0, 0);
    this.o.onEnded?.();
  };

  private readonly onVideoTimeUpdate = () => {
    const video = this.videoEl!;
    const t = video.currentTime;
    this.o.onTimeUpdate?.(t);
    if (Math.abs(t - this.lastSave) >= SAVE_EVERY_S) {
      this.lastSave = t;
      this.savePosition(t, video.duration);
    }
  };

  private readonly onSeeked = () => {
    const video = this.videoEl!;
    this.set({ time: video.currentTime });
    if (!this.playAfterSeek) return;
    this.playAfterSeek = false;
    void video.play().catch(() => this.setPlaying(false));
  };

  private readonly onProgress = () => {
    const ranges = this.videoEl!.buffered;
    this.set({
      buffered: Array.from({ length: ranges.length }, (_, i) => ({
        start: ranges.start(i),
        end: ranges.end(i),
      })),
    });
  };

  private readonly onWaiting = () =>
    this.after("spinner", SPINNER_DELAY_MS, () => this.set({ waiting: true }));

  private readonly onResumed = () => {
    this.clear("spinner");
    this.set({ waiting: false });
  };

  private readonly onVideoError = () => this.fail(this.videoEl!.error);

  // ── pointer on the picture ─────────────────────────────────────────────

  // Mouse: click plays or pauses, double click is fullscreen. Finger: a tap
  // shows the controls, a double tap on either side skips 10s (and keeps
  // adding while you tap), holding plays at 2×.
  private readonly onSurfaceDown = (e: PointerEvent) => {
    this.root.focus({ preventScroll: true });
    this.pointerType = e.pointerType;
    if (e.pointerType === "mouse") return;
    this.after("press", LONG_PRESS_MS, () => {
      const video = this.videoEl;
      if (!video || video.paused) return;
      this.pressedFast = true;
      video.playbackRate = 2;
      this.set({ fast: true });
    });
  };

  private endFastPress() {
    this.pressedFast = false;
    if (this.videoEl) this.videoEl.playbackRate = this.s.rate;
    this.set({ fast: false });
  }

  private readonly onSurfaceUp = (e: PointerEvent) => {
    this.clear("press");
    if (this.pressedFast) return this.endFastPress();

    if (this.closedMenu) {
      this.closedMenu = false;
      return;
    }

    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      const wasPlaying = this.s.playing;
      this.togglePlay();
      this.showFlash({ icon: wasPlaying ? "pause" : "play" });
      return;
    }

    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const side = x < 0.35 ? "left" : x > 0.65 ? "right" : "center";
    const now = Date.now();
    const last = this.lastTap;
    const double = last && now - last.at < DOUBLE_TAP_MS && last.side === side;

    if (double) {
      this.clear("tap");
      this.lastTap = { at: now, side };
      if (side === "center") return this.togglePlay();
      const seconds = side === "left" ? -10 : 10;
      this.seek((this.videoEl?.currentTime ?? this.s.time) + seconds);
      const r = this.s.ripple;
      this.set({
        ripple: {
          key: ++this.seq,
          side,
          seconds: r && r.side === side ? r.seconds + seconds : seconds,
        },
      });
      this.after("ripple", 700, () => this.set({ ripple: null }));
      return;
    }

    this.lastTap = { at: now, side };
    this.after("tap", DOUBLE_TAP_MS, () => {
      if (this.s.controlsShown && this.s.playing) {
        this.set({ controlsShown: false });
      } else this.showControls(TOUCH_IDLE_MS);
    });
  };

  private readonly onSurfaceCancel = () => {
    this.clear("press");
    if (this.pressedFast) this.endFastPress();
  };

  private readonly onSurfaceDoubleClick = () => {
    // a finger's double tap skips instead
    if (this.pointerType === "mouse") this.toggleFullscreen();
  };

  // ── on the root ────────────────────────────────────────────────────────

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // a focused button handles its own Space and Enter
    const onButton = (e.target as Element).closest("button");
    if (onButton && (e.key === " " || e.key === "Enter")) return;

    const { s } = this;
    const video = this.videoEl;
    const key = e.key;
    let handled = true;

    if (key === " " || key === "k" || key === "K") {
      const wasPlaying = s.playing;
      this.togglePlay();
      this.showFlash({ icon: wasPlaying ? "pause" : "play" });
    } else if (key === "ArrowLeft") this.skip(-5);
    else if (key === "ArrowRight") this.skip(5);
    else if (key === "j" || key === "J") this.skip(-10);
    else if (key === "l" || key === "L") this.skip(10);
    else if (key === "ArrowUp" || key === "ArrowDown") {
      const next = clamp(
        (s.muted ? 0 : s.volume) + (key === "ArrowUp" ? 0.05 : -0.05),
        0,
        1
      );
      this.changeVolume(next);
      this.showFlash({ text: `Volume ${Math.round(next * 100)}%` });
    } else if (key === "m" || key === "M") {
      const wasMuted = s.muted;
      this.toggleMute();
      this.showFlash({ icon: wasMuted ? "volumeHigh" : "volumeMute" });
    } else if (key === "f" || key === "F") this.toggleFullscreen();
    else if (key === "c" || key === "C") this.toggleCaptions();
    else if (/^[0-9]$/.test(key)) this.seek((s.duration * Number(key)) / 10);
    else if (key === ">") this.changeRate(1);
    else if (key === "<") this.changeRate(-1);
    else if ((key === "," || key === ".") && video?.paused) {
      this.seek(
        video.currentTime + (key === "," ? -1 : 1) / (this.o.fps ?? 30)
      );
    } else if (key === "?") {
      this.setMenu(s.menu === "shortcuts" ? null : "shortcuts");
    } else if (key === "Escape" && s.menu) this.setMenu(null);
    else handled = false;

    if (!handled) return;
    e.preventDefault();
    if (s.activated) this.showControls();
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && this.s.activated) this.showControls();
  };

  private readonly onPointerLeave = () => {
    if (this.s.playing && !this.s.menu) this.set({ controlsShown: false });
  };

  private readonly onContextMenu = (e: MouseEvent) => {
    if (this.s.fast) e.preventDefault();
  };

  // ── view ───────────────────────────────────────────────────────────────

  private view() {
    const { s, o } = this;
    const title = o.title ?? "Video";
    const captions = o.captions ?? [];

    // every slot stays in place, filled or not, so elements keep theirs
    return [
      s.activated ? (
        <video
          ref={this.videoRef}
          className="sp-video"
          playsInline
          preload="auto"
          // captions from another host need CORS; plain playback doesn't
          crossOrigin={captions.length ? "anonymous" : undefined}
          onLoadedMetadata={this.onLoadedMetadata}
          onDurationChange={() =>
            this.set({ duration: this.videoEl!.duration })
          }
          onPlay={this.onVideoPlay}
          onPause={this.onVideoPause}
          onEnded={this.onVideoEnded}
          onTimeUpdate={this.onVideoTimeUpdate}
          onSeeked={this.onSeeked}
          onProgress={this.onProgress}
          onWaiting={this.onWaiting}
          onPlaying={this.onResumed}
          onCanPlay={this.onResumed}
          onError={this.onVideoError}
          onEnterPictureInPicture={() => this.set({ pip: true })}
          onLeavePictureInPicture={() => this.set({ pip: false })}
        >
          {captions.map((c) => (
            <track
              key={c.lang}
              kind="subtitles"
              src={c.src}
              srcLang={c.lang}
              label={c.label}
            />
          ))}
        </video>
      ) : (
        <PosterButton
          title={title}
          poster={o.poster}
          onClick={() => this.start(o.startTime)}
        />
      ),

      !s.activated &&
        posterChips(o, s.resumeAt, () => this.start(s.resumeAt ?? 0)),

      // the picture: where clicks, taps and holds land
      s.activated && (
        <div
          className="sp-surface"
          onPointerDown={this.onSurfaceDown}
          onPointerUp={this.onSurfaceUp}
          onPointerCancel={this.onSurfaceCancel}
          onDoubleClick={this.onSurfaceDoubleClick}
        />
      ),

      // captions, lifted above the bar while it shows
      s.captionText && !s.menu && !s.ended && (
        <div className="sp-caption" data-size={s.captionSize}>
          <span>{s.captionText}</span>
        </div>
      ),

      // what a click or key just did
      <div className="sp-center" aria-live="polite">
        {s.flash && (
          <span key={s.flash.key} className="sp-flash">
            {s.flash.icon && <Icon name={s.flash.icon} size={26} />}
            {s.flash.text && <span>{s.flash.text}</span>}
          </span>
        )}
      </div>,

      // double tap: a soft half-disc on that side, adding up
      s.ripple && (
        <div key={s.ripple.key} className="sp-ripple" data-side={s.ripple.side}>
          <span>
            <Icon
              name={s.ripple.side === "left" ? "back" : "forward"}
              size={28}
            />
            {s.ripple.seconds > 0 ? "+" : "−"}
            {Math.abs(s.ripple.seconds)}s
          </span>
        </div>
      ),

      // holding: 2×
      s.fast && (
        <span className="sp-fast">
          2× <Icon name="fastForward" size={14} />
        </span>
      ),

      // autoplay starts muted: say so, one tap to fix
      s.unmuteHint && s.playing && (
        <button type="button" className="sp-unmute" onClick={this.toggleMute}>
          <Icon name="volumeMute" size={16} />
          Tap to unmute
        </button>
      ),

      s.waiting && !s.failed && (
        <div className="sp-center">
          <span className="sp-spinner" role="status" aria-label="Loading" />
        </div>
      ),

      s.failed && (
        <div className="sp-overlay sp-error">
          <Icon name="alert" size={28} />
          <b>This video won’t play right now</b>
          <button type="button" className="sp-pill" onClick={this.retry}>
            Try again
          </button>
        </div>
      ),

      s.ended && !s.failed && (
        <div className="sp-overlay sp-ended">
          <div className="sp-ended-actions">
            <button
              type="button"
              className="sp-pill sp-pill-accent"
              onClick={this.replay}
            >
              <Icon name="replay" size={16} />
              Replay
            </button>
            {o.endAction && (
              <a className="sp-pill" href={o.endAction.href}>
                {o.endAction.label}
              </a>
            )}
          </div>
        </div>
      ),

      // settings sit above the bar and scroll in a short player
      this.settings && (
        <div className="sp-menu-layer">
          <div key={s.menu!} data-sp-settings className="sp-menu-wrap">
            {this.settingsView()}
          </div>
        </div>
      ),

      s.menu === "shortcuts" && (
        <div className="sp-sheet-layer">
          <ShortcutSheet onClose={() => this.setMenu(null)} />
        </div>
      ),

      // the bar: not before the first play, so the poster loads alone
      s.activated && this.barView(),
    ];
  }

  private settingsView() {
    const { s, o } = this;
    const sources = this.sources;
    return this.settings!.view({
      time: s.time,
      chapters: o.chapters ?? [],
      currentChapter: this.currentChapter(),
      onChapter: this.goToChapter,
      rate: s.rate,
      onRate: this.setRate,
      captions: (o.captions ?? []).map((c) => ({
        value: c.lang,
        label: c.label,
      })),
      caption: s.caption,
      onCaption: this.setCaption,
      captionSize: s.captionSize,
      onCaptionSize: this.setCaptionSize,
      qualities: sources ? sources.map((src) => src.height) : s.levels,
      quality: s.quality,
      playingHeight: s.playingHeight,
      onQuality: this.changeQuality,
      loop: s.loop,
      onLoop: this.setLoop,
      downloads: this.downloads.map((d) => ({
        label: d.label ?? "Original",
        detail: d.size ? formatBytes(d.size) : undefined,
      })),
      onDownload: o.download ? this.startDownload : undefined,
      onCopyLink: o.shareUrl ? this.copyLink : undefined,
      onShortcuts: () => this.setMenu("shortcuts"),
    });
  }

  private barView() {
    const { s, o } = this;
    const captions = o.captions ?? [];
    const currentChapter = this.currentChapter();
    return (
      <div className="sp-bar">
        {this.timeline.view({
          duration: s.duration,
          currentTime: s.time,
          thumbnails: o.thumbnails,
          buffered: s.buffered,
          marks: (o.chapters ?? []).map((c) => c.start),
          onSeek: this.seek,
          onScrubChange: (scrubbing) => this.set({ scrubbing }),
        })}

        <div className="sp-controls">
          <PlayerButton
            label={s.playing ? "Pause (K)" : "Play (K)"}
            onClick={this.togglePlay}
          >
            <Icon name={s.playing ? "pause" : "play"} />
          </PlayerButton>
          <VolumeControl
            volume={s.volume}
            muted={s.muted}
            onVolume={this.changeVolume}
            onToggleMute={this.toggleMute}
            drag={this.volumeDrag}
          />
          <button
            type="button"
            className="sp-time"
            title={s.remaining ? "Show elapsed time" : "Show time left"}
            onClick={() => this.set({ remaining: !s.remaining })}
          >
            {s.remaining ? (
              `−${formatTime(Math.max(s.duration - s.time, 0))}`
            ) : (
              <>
                {formatTime(s.time)}
                {/* a narrow player keeps just the elapsed time */}
                <span className="sp-time-total sp-hide-narrow">
                  {" "}
                  / {formatTime(s.duration)}
                </span>
              </>
            )}
          </button>

          {currentChapter && (
            <button
              type="button"
              className="sp-chapter sp-hide-small"
              title="Chapters"
              data-sp-settings
              onClick={() =>
                this.setMenu(s.menu === "chapters" ? null : "chapters")
              }
            >
              <span className="sp-chapter-dot">·</span>
              <span className="sp-truncate">{currentChapter.title}</span>
              <Icon name="chevronRight" size={13} />
            </button>
          )}

          <span className="sp-spacer" />

          {captions.length > 0 && (
            // narrow: captions stay in the settings menu
            <PlayerButton
              label="Captions (C)"
              pressed={s.caption !== "off"}
              onClick={this.toggleCaptions}
              className="sp-hide-narrow"
            >
              <Icon name="captions" />
            </PlayerButton>
          )}
          <span data-sp-settings>
            <PlayerButton
              label="Settings"
              pressed={s.menu === "settings" || s.menu === "chapters"}
              onClick={() =>
                this.setMenu(s.menu === "settings" ? null : "settings")
              }
            >
              <Icon name="settings" />
            </PlayerButton>
          </span>
          {s.pipSupported && (
            <PlayerButton
              label={s.pip ? "Exit picture in picture" : "Picture in picture"}
              pressed={s.pip}
              onClick={this.togglePip}
              className="sp-hide-narrow"
            >
              <Icon name="pip" />
            </PlayerButton>
          )}
          <PlayerButton
            label={s.fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            onClick={this.toggleFullscreen}
          >
            <Icon name={s.fullscreen ? "fullscreenExit" : "fullscreen"} />
          </PlayerButton>
        </div>
      </div>
    );
  }
}
