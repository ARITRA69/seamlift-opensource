import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import {
  Code,
  Definitions,
  DocLink,
  P,
  Section,
} from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";
import { generateExample } from "@/lib/playground";

const href = "/seamplayer/react-api";
export const metadata = docsMetadata(seamplayer, href);

const refExample = generateExample(
  { src: "/film.mp4" },
  { controls: true, events: false }
);
const refExampleJavascript = generateExample(
  { src: "/film.mp4" },
  { controls: true, events: false },
  "javascript"
);
const eventsExample = generateExample(
  { src: "/film.mp4" },
  { controls: false, events: true }
);
const eventsExampleJavascript = generateExample(
  { src: "/film.mp4" },
  { controls: false, events: true },
  "javascript"
);

const handle = [
  ["play()", "Start playback. Loads the video on first use."],
  ["pause()", "Pause playback."],
  ["seek(time)", "Jump to a moment, in seconds."],
  [
    "video",
    "The underlying HTML video element, once the first play has created it. Otherwise null.",
  ],
] as const;

export default function ReactApiPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <Section id="handle" title="SeamPlayerHandle">
        <P>
          Pass a ref to control the player from your own buttons, keyboard
          handlers, or synced content.
        </P>
        <CodeBlock
          label="Imperative player API"
          javascriptCode={refExampleJavascript}
        >
          {refExample}
        </CodeBlock>
        <Definitions items={handle} />
      </Section>
      <Section id="events" title="Events">
        <P>
          <Code>onPlay</Code>, <Code>onPause</Code>, <Code>onEnded</Code>,{" "}
          <Code>onTimeUpdate</Code>, and <Code>onError</Code> report playback as
          it happens.
        </P>
        <CodeBlock
          label="Playback events example"
          javascriptCode={eventsExampleJavascript}
        >
          {eventsExample}
        </CodeBlock>
        <P>
          Turn on Imperative controls or Playback events in the{" "}
          <DocLink href="/seamplayer/playground">playground</DocLink> to
          generate either example for your own configuration.
        </P>
      </Section>
    </DocsPage>
  );
}
