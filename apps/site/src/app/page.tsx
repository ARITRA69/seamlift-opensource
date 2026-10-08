import { HeroDemo } from "@/components/hero-demo";
import { PageNavigation } from "@/components/page-navigation";
import { PlayerPlayground } from "@/components/player-playground";
import { generateExample } from "@/lib/playground";

const basicExample = `import { SeamPlayer } from "seamplayer";
import "seamplayer/styles.css";

export default function Film() {
  return (
    <SeamPlayer
      src="/film.mp4"
      poster="/poster.jpg"
      title="Your film"
    />
  );
}`;

const themeExample = `<SeamPlayer
  src="/film.mp4"
  theme={{
    accent: "#e0115f",
    accentText: "#ffffff",
    radius: "16px",
    font: "system-ui, sans-serif",
    monoFont: "ui-monospace, monospace",
  }}
/>`;

const refExample = generateExample(
  { src: "/film.mp4" },
  { controls: true, events: false }
);

const documentedProps = [
  ["poster", "Image URL shown before the first play."],
  [
    "thumbnails",
    "Sprite sheet URL, frame width and height, columns, count, and interval in seconds. Powers filmstrip seeking and hover previews.",
  ],
  [
    "chapters",
    "An array of { start, title } entries. Start times are in seconds; the seek bar splits at each chapter.",
  ],
  [
    "captions",
    "WebVTT tracks with a src, language code, and label. Viewers choose the track and text size.",
  ],
  [
    "download",
    "One file, an array of files with optional names and sizes, or your own download handler.",
  ],
  [
    "shareUrl",
    "The page URL to share. The player appends ?t=<seconds>; pass that value back as startTime.",
  ],
  [
    "autoPlay",
    "Start playback immediately, muted, with a tap-to-unmute button.",
  ],
  ["loop", "Start with repeat enabled. Viewers can change it in settings."],
  [
    "resumeKey",
    "A stable key for the video. Remember the stopped position and offer Continue from.",
  ],
  [
    "endAction",
    "An extra { label, href } link beside Replay on the end screen.",
  ],
  ["title", "The accessible name of the video player."],
  ["duration", "Duration in seconds, shown before video loads."],
  ["startTime", "Start at a second, including a shared link’s ?t= value."],
  ["fps", "Frame rate for stepping with the comma and period keys."],
] as const;

function CodeBlock({ children, label }: { children: string; label: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label={label}
      className="overflow-x-auto rounded-lg border bg-muted/40 p-5 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
    >
      <code>{children}</code>
    </pre>
  );
}

export default function Home() {
  return (
    <div id="top" className="mx-auto max-w-6xl px-5 sm:px-8">
      <header className="flex items-center justify-center gap-2 pt-10 pb-7 sm:pt-12">
        <h1 className="text-lg font-semibold tracking-tight">
          <a href="#top" aria-label="Seamplayer home">
            seamplayer
          </a>
        </h1>
        <span className="text-muted-foreground">for</span>
        <span className="text-sm font-medium">React</span>
      </header>
      <main>
        <section id="intro" aria-label="Seamplayer for React" className="pb-16">
          <HeroDemo />
        </section>
        <div className="grid items-start gap-10 lg:grid-cols-5 lg:gap-12">
          <PageNavigation />
          <div className="min-w-0 space-y-20 lg:col-span-4">
            <section
              id="basic-usage"
              aria-labelledby="usage-title"
              className="max-w-2xl scroll-mt-10 space-y-5"
            >
              <h2
                id="usage-title"
                className="text-xl font-semibold tracking-tight"
              >
                Basic usage
              </h2>
              <CodeBlock label="Install Seamplayer">
                npm install seamplayer
              </CodeBlock>
              <CodeBlock label="Basic React example">{basicExample}</CodeBlock>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Import the player and its stylesheet. It fills its container at
                16:9 and loads video when someone presses play. Supports React
                18 and 19, MP4, WebM, and HLS.
              </p>
            </section>
            <section
              id="playground"
              tabIndex={-1}
              aria-labelledby="playground-title"
              className="scroll-mt-10 space-y-6"
            >
              <div className="max-w-2xl space-y-3">
                <h2
                  id="playground-title"
                  className="text-xl font-semibold tracking-tight"
                >
                  Playground
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Switch tools on and off, change the appearance, or bring your
                  own video. The complete React example follows every change.
                </p>
              </div>
              <PlayerPlayground />
            </section>
            <section
              id="props"
              aria-labelledby="props-title"
              className="max-w-2xl scroll-mt-10 space-y-6"
            >
              <h2
                id="props-title"
                className="text-xl font-semibold tracking-tight"
              >
                Props
              </h2>
              <div className="space-y-4 text-sm leading-relaxed">
                <h3 className="font-mono font-medium">
                  src: string | SeamSource[]
                </h3>
                <p className="text-muted-foreground">
                  Use a single media URL or several files of the same video with
                  their pixel heights. Auto quality picks a suitable size;
                  switching preserves the moment and playback state. HLS gets
                  quality levels from its playlist.
                </p>
              </div>
              <dl className="divide-y">
                {documentedProps.map(([name, description]) => (
                  <div
                    key={name}
                    className="grid gap-2 py-4 sm:grid-cols-3 sm:gap-6"
                  >
                    <dt className="font-mono text-sm">{name}</dt>
                    <dd className="text-sm leading-relaxed text-muted-foreground sm:col-span-2">
                      {description}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Captions use WebVTT; cross-origin caption files need CORS.
                Download URLs should be on your origin or return an attachment
                header. The playground’s code includes complete chapter,
                caption, thumbnail, and download data.
              </p>
            </section>
            <section
              id="styling"
              aria-labelledby="styling-title"
              className="max-w-2xl scroll-mt-10 space-y-5"
            >
              <h2
                id="styling-title"
                className="text-xl font-semibold tracking-tight"
              >
                Styling
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The theme prop controls accent colors, corners, and fonts. Try
                Pop or Sun, square corners, and your system font in the
                playground.
              </p>
              <CodeBlock label="Player theme example">{themeExample}</CodeBlock>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Use className or style to control layout. Colors also read from
                CSS variables in the package stylesheet. The default font
                inherits from your page.
              </p>
            </section>
            <section
              id="react-api"
              aria-labelledby="api-title"
              className="max-w-2xl scroll-mt-10 space-y-5"
            >
              <h2
                id="api-title"
                className="text-xl font-semibold tracking-tight"
              >
                React API
              </h2>
              <h3 className="font-mono text-sm font-medium">
                SeamPlayerHandle
              </h3>
              <CodeBlock label="Imperative player API">{refExample}</CodeBlock>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The handle also exposes video, the underlying HTML video
                element, after the first play.
              </p>
              <h3 className="font-mono text-sm font-medium">
                onPlay · onPause · onEnded · onTimeUpdate · onError
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Enable Imperative controls or Playback events in the playground
                to generate a complete component with refs, callbacks, and a
                live status display.
              </p>
              <a
                href="https://github.com/ARITRA69/seamplayer/tree/main/packages/seamplayer#readme"
                className="inline-block text-sm underline underline-offset-4"
              >
                Read the full API reference ↗
              </a>
            </section>
            <footer className="max-w-2xl border-t pt-7 pb-32 text-sm text-muted-foreground">
              Built by Seamlift. Open source, MIT licensed.
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
