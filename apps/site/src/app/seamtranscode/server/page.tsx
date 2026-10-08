import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { P, Section, DocLink, Code } from "@/components/docs/prose";
import { docsMetadata, seamtranscode } from "@/lib/docs";
const href = "/seamtranscode/server";
export const metadata = docsMetadata(seamtranscode, href);
export default function Page() {
  return (
    <DocsPage project={seamtranscode} href={href}>
      <Section id="worker" title="Run a worker">
        <P>
          <Code>GET /health</Code> is public; every other route requires a{" "}
          <Code>Bearer</Code> secret. Queue and history are in memory. Use the
          library behind a durable queue if jobs must survive restarts.
        </P>
        <CodeBlock label="Run a worker" language="typescript">
          {
            'import { createServer } from "seamtranscode/server";\nimport { local } from "seamtranscode";\nconst worker = createServer({ storage: local({ root: "./media" }), secret: process.env.SEAMTRANSCODE_SECRET! });\nawait worker.listen(8100);'
          }
        </CodeBlock>
      </Section>
      <Section id="jobs" title="Queue and control jobs">
        <P>
          <Code>POST /transcode</Code> or <Code>/previews</Code> returns{" "}
          <Code>202</Code> and a job id. <Code>GET /jobs/:id</Code> returns
          progress and results; <Code>DELETE /jobs/:id</Code> cancels a job.
          Input and output are storage keys. Metadata is echoed in every
          callback.
        </P>
        <CodeBlock label="Queue and control jobs" language="bash">
          {
            'curl -X POST http://localhost:8100/transcode -H "Authorization: Bearer $SEAMTRANSCODE_SECRET" -H "Content-Type: application/json" -d \'{"input":"uploads/film.mp4","output":"videos/film","metadata":{"videoId":"film"}}\''
          }
        </CodeBlock>
      </Section>
      <Section id="webhooks" title="Verify callbacks">
        <P>
          Webhooks carry HMAC signatures and timestamps. Pass the original bytes
          and <Code>seamtranscode-signature</Code> header to{" "}
          <Code>verifyWebhook</Code>. Progress, previews, renditions, completion
          and failure events share the same job id. Final events retry with
          backoff.
        </P>
        <CodeBlock label="Verify callbacks" language="typescript">
          {
            'import { verifyWebhook } from "seamtranscode/webhooks";\nconst event = await verifyWebhook(rawBody, signatureHeader, webhookSecret);'
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
