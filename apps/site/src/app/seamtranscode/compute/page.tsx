import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { P, Section, DocLink, Code } from "@/components/docs/prose";
import { docsMetadata, seamtranscode } from "@/lib/docs";
const href = "/seamtranscode/compute";
export const metadata = docsMetadata(seamtranscode, href);
export default function Page() {
  return (
    <DocsPage project={seamtranscode} href={href}>
      <Section id="local" title="Your own machine or server">
        <P>
          The library and CLI run on the current machine. The <Code>auto</Code>
          encoder tests supported hardware encoders and falls back to{" "}
          <Code>libx264</Code>. A worker can run in a VM or Docker; short-lived
          serverless functions need <Code>ffmpeg</Code> and enough execution
          time.
        </P>
        <CodeBlock label="Your own machine or server" language="typescript">
          {
            'await transcode({ input: "film.mp4", output: "out/film", encoder: "auto" });'
          }
        </CodeBlock>
      </Section>
      <Section id="distributed" title="One worker per rendition">
        <P>
          {
            "The plan is plain JSON. Send it through a queue and have each worker encode one named rendition, then collect results and finish. Use shared storage and an input key; local input paths must exist on every machine."
          }
        </P>
        <CodeBlock label="One worker per rendition" language="typescript">
          {
            'import { planTranscode, encodeRendition, finishTranscode } from "seamtranscode";\nconst plan = await planTranscode({ storage, input: { key: "uploads/film.mp4" }, output: "videos/film" });\nconst results = await Promise.all(plan.renditions.map((r) => encodeRendition(plan, r.name, { storage })));\nconst result = await finishTranscode(plan, results, { storage });'
          }
        </CodeBlock>
      </Section>
      <Section id="modal" title="Modal recipe">
        <P>
          <Code>recipes/modal/app.py</Code> builds the local Node package into
          an image. Configure the <Code>seamtranscode-storage</Code> secret with
          S3/R2 credentials, then run one container per rendition with previews
          in parallel. No Python encoding fork or published npm release is
          required. The recipe is not deployed by repository checks.
        </P>
        <CodeBlock label="Modal recipe" language="bash">
          {
            "modal run recipes/modal/app.py --key uploads/film.mp4 --output videos/film"
          }
        </CodeBlock>
      </Section>
      <Section id="docker" title="Docker worker">
        <P>
          The image includes <Code>ffmpeg</Code>, <Code>sharp</Code> and the S3
          SDK. Its HTTP worker uses environment variables and never serves media
          files directly. A local output mount must be writable by the{" "}
          <Code>node</Code> user.
        </P>
        <CodeBlock label="Docker worker" language="bash">
          {
            'docker build -t seamtranscode packages/seamtranscode\ndocker run --rm -p 8100:8100 -e SEAMTRANSCODE_SECRET=your-secret -e SEAMTRANSCODE_ROOT=/media -v "$PWD/media:/media" seamtranscode'
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
