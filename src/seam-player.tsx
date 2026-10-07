import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type Hls from "hls.js";
import { Icon, type IconName } from "./icons";
import { PlayerButton, ShortcutSheet, VolumeControl } from "./controls";
import { SPEEDS, SettingsMenu, type CaptionSize } from "./menu";
import { Timeline } from "./timeline";
import type { SeamChapter, SeamPlayerHandle, SeamPlayerProps } from "./types";
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

/**
 * A video player for React. Poster first (the video and hls.js load on the
 * first play), one bar of controls that hides while you watch, a filmstrip
 * seek bar, chapters, quality, captions, downloads, links to a moment, and
 * the shortcuts and gestures people already know. Remembers volume, speed,
 * captions and where each viewer stopped.
 */
export const SeamPlayer = forwardRef<SeamPlayerHandle, SeamPlayerProps>(
  function SeamPlayer(
    {
      src,
      title = "Video",
      poster,
      duration: knownDuration,
      thumbnails,
      chapters = [],
      captions = [],
      download,
      shareUrl,
      startTime,
      autoPlay = false,
      loop: initialLoop = false,
      resumeKey,
      fps = 30,
      theme,
      endAction,
      className,
      style,
      onPlay,
      onPause,
      onEnded,
      onTimeUpdate,
      onError,
    },
    ref
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTap = useRef<{ at: number; side: string } | null>(null);
    const pressedFast = useRef(false);
    const pointerType = useRef("mouse");
    // a pointerdown outside closed the settings; its click isn't a play/pause
    const closedMenu = useRef(false);
    const startAt = useRef<number | null>(
      autoPlay && startTime && startTime > 0 ? startTime : null
    );
    // a size switch mid-play picks up playing on the new file
    const resumePlaying = useRef(false);
    // play only once the opening seek has landed: no flash of 0:00
    const playAfterSeek = useRef(false);
    const wantsPlay = useRef(autoPlay);
    const lastSave = useRef(0);
    const lastCaption = useRef<string | null>(null);

    const [activated, setActivated] = useState(autoPlay);
    const [playing, setPlaying] = useState(false);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(knownDuration ?? 0);
    const [buffered, setBuffered] = useState<{ start: number; end: number }[]>(
      []
    );
    const [waiting, setWaiting] = useState(false);
    const [failed, setFailed] = useState(false);
    const [ended, setEnded] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(autoPlay);
    const [rate, setRate] = useState(1);
    const [caption, setCaption] = useState("off");
    const [captionText, setCaptionText] = useState<string | null>(null);
    const [captionSize, setCaptionSize] = useState<CaptionSize>("md");
    const [levels, setLevels] = useState<number[]>([]);
    const [quality, setQuality] = useState(-1);
    // the height playing now (Auto's pick, or the chosen size)
    const [playingHeight, setPlayingHeight] = useState<number | null>(null);
    const [loop, setLoop] = useState(initialLoop);
    const [controlsShown, setControlsShown] = useState(true);
    const [menu, setMenu] = useState<Menu>(null);
    const [remaining, setRemaining] = useState(false);
    const [flash, setFlash] = useState<Flash | null>(null);
    const [ripple, setRipple] = useState<Ripple | null>(null);
    const [fast, setFast] = useState(false);
    const [unmuteHint, setUnmuteHint] = useState(autoPlay);
    const [resumeAt, setResumeAt] = useState<number | null>(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [pip, setPip] = useState(false);
    const [pipSupported, setPipSupported] = useState(false);
    const [scrubbing, setScrubbing] = useState(false);
    // State, not a ref: saving waits for the render with the loaded
    // settings, or the defaults would be written over them first
    const [prefsReady, setPrefsReady] = useState(false);

    // MP4 sizes, largest first; null for one file or an HLS stream
    const sources = Array.isArray(src)
      ? [...src].sort((a, b) => b.height - a.height)
      : null;
    const single = typeof src === "string" ? src : null;
    // a stable identity for the effect, whatever array the page passes
    const srcKey = sources ? sources.map((s) => s.src).join("|") : single;
    const downloads =
      !download || typeof download === "function"
        ? []
        : Array.isArray(download)
          ? download
          : [download];

    // A size by height; Auto is the smallest that's still sharp at the
    // player's height on this screen (the largest if none is enough).
    const pickSource = (height: number) => {
      if (!sources?.length) return null;
      if (height !== -1) {
        return sources.find((s) => s.height === height) ?? sources[0]!;
      }
      const needed =
        (rootRef.current?.clientHeight ?? 0) * (window.devicePixelRatio || 1);
      return (
        [...sources].reverse().find((s) => s.height >= needed) ?? sources[0]!
      );
    };

    // ── remembered settings and position (after mount: no SSR mismatch) ────

    useEffect(() => {
      try {
        const prefs = JSON.parse(store.get(PREFS_KEY) ?? "{}") as {
          volume?: number;
          rate?: number;
          caption?: string;
          captionSize?: CaptionSize;
        };
        if (typeof prefs.volume === "number") {
          setVolume(clamp(prefs.volume, 0, 1));
        }
        if (prefs.rate && (SPEEDS as readonly number[]).includes(prefs.rate)) {
          setRate(prefs.rate);
        }
        if (prefs.caption && captions.some((c) => c.lang === prefs.caption)) {
          setCaption(prefs.caption);
        }
        if (
          prefs.captionSize &&
          ["sm", "md", "lg"].includes(prefs.captionSize)
        ) {
          setCaptionSize(prefs.captionSize);
        }
      } catch {
        // unreadable prefs: defaults
      }
      setPrefsReady(true);
      if (resumeKey) {
        const saved = Number(store.get(resumeStorageKey(resumeKey)));
        if (saved > RESUME_MARGIN_S) setResumeAt(saved);
      }
      setPipSupported(
        "pictureInPictureEnabled" in document &&
          document.pictureInPictureEnabled
      );
      // read once, on mount
    }, []);

    useEffect(() => {
      if (!prefsReady) return;
      store.set(
        PREFS_KEY,
        JSON.stringify({ volume, rate, caption, captionSize })
      );
    }, [prefsReady, volume, rate, caption, captionSize]);

    const savePosition = (t: number, total: number) => {
      if (!resumeKey) return;
      const keep = t > RESUME_MARGIN_S && t < total - RESUME_MARGIN_S;
      store.set(resumeStorageKey(resumeKey), keep ? String(t) : null);
    };

    // ── loading: nothing until the first play ──────────────────────────────

    useEffect(() => {
      const video = videoRef.current;
      if (!activated || !video) return;
      let cancelled = false;

      const attach = async () => {
        const picked = pickSource(quality);
        if (picked) {
          video.src = picked.src;
          setPlayingHeight(picked.height);
        } else if (
          single &&
          isHls(single) &&
          !video.canPlayType("application/vnd.apple.mpegurl")
        ) {
          const { default: HlsJs } = await import("hls.js");
          if (cancelled) return;
          if (HlsJs.isSupported()) {
            const hls = new HlsJs({ enableWorker: true });
            hls.loadSource(single);
            hls.attachMedia(video);
            hls.on(HlsJs.Events.MANIFEST_PARSED, (_, data) =>
              setLevels(
                [...new Set(data.levels.map((l) => l.height))].sort(
                  (a, b) => b - a
                )
              )
            );
            hls.on(HlsJs.Events.LEVEL_SWITCHED, (_, data) =>
              setPlayingHeight(hls.levels[data.level]?.height ?? null)
            );
            hls.on(HlsJs.Events.ERROR, (_, data) => {
              if (!data.fatal) return;
              setFailed(true);
              onError?.(null);
            });
            hlsRef.current = hls;
          } else {
            setFailed(true);
            onError?.(null);
          }
        } else if (single) video.src = single;

        // settings first: an autoplay has to start muted to be allowed
        video.volume = volume;
        video.muted = muted;
        video.defaultPlaybackRate = rate;
        video.playbackRate = rate;
        // with a start point (resume, ?t=), play once the seek lands instead
        if (wantsPlay.current && startAt.current === null) {
          wantsPlay.current = false;
          void video.play().catch(() => setPlaying(false));
        }
      };
      void attach().catch(() => {
        if (cancelled) return;
        setFailed(true);
        onError?.(null);
      });

      return () => {
        cancelled = true;
        hlsRef.current?.destroy();
        hlsRef.current = null;
      };
      // settings are read once here; their own effects keep them in sync
    }, [activated, srcKey]);

    // the video follows the settings
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = volume;
      video.muted = muted;
    }, [volume, muted, activated]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      // a new file (a size switch) starts at the default rate
      video.defaultPlaybackRate = rate;
      if (!pressedFast.current) video.playbackRate = rate;
    }, [rate, activated]);

    useEffect(() => {
      if (videoRef.current) videoRef.current.loop = loop;
    }, [loop, activated]);

    // Captions are drawn by the player (so they can move above the bar):
    // the chosen track runs hidden and its cues land in captionText.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      let active: TextTrack | undefined;
      for (const track of Array.from(video.textTracks)) {
        if (track.language === caption) {
          track.mode = "hidden";
          active = track;
        } else track.mode = "disabled";
      }
      setCaptionText(null);
      if (!active) return;
      const track = active;
      const onCue = () =>
        setCaptionText(
          Array.from(track.activeCues ?? [])
            .map((cue) => (cue as VTTCue).text)
            .join("\n") || null
        );
      track.addEventListener("cuechange", onCue);
      onCue();
      return () => track.removeEventListener("cuechange", onCue);
    }, [caption, activated]);

    // React has no props for these
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const enter = () => setPip(true);
      const leave = () => setPip(false);
      video.addEventListener("enterpictureinpicture", enter);
      video.addEventListener("leavepictureinpicture", leave);
      return () => {
        video.removeEventListener("enterpictureinpicture", enter);
        video.removeEventListener("leavepictureinpicture", leave);
      };
    }, [activated]);

    // a smooth playhead while playing
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !playing) return;
      let frame = 0;
      const tick = () => {
        setTime(video.currentTime);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, [playing]);

    useEffect(() => {
      const onFullscreen = () =>
        setFullscreen(document.fullscreenElement === rootRef.current);
      document.addEventListener("fullscreenchange", onFullscreen);
      return () => {
        document.removeEventListener("fullscreenchange", onFullscreen);
        for (const t of [
          idleTimer,
          spinnerTimer,
          flashTimer,
          rippleTimer,
          tapTimer,
          pressTimer,
        ]) {
          if (t.current) clearTimeout(t.current);
        }
      };
    }, []);

    // a press outside the settings closes them
    useEffect(() => {
      if (menu !== "settings" && menu !== "chapters") return;
      const onDown = (e: globalThis.PointerEvent) => {
        const target = e.target as Element | null;
        if (target?.closest("[data-sp-settings]")) return;
        // only a press on the picture would also reach play/pause
        closedMenu.current = !!target && !!rootRef.current?.contains(target);
        setMenu(null);
      };
      document.addEventListener("pointerdown", onDown);
      return () => document.removeEventListener("pointerdown", onDown);
    }, [menu]);

    // ── actions ────────────────────────────────────────────────────────────

    // On a fresh load: play if it's the first start held back for its seek,
    // or a size switch made mid-play.
    const wantsPlayNow = () => {
      if (resumePlaying.current) {
        resumePlaying.current = false;
        return true;
      }
      if (wantsPlay.current) {
        wantsPlay.current = false;
        return true;
      }
      return false;
    };

    const start = (at?: number) => {
      startAt.current = at && at > 0 ? at : null;
      wantsPlay.current = true;
      setResumeAt(null);
      setActivated(true);
      // the poster button is about to go; keep the keyboard on the player
      rootRef.current?.focus({ preventScroll: true });
    };

    const play = () => {
      if (!activated) return start(startTime);
      setEnded(false);
      void videoRef.current?.play().catch(() => undefined);
    };
    const pause = () => videoRef.current?.pause();
    const togglePlay = () => (playing ? pause() : play());

    const seek = (t: number) => {
      const video = videoRef.current;
      if (!video) {
        if (!activated) start(t);
        return;
      }
      const next = clamp(t, 0, duration || video.duration || 0);
      video.currentTime = next;
      setTime(next);
      setEnded(false);
    };

    useImperativeHandle(ref, () => ({
      play,
      pause,
      seek,
      get video() {
        return videoRef.current;
      },
    }));

    const showFlash = (next: Omit<Flash, "key">) => {
      setFlash({ ...next, key: Date.now() });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 650);
    };

    const showControls = (idleMs = IDLE_MS) => {
      setControlsShown(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setControlsShown(false), idleMs);
    };

    const skip = (seconds: number) => {
      seek((videoRef.current?.currentTime ?? time) + seconds);
      showFlash({ text: `${seconds > 0 ? "+" : "−"}${Math.abs(seconds)}s` });
    };

    const changeVolume = (next: number) => {
      setVolume(clamp(next, 0, 1));
      setMuted(next <= 0);
      setUnmuteHint(false);
    };

    const toggleMute = () => {
      setUnmuteHint(false);
      if (muted || volume === 0) {
        setMuted(false);
        if (volume === 0) setVolume(0.8);
      } else setMuted(true);
    };

    const changeRate = (dir: 1 | -1) => {
      const i = SPEEDS.indexOf(rate as (typeof SPEEDS)[number]);
      const next =
        SPEEDS[clamp((i === -1 ? 2 : i) + dir, 0, SPEEDS.length - 1)]!;
      setRate(next);
      showFlash({ text: `${next}×` });
    };

    const toggleCaptions = () => {
      if (!captions.length) return;
      if (caption === "off") {
        setCaption(lastCaption.current ?? captions[0]!.lang);
        showFlash({ text: "Captions on" });
      } else {
        lastCaption.current = caption;
        setCaption("off");
        showFlash({ text: "Captions off" });
      }
    };

    const changeQuality = (height: number) => {
      setQuality(height);
      const hls = hlsRef.current;
      if (hls) {
        hls.currentLevel =
          height === -1 ? -1 : hls.levels.findIndex((l) => l.height === height);
        return;
      }
      // MP4 sizes: swap the file, keep the moment and whether it played
      const video = videoRef.current;
      const next = pickSource(height);
      if (!video || !next) return;
      setPlayingHeight(next.height);
      showFlash({
        text: height === -1 ? `Auto · ${next.height}p` : `${next.height}p`,
      });
      if (new URL(next.src, window.location.href).href === video.currentSrc) {
        return;
      }
      resumePlaying.current = !video.paused;
      startAt.current = video.currentTime;
      video.src = next.src;
    };

    const toggleFullscreen = () => {
      const root = rootRef.current;
      const video = videoRef.current as
        (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else if (root?.requestFullscreen) {
        void root
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

    const togglePip = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.pictureInPictureElement) {
        void document.exitPictureInPicture();
      } else void video.requestPictureInPicture().catch(() => undefined);
    };

    const retry = () => {
      setFailed(false);
      const hls = hlsRef.current;
      if (hls) hls.startLoad();
      else videoRef.current?.load();
      void videoRef.current?.play().catch(() => undefined);
    };

    const replay = () => {
      seek(0);
      play();
    };

    const currentChapter =
      chapters.filter((c) => c.start <= time + 0.05).at(-1) ??
      chapters[0] ??
      null;

    const goToChapter = (chapter: SeamChapter) => {
      setMenu(null);
      seek(chapter.start);
    };

    const startDownload = (index = 0) => {
      setMenu(null);
      if (typeof download === "function") return download();
      const file = downloads[index];
      if (!file) return;
      const link = document.createElement("a");
      link.href = file.url;
      link.download = file.filename ?? "";
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
    };

    // the page's URL with ?t= at the current second
    const copyLink = async () => {
      if (!shareUrl) return;
      const url = new URL(shareUrl, window.location.href);
      const at = Math.floor(videoRef.current?.currentTime ?? time);
      if (at > 0) url.searchParams.set("t", String(at));
      else url.searchParams.delete("t");
      await navigator.clipboard.writeText(url.toString());
    };

    // ── pointer on the picture ─────────────────────────────────────────────

    // Mouse: click plays or pauses, double click is fullscreen. Finger: a
    // tap shows the controls, a double tap on either side skips 10s (and
    // keeps adding while you tap), holding plays at 2×.
    const onSurfaceDown = (e: PointerEvent<HTMLDivElement>) => {
      rootRef.current?.focus({ preventScroll: true });
      pointerType.current = e.pointerType;
      if (e.pointerType === "mouse") return;
      if (pressTimer.current) clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        const video = videoRef.current;
        if (!video || video.paused) return;
        pressedFast.current = true;
        video.playbackRate = 2;
        setFast(true);
      }, LONG_PRESS_MS);
    };

    const onSurfaceUp = (e: PointerEvent<HTMLDivElement>) => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      if (pressedFast.current) {
        pressedFast.current = false;
        if (videoRef.current) videoRef.current.playbackRate = rate;
        setFast(false);
        return;
      }

      if (closedMenu.current) {
        closedMenu.current = false;
        return;
      }

      if (e.pointerType === "mouse") {
        if (e.button !== 0) return;
        togglePlay();
        showFlash({ icon: playing ? "pause" : "play" });
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const side = x < 0.35 ? "left" : x > 0.65 ? "right" : "center";
      const now = Date.now();
      const double =
        lastTap.current &&
        now - lastTap.current.at < DOUBLE_TAP_MS &&
        lastTap.current.side === side;

      if (double) {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        lastTap.current = { at: now, side };
        if (side === "center") return togglePlay();
        const seconds = side === "left" ? -10 : 10;
        seek((videoRef.current?.currentTime ?? time) + seconds);
        setRipple((r) => ({
          key: now,
          side,
          seconds: r && r.side === side ? r.seconds + seconds : seconds,
        }));
        if (rippleTimer.current) clearTimeout(rippleTimer.current);
        rippleTimer.current = setTimeout(() => setRipple(null), 700);
        return;
      }

      lastTap.current = { at: now, side };
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(() => {
        if (controlsShown && playing) setControlsShown(false);
        else showControls(TOUCH_IDLE_MS);
      }, DOUBLE_TAP_MS);
    };

    // ── keyboard ───────────────────────────────────────────────────────────

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // a focused button handles its own Space and Enter
      const onButton = (e.target as Element).closest("button");
      if (onButton && (e.key === " " || e.key === "Enter")) return;

      const video = videoRef.current;
      const key = e.key;
      let handled = true;

      if (key === " " || key === "k" || key === "K") {
        togglePlay();
        showFlash({ icon: playing ? "pause" : "play" });
      } else if (key === "ArrowLeft") skip(-5);
      else if (key === "ArrowRight") skip(5);
      else if (key === "j" || key === "J") skip(-10);
      else if (key === "l" || key === "L") skip(10);
      else if (key === "ArrowUp" || key === "ArrowDown") {
        const next = clamp(
          (muted ? 0 : volume) + (key === "ArrowUp" ? 0.05 : -0.05),
          0,
          1
        );
        changeVolume(next);
        showFlash({ text: `Volume ${Math.round(next * 100)}%` });
      } else if (key === "m" || key === "M") {
        toggleMute();
        showFlash({ icon: muted ? "volumeHigh" : "volumeMute" });
      } else if (key === "f" || key === "F") toggleFullscreen();
      else if (key === "c" || key === "C") toggleCaptions();
      else if (/^[0-9]$/.test(key)) seek((duration * Number(key)) / 10);
      else if (key === ">") changeRate(1);
      else if (key === "<") changeRate(-1);
      else if ((key === "," || key === ".") && video?.paused) {
        seek(video.currentTime + (key === "," ? -1 : 1) / fps);
      } else if (key === "?") {
        setMenu((m) => (m === "shortcuts" ? null : "shortcuts"));
      } else if (key === "Escape" && menu) setMenu(null);
      else handled = false;

      if (!handled) return;
      e.preventDefault();
      if (activated) showControls();
    };

    // ── render ─────────────────────────────────────────────────────────────

    const chromeVisible =
      activated &&
      !failed &&
      (!playing || controlsShown || menu !== null || scrubbing);

    const themeVars = {
      ...(theme?.accent && { "--sp-accent": theme.accent }),
      ...(theme?.accentText && { "--sp-accent-text": theme.accentText }),
      ...(theme?.radius && { "--sp-radius": theme.radius }),
      ...(theme?.font && { "--sp-font": theme.font }),
      ...(theme?.monoFont && { "--sp-font-mono": theme.monoFont }),
    } as CSSProperties;

    return (
      <div
        ref={rootRef}
        role="group"
        tabIndex={0}
        aria-label={`${title}, video player`}
        className={cx("sp", className)}
        style={{ ...themeVars, ...style }}
        data-chrome={chromeVisible || undefined}
        data-idle={(activated && playing && !chromeVisible) || undefined}
        data-fullscreen={fullscreen || undefined}
        onKeyDown={onKeyDown}
        onPointerMove={(e) =>
          e.pointerType === "mouse" && activated && showControls()
        }
        onPointerLeave={() => playing && !menu && setControlsShown(false)}
        onContextMenu={(e) => fast && e.preventDefault()}
      >
        {activated ? (
          <video
            ref={videoRef}
            className="sp-video"
            playsInline
            preload="auto"
            // captions from another host need CORS; plain playback doesn't
            crossOrigin={captions.length ? "anonymous" : undefined}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              setDuration(video.duration);
              const shouldPlay = wantsPlayNow();
              if (startAt.current !== null) {
                playAfterSeek.current = shouldPlay;
                video.currentTime = startAt.current;
                startAt.current = null;
              } else if (shouldPlay) {
                void video.play().catch(() => setPlaying(false));
              }
            }}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => {
              setPlaying(true);
              setEnded(false);
              showControls();
              onPlay?.();
            }}
            onPause={(e) => {
              setPlaying(false);
              savePosition(
                e.currentTarget.currentTime,
                e.currentTarget.duration
              );
              onPause?.();
            }}
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
              savePosition(0, 0);
              onEnded?.();
            }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              onTimeUpdate?.(t);
              if (Math.abs(t - lastSave.current) >= SAVE_EVERY_S) {
                lastSave.current = t;
                savePosition(t, e.currentTarget.duration);
              }
            }}
            onSeeked={(e) => {
              setTime(e.currentTarget.currentTime);
              if (!playAfterSeek.current) return;
              playAfterSeek.current = false;
              void e.currentTarget.play().catch(() => setPlaying(false));
            }}
            onProgress={(e) => {
              const ranges = e.currentTarget.buffered;
              setBuffered(
                Array.from({ length: ranges.length }, (_, i) => ({
                  start: ranges.start(i),
                  end: ranges.end(i),
                }))
              );
            }}
            onWaiting={() => {
              if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
              spinnerTimer.current = setTimeout(
                () => setWaiting(true),
                SPINNER_DELAY_MS
              );
            }}
            onPlaying={() => {
              if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
              setWaiting(false);
            }}
            onCanPlay={() => {
              if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
              setWaiting(false);
            }}
            onError={(e) => {
              setFailed(true);
              onError?.(e.currentTarget.error);
            }}
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
          // Poster first: an image and a button, nothing else loads yet
          <button
            type="button"
            className="sp-poster"
            aria-label={`Play ${title}`}
            onClick={() => start(startTime)}
            style={poster ? { backgroundImage: `url("${poster}")` } : undefined}
          >
            <span className="sp-bigplay">
              <Icon name="play" size={26} />
            </span>
          </button>
        )}

        {!activated && knownDuration ? (
          <span className="sp-chip sp-chip-right">
            {formatTime(knownDuration)}
          </span>
        ) : null}

        {!activated && !!startTime && startTime > 0 && (
          <span className="sp-chip sp-chip-left">
            Starts at <span className="sp-mono">{formatTime(startTime)}</span>
          </span>
        )}

        {!activated && !startTime && resumeAt !== null && (
          <button
            type="button"
            className="sp-chip sp-chip-left sp-chip-button"
            onClick={() => start(resumeAt)}
          >
            <Icon name="play" size={13} />
            Continue from{" "}
            <span className="sp-mono">{formatTime(resumeAt)}</span>
          </button>
        )}

        {/* the picture: where clicks, taps and holds land */}
        {activated && (
          <div
            className="sp-surface"
            onPointerDown={onSurfaceDown}
            onPointerUp={onSurfaceUp}
            onPointerCancel={() => {
              if (pressTimer.current) clearTimeout(pressTimer.current);
              if (pressedFast.current) {
                pressedFast.current = false;
                if (videoRef.current) videoRef.current.playbackRate = rate;
                setFast(false);
              }
            }}
            onDoubleClick={() => {
              // a finger's double tap skips instead
              if (pointerType.current === "mouse") toggleFullscreen();
            }}
          />
        )}

        {/* captions, lifted above the bar while it shows */}
        {captionText && !menu && !ended && (
          <div className="sp-caption" data-size={captionSize}>
            <span>{captionText}</span>
          </div>
        )}

        {/* what a click or key just did */}
        <div className="sp-center" aria-live="polite">
          {flash && (
            <span key={flash.key} className="sp-flash">
              {flash.icon && <Icon name={flash.icon} size={26} />}
              {flash.text && <span>{flash.text}</span>}
            </span>
          )}
        </div>

        {/* double tap: a soft half-disc on that side, adding up */}
        {ripple && (
          <div key={ripple.key} className="sp-ripple" data-side={ripple.side}>
            <span>
              <Icon
                name={ripple.side === "left" ? "back" : "forward"}
                size={28}
              />
              {ripple.seconds > 0 ? "+" : "−"}
              {Math.abs(ripple.seconds)}s
            </span>
          </div>
        )}

        {/* holding: 2× */}
        {fast && (
          <span className="sp-fast">
            2× <Icon name="fastForward" size={14} />
          </span>
        )}

        {/* autoplay starts muted: say so, one tap to fix */}
        {unmuteHint && playing && (
          <button type="button" className="sp-unmute" onClick={toggleMute}>
            <Icon name="volumeMute" size={16} />
            Tap to unmute
          </button>
        )}

        {waiting && !failed && (
          <div className="sp-center">
            <span className="sp-spinner" role="status" aria-label="Loading" />
          </div>
        )}

        {failed && (
          <div className="sp-overlay sp-error">
            <Icon name="alert" size={28} />
            <b>This video won’t play right now</b>
            <button type="button" className="sp-pill" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {ended && !failed && (
          <div className="sp-overlay sp-ended">
            <div className="sp-ended-actions">
              <button
                type="button"
                className="sp-pill sp-pill-accent"
                onClick={replay}
              >
                <Icon name="back" size={16} />
                Replay
              </button>
              {endAction && (
                <a className="sp-pill" href={endAction.href}>
                  {endAction.label}
                </a>
              )}
            </div>
          </div>
        )}

        {/* settings sit above the bar and scroll in a short player */}
        {(menu === "settings" || menu === "chapters") && (
          <div className="sp-menu-layer">
            <div data-sp-settings className="sp-menu-wrap">
              <SettingsMenu
                key={menu}
                initialPage={menu === "chapters" ? "chapters" : "main"}
                time={time}
                chapters={chapters}
                currentChapter={currentChapter}
                onChapter={goToChapter}
                rate={rate}
                onRate={setRate}
                captions={captions.map((c) => ({
                  value: c.lang,
                  label: c.label,
                }))}
                caption={caption}
                onCaption={setCaption}
                captionSize={captionSize}
                onCaptionSize={setCaptionSize}
                qualities={sources ? sources.map((s) => s.height) : levels}
                quality={quality}
                playingHeight={playingHeight}
                onQuality={changeQuality}
                loop={loop}
                onLoop={setLoop}
                downloads={downloads.map((d) => ({
                  label: d.label ?? "Original",
                  detail: d.size ? formatBytes(d.size) : undefined,
                }))}
                onDownload={download ? startDownload : undefined}
                onCopyLink={shareUrl ? copyLink : undefined}
                onShortcuts={() => setMenu("shortcuts")}
              />
            </div>
          </div>
        )}

        {menu === "shortcuts" && (
          <div className="sp-sheet-layer">
            <ShortcutSheet onClose={() => setMenu(null)} />
          </div>
        )}

        {/* the bar: not before the first play, so the poster loads alone */}
        {activated && (
          <div className="sp-bar">
            <Timeline
              duration={duration}
              currentTime={time}
              thumbnails={thumbnails}
              buffered={buffered}
              marks={chapters.map((c) => c.start)}
              onSeek={seek}
              onScrubChange={setScrubbing}
            />

            <div className="sp-controls">
              <PlayerButton
                label={playing ? "Pause (K)" : "Play (K)"}
                onClick={togglePlay}
              >
                <Icon name={playing ? "pause" : "play"} />
              </PlayerButton>
              <VolumeControl
                volume={volume}
                muted={muted}
                onVolume={changeVolume}
                onToggleMute={toggleMute}
              />
              <button
                type="button"
                className="sp-time"
                title={remaining ? "Show elapsed time" : "Show time left"}
                onClick={() => setRemaining((r) => !r)}
              >
                {remaining ? (
                  `−${formatTime(Math.max(duration - time, 0))}`
                ) : (
                  <>
                    {formatTime(time)}
                    {/* a narrow player keeps just the elapsed time */}
                    <span className="sp-time-total sp-hide-narrow">
                      {" "}
                      / {formatTime(duration)}
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
                    setMenu((m) => (m === "chapters" ? null : "chapters"))
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
                  pressed={caption !== "off"}
                  onClick={toggleCaptions}
                  className="sp-hide-narrow"
                >
                  <Icon name="captions" />
                </PlayerButton>
              )}
              <span data-sp-settings>
                <PlayerButton
                  label="Settings"
                  pressed={menu === "settings" || menu === "chapters"}
                  onClick={() =>
                    setMenu((m) => (m === "settings" ? null : "settings"))
                  }
                >
                  <Icon name="settings" />
                </PlayerButton>
              </span>
              {pipSupported && (
                <PlayerButton
                  label={pip ? "Exit picture in picture" : "Picture in picture"}
                  pressed={pip}
                  onClick={togglePip}
                  className="sp-hide-narrow"
                >
                  <Icon name="pip" />
                </PlayerButton>
              )}
              <PlayerButton
                label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                onClick={toggleFullscreen}
              >
                <Icon name={fullscreen ? "fullscreenExit" : "fullscreen"} />
              </PlayerButton>
            </div>
          </div>
        )}
      </div>
    );
  }
);
