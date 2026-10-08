import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { Code, List, P, Section } from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";

const href = "/seamplayer/sources";
export const metadata = docsMetadata(seamplayer, href);

const singleExample = `<SeamPlayer src="/film.mp4" poster="/poster.jpg" />`;

const sizesExample = `<SeamPlayer
  src={[
    { src: "/film-1080.mp4", height: 1080 },
    { src: "/film-720.mp4", height: 720 },
    { src: "/film-480.mp4", height: 480 },
  ]}
  poster="/poster.jpg"
/>`;

const hlsExample = `<SeamPlayer
  src="https://cdn.example.com/launch/master.m3u8"
  poster="https://cdn.example.com/launch/poster.jpg"
/>`;

export default function SourcesPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <Section id="one-file" title="One file">
        <P>
          Pass any MP4 or WebM URL the browser can play. Nothing downloads until
          someone presses play, so add a <Code>poster</Code> to show a frame in
          the meantime.
        </P>
        <CodeBlock label="Single source example">{singleExample}</CodeBlock>
      </Section>
      <Section id="several-sizes" title="Several sizes">
        <P>
          Pass the same video in several MP4 sizes with their pixel heights. The
          settings menu gains a Quality row.
        </P>
        <CodeBlock label="Several sizes example">{sizesExample}</CodeBlock>
        <List>
          <li>
            <strong>Auto</strong> picks the smallest size that’s sharp at the
            player’s size on that screen.
          </li>
          <li>
            Switching keeps the current moment, and whether the video was
            playing.
          </li>
          <li>List the sizes in any order; the menu sorts them.</li>
        </List>
      </Section>
      <Section id="hls" title="HLS streams">
        <P>
          Pass an <Code>.m3u8</Code> playlist. Quality levels come from the
          stream itself. Browsers that play HLS natively, like Safari, use it
          directly; others load <Code>hls.js</Code> on the first play, so it
          never weighs down the page.
        </P>
        <CodeBlock label="HLS example">{hlsExample}</CodeBlock>
      </Section>
      <Section id="errors" title="Errors">
        <P>
          If a source can’t play, including an HLS stream that fails to load,
          the player shows an error state and calls <Code>onError</Code> with
          the <Code>MediaError</Code>.
        </P>
      </Section>
    </DocsPage>
  );
}
