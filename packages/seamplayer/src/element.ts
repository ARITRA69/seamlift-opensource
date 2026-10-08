import { createSeamPlayer } from "./player";
import type {
  SeamPlayerHandle,
  SeamPlayerInstance,
  SeamPlayerOptions,
} from "./types";

const attributes = {
  src: "src",
  title: "title",
  poster: "poster",
  duration: "duration",
  "start-time": "startTime",
  autoplay: "autoPlay",
  loop: "loop",
  "resume-key": "resumeKey",
  fps: "fps",
  "share-url": "shareUrl",
  thumbnails: "thumbnails",
  chapters: "chapters",
  captions: "captions",
  download: "download",
  theme: "theme",
  "end-action": "endAction",
} as const;
const numbers = new Set(["duration", "startTime", "fps"]);
const booleans = new Set(["autoPlay", "loop"]);
const structured = new Set([
  "thumbnails",
  "chapters",
  "captions",
  "download",
  "theme",
  "endAction",
]);
const properties = [
  ...Object.values(attributes).filter((key) => key !== "title"),
  "onPlay",
  "onPause",
  "onEnded",
  "onTimeUpdate",
  "onError",
] as const;

// Importing this entry on the server is safe; registration runs in the browser.
const Base = (
  typeof HTMLElement === "undefined" ? class {} : HTMLElement
) as typeof HTMLElement;

/** A <seam-player> with attributes for simple options and properties for rich data. */
export type SeamPlayerElement = HTMLElement &
  SeamPlayerHandle &
  Omit<SeamPlayerOptions, "title" | "className" | "style"> & {
    options: SeamPlayerOptions;
  };

class PlayerElement extends Base implements SeamPlayerHandle {
  declare src: SeamPlayerOptions["src"];
  declare poster: SeamPlayerOptions["poster"];
  declare duration: SeamPlayerOptions["duration"];
  declare startTime: SeamPlayerOptions["startTime"];
  declare autoPlay: SeamPlayerOptions["autoPlay"];
  declare loop: SeamPlayerOptions["loop"];
  declare resumeKey: SeamPlayerOptions["resumeKey"];
  declare fps: SeamPlayerOptions["fps"];
  declare shareUrl: SeamPlayerOptions["shareUrl"];
  declare thumbnails: SeamPlayerOptions["thumbnails"];
  declare chapters: SeamPlayerOptions["chapters"];
  declare captions: SeamPlayerOptions["captions"];
  declare download: SeamPlayerOptions["download"];
  declare theme: SeamPlayerOptions["theme"];
  declare endAction: SeamPlayerOptions["endAction"];
  declare onPlay: SeamPlayerOptions["onPlay"];
  declare onPause: SeamPlayerOptions["onPause"];
  declare onEnded: SeamPlayerOptions["onEnded"];
  declare onTimeUpdate: SeamPlayerOptions["onTimeUpdate"];
  declare onError: SeamPlayerOptions["onError"];

  static observedAttributes = Object.keys(attributes);
  private supplied: Partial<SeamPlayerOptions> = {};
  private instance: SeamPlayerInstance | null = null;

  constructor() {
    super();
    // Preserve properties assigned before the browser loaded this definition.
    for (const name of ["options", ...properties]) {
      if (Object.prototype.hasOwnProperty.call(this, name)) {
        const value = Reflect.get(this, name);
        Reflect.deleteProperty(this, name);
        Reflect.set(this, name, value);
      }
    }
  }

  get options(): SeamPlayerOptions {
    const values: Record<string, unknown> = { src: "" };
    for (const [attribute, key] of Object.entries(attributes)) {
      const raw = this.getAttribute(attribute);
      if (raw === null) continue;
      if (booleans.has(key)) values[key] = raw !== "false";
      else if (numbers.has(key)) {
        const value = Number(raw);
        if (Number.isFinite(value)) values[key] = value;
      } else if (
        structured.has(key) ||
        (key === "src" && raw.trim().startsWith("["))
      ) {
        try {
          values[key] = JSON.parse(raw);
        } catch {
          /* ignore malformed JSON */
        }
      } else values[key] = raw;
    }
    return { ...values, ...this.supplied } as SeamPlayerOptions;
  }

  set options(options: SeamPlayerOptions) {
    this.supplied = { ...options };
    this.sync();
  }

  connectedCallback() {
    this.sync();
  }
  disconnectedCallback() {
    // Moving an element in the same document should keep playback intact.
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.instance?.destroy();
        this.instance = null;
      }
    });
  }
  attributeChangedCallback(name: keyof typeof attributes) {
    delete this.supplied[attributes[name]];
    this.sync();
  }

  private sync() {
    if (!this.isConnected) return;
    const options = this.options;
    const emit = (name: string, detail?: unknown) => {
      const Event = this.ownerDocument.defaultView!.CustomEvent;
      this.dispatchEvent(
        new Event(name, { detail, bubbles: true, composed: true })
      );
    };
    const wired = {
      ...options,
      onPlay: () => {
        options.onPlay?.();
        emit("play");
      },
      onPause: () => {
        options.onPause?.();
        emit("pause");
      },
      onEnded: () => {
        options.onEnded?.();
        emit("ended");
      },
      onTimeUpdate: (time: number) => {
        options.onTimeUpdate?.(time);
        emit("timeupdate", time);
      },
      onError: (error: MediaError | null) => {
        options.onError?.(error);
        emit("error", error);
      },
    };
    if (this.instance) this.instance.update(wired);
    else this.instance = createSeamPlayer(this, wired);
  }

  play() {
    this.instance?.play();
  }
  pause() {
    this.instance?.pause();
  }
  seek(time: number) {
    this.instance?.seek(time);
  }
  get video() {
    return this.instance?.video ?? null;
  }
}

for (const name of properties) {
  Object.defineProperty(PlayerElement.prototype, name, {
    configurable: true,
    get(this: SeamPlayerElement) {
      return this.options[name];
    },
    set(this: SeamPlayerElement, value: unknown) {
      this.options = { ...this.options, [name]: value };
    },
  });
}

// Expose only the structural public API. ESM and CommonJS declarations can
// coexist without two incompatible private class types in the global tag map.
export const SeamPlayerElement: {
  new (): SeamPlayerElement;
  readonly prototype: SeamPlayerElement;
  readonly observedAttributes: readonly string[];
} = PlayerElement;

/** Register once. The default tag is <seam-player>. */
export function defineSeamPlayer() {
  if (
    typeof customElements !== "undefined" &&
    !customElements.get("seam-player")
  ) {
    customElements.define("seam-player", SeamPlayerElement);
  }
}

defineSeamPlayer();

declare global {
  interface HTMLElementTagNameMap {
    "seam-player": SeamPlayerElement;
  }
}
