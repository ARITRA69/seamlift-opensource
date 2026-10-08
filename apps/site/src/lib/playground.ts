import type { SeamPlayerProps } from "seamplayer";
import { demoProps } from "./player-demo";

export const featureGroups = [
  {
    title: "Media tools",
    items: [
      {
        key: "poster",
        label: "Poster",
        detail: "An image before the first play.",
      },
      {
        key: "thumbnails",
        label: "Filmstrip & previews",
        detail: "See frames while seeking.",
      },
      {
        key: "chapters",
        label: "Chapters",
        detail: "Seven moments on the timeline.",
      },
      {
        key: "captions",
        label: "Captions",
        detail: "English subtitles and text sizes.",
      },
      {
        key: "download",
        label: "Downloads",
        detail: "Save the available video sizes.",
      },
      {
        key: "share",
        label: "Links to a moment",
        detail: "Copy a link with a timestamp.",
      },
    ],
  },
  {
    title: "Playback",
    items: [
      {
        key: "autoPlay",
        label: "Autoplay",
        detail: "Starts muted with tap to unmute.",
      },
      { key: "loop", label: "Loop", detail: "Start with repeat enabled." },
      {
        key: "resume",
        label: "Resume playback",
        detail: "Remember where you stopped.",
      },
      {
        key: "endAction",
        label: "End screen action",
        detail: "An extra button beside Replay.",
      },
    ],
  },
  {
    title: "React API",
    items: [
      {
        key: "controls",
        label: "Imperative controls",
        detail: "Play, pause, and seek through a ref.",
      },
      {
        key: "events",
        label: "Playback events",
        detail: "Watch play, pause, time, end, and errors.",
      },
    ],
  },
] as const;

export type Feature = (typeof featureGroups)[number]["items"][number]["key"];
export type PlaygroundConfig = Record<Feature, boolean> & {
  source: "qualities" | "single" | "custom";
  customSrc: string;
  title: string;
  startTime: number;
  fps: number;
  accent: "pop" | "sun";
  radius: "0px" | "8px" | "16px" | "24px";
  font: "brand" | "system";
};

export const defaultConfig: PlaygroundConfig = {
  poster: true,
  thumbnails: true,
  chapters: true,
  captions: true,
  download: true,
  share: true,
  autoPlay: false,
  loop: false,
  resume: true,
  endAction: false,
  controls: false,
  events: false,
  source: "qualities",
  customSrc: "/demo/film.mp4",
  title: demoProps.title,
  startTime: 0,
  fps: demoProps.fps,
  accent: "pop",
  radius: "16px",
  font: "brand",
};

export function buildPlayerProps(config: PlaygroundConfig): SeamPlayerProps {
  const custom = config.source === "custom";
  const props: SeamPlayerProps = {
    src:
      config.source === "qualities"
        ? demoProps.src
        : custom
          ? config.customSrc
          : "/demo/film.mp4",
    title: config.title,
    fps: config.fps,
    theme: {
      accent: config.accent === "pop" ? "#e0115f" : "#ffd23f",
      accentText: config.accent === "pop" ? "#ffffff" : "#1a0b14",
      radius: config.radius,
      font:
        config.font === "brand"
          ? '"Instrument Sans", sans-serif'
          : "system-ui, sans-serif",
      monoFont:
        config.font === "brand"
          ? '"JetBrains Mono", monospace'
          : "ui-monospace, monospace",
    },
  };
  // Demo assets describe this cut; they cannot describe an arbitrary source.
  if (!custom) {
    props.duration = demoProps.duration;
    if (config.poster) props.poster = demoProps.poster;
    if (config.thumbnails) props.thumbnails = demoProps.thumbnails;
    if (config.chapters) props.chapters = demoProps.chapters;
    if (config.captions) props.captions = demoProps.captions;
  }
  if (config.download)
    props.download = custom
      ? { url: config.customSrc, label: "Original" }
      : config.source === "qualities"
        ? demoProps.download
        : demoProps.download[0];
  if (config.share && !custom) props.shareUrl = "/seamplayer";
  if (config.startTime > 0) props.startTime = config.startTime;
  if (config.autoPlay) props.autoPlay = true;
  if (config.loop) props.loop = true;
  if (config.resume)
    props.resumeKey = `seamplayer-playground-${custom ? config.customSrc : config.source}`;
  if (config.endAction)
    props.endAction = { label: "Back to playground", href: "#playground" };
  return props;
}

export function validMediaUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value, "https://seamplayer.example");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type ExampleLanguage = "typescript" | "javascript";

export function generateExample(
  props: SeamPlayerProps,
  config: Pick<PlaygroundConfig, "controls" | "events">,
  language: ExampleLanguage = "typescript"
): string {
  const typescript = language === "typescript";
  const hooks = [
    config.controls && "useRef",
    config.events && "useState",
  ].filter(Boolean);
  const types = [
    "SeamPlayerProps",
    config.controls && "SeamPlayerHandle",
  ].filter(Boolean);
  return `"use client";

${hooks.length ? `import { ${hooks.join(", ")} } from "react";\n` : ""}import { SeamPlayer${typescript ? `, type ${types.join(", type ")}` : ""} } from "seamplayer";

const options = ${JSON.stringify(props, null, 2)}${typescript ? " satisfies SeamPlayerProps" : ""};

export default function PlayerExample() {
${config.controls ? `  const player = useRef${typescript ? "<SeamPlayerHandle>" : ""}(null);\n` : ""}${config.events ? `  const [status, setStatus] = useState("Ready");\n` : ""}  return (
    <div id="playground">
      <SeamPlayer
        {...options}
${config.controls ? `        ref={player}\n` : ""}${
    config.events
      ? `        onPlay={() => setStatus("Playing")}
        onPause={() => setStatus("Paused")}
        onEnded={() => setStatus("Ended")}
        onTimeUpdate={(time) => setStatus(\`Time: \${Math.floor(time)}s\`)}
        onError={(error) => setStatus(\`Error: \${error?.message || "Unable to play this source"}\`)}
`
      : ""
  }      />
${
  config.controls
    ? `      <div>
        <button onClick={() => player.current?.play()}>Play</button>
        <button onClick={() => player.current?.pause()}>Pause</button>
        <button onClick={() => player.current?.seek(0)}>Seek to start</button>
      </div>
`
    : ""
}${config.events ? `      <p role="status">{status}</p>\n` : ""}    </div>
  );
}
`;
}
