import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { P, Section, DocLink, Code } from "@/components/docs/prose";
import { docsMetadata, seamtranscode } from "@/lib/docs";
const href = "/seamtranscode/installation";
export const metadata = docsMetadata(seamtranscode, href);
export default function Page() {
  return (
    <DocsPage project={seamtranscode} href={href}>
      <Section id="install" title="Install">
        <P>
          Requires Node 18.17+ or Bun and <Code>ffmpeg</Code>/
          <Code>ffprobe</Code> on the encoding machine. Install{" "}
          <Code>sharp</Code> only for image previews and the AWS SDK only for
          S3/R2.
        </P>
        <CodeBlock label="Install" language="bash">
          {
            "npm install seamtranscode\nbrew install ffmpeg\n# Debian / Ubuntu: sudo apt-get install ffmpeg"
          }
        </CodeBlock>
      </Section>
      <Section id="cli" title="Encode and preview">
        <P>
          The CLI writes HLS and <Code>seamtranscode.json</Code>. Preview binds
          to <Code>localhost</Code> and loads <Code>seamplayer</Code> from a
          CDN, so it needs internet. Progress goes to <Code>stderr</Code>;{" "}
          <Code>--json</Code> prints the result to <Code>stdout</Code>.
        </P>
        <CodeBlock label="Encode and preview" language="bash">
          {
            "npx seamtranscode film.mp4 -o ./film\nnpx seamtranscode preview ./film\nnpx seamtranscode film.mp4 --renditions 360,720 --no-scrub --json\nnpx seamtranscode --help"
          }
        </CodeBlock>
      </Section>
      <Section id="previews" title="Images and previews only">
        <P>
          Video previews work with <Code>ffmpeg</Code>. Image and SVG previews
          need <Code>sharp</Code>. EXIF orientation and transparency are
          preserved; external SVG resources are rejected.
        </P>
        <CodeBlock label="Images and previews only" language="typescript">
          {
            'import { previews } from "seamtranscode";\nawait previews({ input: "film.mp4", output: "out/previews" });'
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
