import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { Code, DocLink, P, Section } from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";

const href = "/seamplayer/media-tools";
export const metadata = docsMetadata(seamplayer, href);

const posterExample = `<SeamPlayer src="/film.mp4" poster="/poster.jpg" duration={29} />`;

const thumbnailsExample = `<SeamPlayer
  src="/film.mp4"
  thumbnails={{
    url: "/scrub.jpg", // one image holding every frame
    width: 320,        // each frame's size in pixels
    height: 180,
    columns: 10,       // frames per row
    count: 29,         // frames in total
    interval: 1,       // seconds between frames
  }}
/>`;

const chaptersExample = `<SeamPlayer
  src="/film.mp4"
  chapters={[
    { start: 0, title: "Lisbon" },
    { start: 4, title: "Western Norway" },
    { start: 9, title: "Mumbai" },
  ]}
/>`;

const captionsExample = `<SeamPlayer
  src="/film.mp4"
  captions={[
    { src: "/captions/en.vtt", lang: "en", label: "English" },
    { src: "/captions/es.vtt", lang: "es", label: "Español" },
  ]}
/>`;

const downloadExample = `<SeamPlayer
  src="/film.mp4"
  download={[
    { url: "/film-1080.mp4", label: "1080p", size: 210_000_000 },
    { url: "/film-720.mp4", label: "720p", size: 98_000_000 },
  ]}
/>

// Or fetch a signed URL first
<SeamPlayer src="/film.mp4" download={() => downloadSigned("film")} />`;

const shareExample = `<SeamPlayer
  src="/film.mp4"
  shareUrl="/watch/launch"
  startTime={Number(searchParams.get("t")) || undefined}
/>`;

const resumeExample = `<SeamPlayer
  src="/film.mp4"
  resumeKey="launch-film"
  endAction={{ label: "Watch the next film", href: "/watch/next" }}
/>`;

export default function MediaToolsPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <Section id="poster" title="Poster and duration">
        <P>
          The poster shows until the first play, with the duration on it. The
          video itself loads only when someone presses play.
        </P>
        <CodeBlock label="Poster example">{posterExample}</CodeBlock>
      </Section>
      <Section id="filmstrip" title="Filmstrip and previews">
        <P>
          Give the player a sprite sheet: one image with <Code>count</Code>{" "}
          frames of <Code>width</Code> × <Code>height</Code>,{" "}
          <Code>columns</Code> per row. Frame <Code>i</Code> shows the moment (i
          + 0.5) × <Code>interval</Code> seconds. As the pointer comes near, the
          seek bar opens into these frames, with the one under the pointer
          magnified.
        </P>
        <CodeBlock label="Thumbnails example">{thumbnailsExample}</CodeBlock>
      </Section>
      <Section id="chapters" title="Chapters">
        <P>
          The seek bar splits into a segment at each chapter’s start, in
          seconds. The current chapter shows next to the time and in the
          settings menu.
        </P>
        <CodeBlock label="Chapters example">{chaptersExample}</CodeBlock>
      </Section>
      <Section id="captions" title="Captions">
        <P>
          Pass WebVTT files. The player draws captions itself, above its
          controls, and viewers choose the track and text size. Caption files on
          another origin need CORS.
        </P>
        <CodeBlock label="Captions example">{captionsExample}</CodeBlock>
      </Section>
      <Section id="downloads" title="Downloads">
        <P>
          Offer one file, several sizes listed with their file sizes, or your
          own handler. URLs must be on your origin or send a{" "}
          <Code>Content-Disposition: attachment</Code> header.
        </P>
        <CodeBlock label="Downloads example">{downloadExample}</CodeBlock>
      </Section>
      <Section id="links-to-a-moment" title="Links to a moment">
        <P>
          With <Code>shareUrl</Code>, the menu offers “Copy link at 0:12”. The
          player appends <Code>?t=12</Code> to the URL; read it on that page and
          pass it back as <Code>startTime</Code>.
        </P>
        <CodeBlock label="Share link example">{shareExample}</CodeBlock>
      </Section>
      <Section id="resume-and-end-screen" title="Resume and the end screen">
        <P>
          A <Code>resumeKey</Code> remembers where each viewer stopped and
          offers “Continue from” next time. <Code>endAction</Code> adds a button
          beside Replay when the video ends. Volume, speed, and caption choices
          are remembered across every player on the site.
        </P>
        <CodeBlock label="Resume example">{resumeExample}</CodeBlock>
        <P>
          Try each tool on and off in the{" "}
          <DocLink href="/seamplayer/playground">playground</DocLink>.
        </P>
      </Section>
    </DocsPage>
  );
}
