import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { P, Section, DocLink, Code } from "@/components/docs/prose";
import { docsMetadata, seamtranscode } from "@/lib/docs";
const href = "/seamtranscode/storage";
export const metadata = docsMetadata(seamtranscode, href);
export default function Page() {
  return (
    <DocsPage project={seamtranscode} href={href}>
      <Section id="local" title="Local files">
        <P>
          Use a storage root and <Code>publicUrl</Code> so results carry URLs
          that a player can load. Serve the output folder with your application
          or a CDN.
        </P>
        <CodeBlock label="Local files" language="typescript">
          {
            'import { local, transcode } from "seamtranscode";\nawait transcode({ input: "film.mp4", output: "videos/film", storage: local({ root: "public", publicUrl: "/" }) });'
          }
        </CodeBlock>
      </Section>
      <Section id="object-storage" title="S3, R2 and compatible stores">
        <P>
          Install <Code>@aws-sdk/client-s3</Code>. Use a storage key as input,
          keep credentials on the server, and choose a unique output prefix for
          each job. Custom adapters implement <Code>get</Code>, <Code>put</Code>{" "}
          and optional <Code>url</Code>.
        </P>
        <CodeBlock label="S3, R2 and compatible stores" language="typescript">
          {
            'import { r2 } from "seamtranscode/s3";\nconst storage = r2({ accountId, accessKeyId, secretAccessKey, bucket, publicUrl: "https://cdn.example.com" });\nawait transcode({ storage, input: { key: "uploads/film.mp4" }, output: "videos/film" });'
          }
        </CodeBlock>
      </Section>
      <Section id="player" title="Hand off to seamplayer">
        <P>
          Store the plain JSON result in your database. Browser code imports{" "}
          <Code>seamtranscode/player</Code> to avoid Node dependencies. Supply{" "}
          <Code>baseUrl</Code> if the storage did not provide output URLs.
        </P>
        <CodeBlock label="Hand off to seamplayer" language="typescript">
          {
            'import { toSeamPlayer } from "seamtranscode/player";\nconst media = toSeamPlayer(result, { baseUrl: "https://cdn.example.com" });\n// React: <SeamPlayer {...media} />\n// Element: player.options = media;'
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
