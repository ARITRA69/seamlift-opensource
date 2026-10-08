import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { Code, DocLink, List, P, Section } from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";

const href = "/seamplayer/installation";
export const metadata = docsMetadata(seamplayer, href);

const basicExample = `import { SeamPlayer } from "seamplayer";

export default function Film() {
  return (
    <SeamPlayer
      src="/film.mp4"
      poster="/poster.jpg"
      title="Your film"
    />
  );
}`;

const nextExample = `// app/watch/page.tsx — a server component
import { SeamPlayer } from "seamplayer";

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  return (
    <SeamPlayer
      src="/film.m3u8"
      poster="/poster.jpg"
      title="Launch film"
      shareUrl="/watch"
      startTime={Number(t) || undefined}
    />
  );
}`;

export default function InstallationPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <Section id="install" title="Install the package">
        <CodeBlock label="Install Seamplayer" language="bash">
          npm install seamplayer
        </CodeBlock>
        <P>
          The React entry needs React 18 or 19. Astro, Svelte and plain
          JavaScript can use the framework-free entries. <Code>hls.js</Code>{" "}
          ships with the package and loads only when an HLS source starts
          playing.
        </P>
      </Section>
      <Section id="usage" title="Add a player">
        <CodeBlock label="Basic React example">{basicExample}</CodeBlock>
        <P>
          The player fills its container’s width at 16:9. Wrap it in an element
          with the width you want, or pass <Code>className</Code> or{" "}
          <Code>style</Code>.
        </P>
      </Section>
      <Section id="styles" title="Styles">
        <P>
          Default styles are included automatically, including during server
          rendering. There is no CSS file to import. To change colors, corners,
          and fonts, see <DocLink href="/seamplayer/styling">Styling</DocLink>.
        </P>
      </Section>
      <Section id="nextjs" title="Next.js and server rendering">
        <P>
          The build starts with <Code>&quot;use client&quot;</Code>, so you can
          render <Code>SeamPlayer</Code> straight from a server component. On
          the server it renders as its poster and play button; it reads storage
          only in the browser.
        </P>
        <CodeBlock label="Next.js server component example">
          {nextExample}
        </CodeBlock>
      </Section>
      <Section id="requirements" title="Requirements">
        <List>
          <li>
            React 18 or 19 for the React adapter; other web frameworks use the
            custom element or core API. Both ESM and CommonJS are supported.
          </li>
          <li>
            A source the browser can play: MP4, WebM, or an HLS playlist (
            <Code>.m3u8</Code>).
          </li>
          <li>
            Captions and downloads from another origin need CORS or a{" "}
            <Code>Content-Disposition: attachment</Code> header.
          </li>
        </List>
      </Section>
    </DocsPage>
  );
}
