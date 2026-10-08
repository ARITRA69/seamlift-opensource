import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { P, Section, DocLink, Code } from "@/components/docs/prose";
import { docsMetadata, seamtranscode } from "@/lib/docs";
const href = "/seamtranscode";
export const metadata = docsMetadata(seamtranscode, href);
export default function Page() {
  return (
    <DocsPage project={seamtranscode} href={href}>
      <Section id="quickstart" title="From upload to playback">
        <P>
          {
            "One call creates aligned HLS renditions, a representative poster and a filmstrip scrub sheet. The same output fits every seamplayer adapter."
          }
        </P>
        <CodeBlock label="From upload to playback" language="typescript">
          {
            'import { local, transcode, toSeamPlayer } from "seamtranscode";\nconst result = await transcode({ input: "uploads/film.mp4", output: "videos/film", storage: local({ root: "public", publicUrl: "/" }) });\nconst media = toSeamPlayer(result);\n// <SeamPlayer {...media} title="Film" />'
          }
        </CodeBlock>
      </Section>
      <Section id="defaults" title="Useful defaults">
        <P>
          360p, 720p and 1080p short-side renditions, never above the source;
          rotation-aware dimensions; aligned six-second segments; capped and
          measured peak bitrates. Poster and scrub metadata are included. The
          library defaults to <Code>libx264</Code> and the CLI defaults to
          hardware auto detection.
        </P>
      </Section>
      <Section id="progress" title="Playable while the job finishes">
        <P>
          The smallest rendition completes first. Progress is a fraction from 0
          to 1, with an ETA when available. Preview failures become warnings;{" "}
          <Code>AbortSignal</Code> cancels work and cleans temporary files.
        </P>
        <CodeBlock
          label="Playable while the job finishes"
          language="typescript"
        >
          {
            'await transcode({ input: "film.mp4", output: "out/film", encoder: "auto", onProgress: ({ progress, eta }) => console.log(progress, eta), onRendition: (r) => console.log(r.playlist) });'
          }
        </CodeBlock>
      </Section>
      <P>
        <DocLink href="https://github.com/ARITRA69/seamlift-opensource">
          Source and complete examples on GitHub
        </DocLink>
      </P>
    </DocsPage>
  );
}
