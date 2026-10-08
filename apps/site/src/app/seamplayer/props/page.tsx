import { DocsPage } from "@/components/docs/docs-page";
import {
  Code,
  Definitions,
  DocLink,
  H3,
  P,
  Section,
} from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";

const href = "/seamplayer/props";
export const metadata = docsMetadata(seamplayer, href);

const media = [
  ["title", "The accessible name of the player. Default “Video”."],
  ["poster", "Image URL shown before the first play."],
  ["duration", "Duration in seconds, shown before the video loads."],
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
    "One file, an array of files with optional labels, file names, and sizes, or your own download handler.",
  ],
  [
    "shareUrl",
    "The page URL to share. The player appends ?t=<seconds>; pass that value back as startTime.",
  ],
] as const;

const playback = [
  ["startTime", "Start at a second, including a shared link’s ?t= value."],
  ["autoPlay", "Start immediately, muted, with a tap-to-unmute button."],
  ["loop", "Start with Loop on. Viewers can change it in settings."],
  [
    "resumeKey",
    "A stable key for the video. Remembers the stopped position and offers Continue from.",
  ],
  [
    "fps",
    "Frame rate for stepping with the comma and period keys. Default 30.",
  ],
  [
    "endAction",
    "An extra { label, href } button beside Replay on the end screen.",
  ],
] as const;

const appearance = [
  [
    "theme",
    "Accent, background, surface, text, and highlight colors, radius, and fonts.",
  ],
  ["className", "Classes for the player’s root element."],
  ["style", "Inline styles for the player’s root element."],
] as const;

const events = [
  ["onPlay", "Playback started."],
  ["onPause", "Playback paused."],
  ["onEnded", "The video reached its end."],
  ["onTimeUpdate", "(time: number) => void, as playback moves."],
  [
    "onError",
    "(error: MediaError | null) => void, when the source can’t play.",
  ],
] as const;

export default function PropsPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <Section id="src" title="src">
        <P>
          <Code>string | SeamSource[]</Code>, required. A single MP4, WebM, or
          HLS URL, or several files of the same video with their pixel heights.
          See <DocLink href="/seamplayer/sources">Sources and quality</DocLink>.
        </P>
      </Section>
      <Section id="media" title="Media">
        <Definitions items={media} />
      </Section>
      <Section id="playback" title="Playback">
        <Definitions items={playback} />
      </Section>
      <Section id="appearance" title="Appearance">
        <Definitions items={appearance} />
      </Section>
      <Section id="events" title="Events">
        <Definitions items={events} />
        <H3 id="types">Types</H3>
        <P>
          <Code>SeamPlayerProps</Code>, <Code>SeamSource</Code>,{" "}
          <Code>SeamThumbnails</Code>, <Code>SeamChapter</Code>,{" "}
          <Code>SeamCaption</Code>, <Code>SeamDownload</Code>,{" "}
          <Code>SeamTheme</Code>, and <Code>SeamPlayerHandle</Code> are exported
          from <Code>seamplayer</Code>.
        </P>
      </Section>
    </DocsPage>
  );
}
