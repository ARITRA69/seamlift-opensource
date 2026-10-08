import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import {
  AstroLogo,
  ExpoLogo,
  JavaScriptLogo,
  NextLogo,
  ReactLogo,
  SvelteLogo,
  VueLogo,
} from "@/components/framework-logos";
import {
  FrameworkPicker,
  type FrameworkOption,
} from "@/components/framework-picker";
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

const astroExample = `---
import { renderPoster } from "seamplayer/core";
import "seamplayer/styles.css";
const options = { src: "/film.mp4", poster: "/poster.jpg", title: "Film" };
---
<seam-player class="sp" src={options.src} poster={options.poster} title={options.title}>
  <Fragment set:html={renderPoster(options)} />
</seam-player>
<script>
  import "seamplayer/element";
</script>`;

const svelteExample = `<script lang="ts">
  import { onMount } from "svelte";
  import "seamplayer/styles.css";

  let { src, poster, title = "Film" }: {
    src: string; poster?: string; title?: string;
  } = $props();
  onMount(() => { void import("seamplayer/element"); });
</script>

<seam-player class="sp" {src} {poster} {title} />`;

const vueExample = `<script setup lang="ts">
import { onMounted } from "vue";
import "seamplayer/styles.css";

onMounted(() => { void import("seamplayer/element"); });
</script>

<template>
  <seam-player class="sp" src="/film.mp4" poster="/poster.jpg" title="Film" />
</template>`;

const vueConfigExample = `// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag === "seam-player" },
      },
    }),
  ],
});`;

const vanillaExample = `import { createSeamPlayer } from "seamplayer/core";

const player = createSeamPlayer(document.querySelector<HTMLElement>("#player")!, {
  src: "/film.mp4",
  poster: "/poster.jpg",
  title: "Film",
});

// Later, when removing the host:
player.destroy();`;

const expoExample = `"use dom";

import type { DOMProps } from "expo/dom";
import { SeamPlayer } from "seamplayer/react";

export default function SeamPlayerDOM({ src, poster, title }: {
  src: string;
  poster?: string;
  title?: string;
  dom?: DOMProps;
}) {
  return <SeamPlayer src={src} poster={poster} title={title} />;
}`;

const frameworks: [FrameworkOption, ...FrameworkOption[]] = [
  {
    value: "react",
    label: "React",
    icon: <ReactLogo />,
    content: (
      <>
        <CodeBlock label="Basic React example">{basicExample}</CodeBlock>
        <P>
          The player fills its container’s width at 16:9. Wrap it in an element
          with the width you want, or pass <Code>className</Code> or{" "}
          <Code>style</Code>. See the{" "}
          <DocLink href="/seamplayer/react-api">React API</DocLink> for every
          prop and ref method.
        </P>
      </>
    ),
  },
  {
    value: "nextjs",
    label: "Next.js",
    icon: <NextLogo />,
    content: (
      <>
        <P>
          The build starts with <Code>&quot;use client&quot;</Code>, so you can
          render <Code>SeamPlayer</Code> straight from a server component. On
          the server it renders as its poster and play button; it reads storage
          only in the browser.
        </P>
        <CodeBlock label="Next.js server component example">
          {nextExample}
        </CodeBlock>
      </>
    ),
  },
  {
    value: "astro",
    label: "Astro",
    icon: <AstroLogo />,
    content: (
      <>
        <P>
          No React integration or client directive is needed. Import the element
          in a browser script, and render the core poster on the server so
          something shows before JavaScript loads.
        </P>
        <CodeBlock label="Astro example" language="markup" title="Astro">
          {astroExample}
        </CodeBlock>
      </>
    ),
  },
  {
    value: "svelte",
    label: "Svelte",
    icon: <SvelteLogo />,
    content: (
      <>
        <P>
          Register <Code>&lt;seam-player&gt;</Code> only in the browser. Arrays
          and objects such as <Code>chapters</Code> are set as properties; see{" "}
          <DocLink href="/seamplayer/frameworks#svelte">Frameworks</DocLink>.
        </P>
        <CodeBlock label="Svelte example" language="markup" title="Svelte">
          {svelteExample}
        </CodeBlock>
      </>
    ),
  },
  {
    value: "vue",
    label: "Vue",
    icon: <VueLogo />,
    content: (
      <>
        <P>
          Vue uses the same custom element. Register it in the browser and tell
          the Vue compiler that <Code>seam-player</Code> is a custom element.
        </P>
        <CodeBlock label="Vue example" language="markup" title="Vue">
          {vueExample}
        </CodeBlock>
        <CodeBlock label="Vue compiler config" language="typescript">
          {vueConfigExample}
        </CodeBlock>
      </>
    ),
  },
  {
    value: "javascript",
    label: "JavaScript",
    icon: <JavaScriptLogo />,
    content: (
      <>
        <P>
          The core entry needs no framework. Call <Code>destroy</Code> when
          removing the host to release media, timers and listeners. You can also
          use the <Code>&lt;seam-player&gt;</Code> element from{" "}
          <Code>seamplayer/element</Code>.
        </P>
        <CodeBlock label="Plain JavaScript example" language="typescript">
          {vanillaExample}
        </CodeBlock>
      </>
    ),
  },
  {
    value: "expo",
    label: "Expo",
    icon: <ExpoLogo />,
    content: (
      <>
        <P>
          Copy this file into your app so Expo processes the{" "}
          <Code>use dom</Code> directive; it runs the web player in a webview on
          native. Props must be serializable. Expo SDK 55 and earlier also need{" "}
          <Code>react-native-webview</Code>.
        </P>
        <CodeBlock label="Expo example">{expoExample}</CodeBlock>
      </>
    ),
  },
];

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
      <Section id="usage" title="Choose your framework">
        <P>
          Pick the framework you use to see how to add a player. For more
          detail, see{" "}
          <DocLink href="/seamplayer/frameworks">Frameworks</DocLink>.
        </P>
        <FrameworkPicker frameworks={frameworks} />
      </Section>
      <Section id="styles" title="Styles">
        <P>
          Default styles are included automatically, including during server
          rendering. There is no CSS file to import. To change colors, corners,
          and fonts, see <DocLink href="/seamplayer/styling">Styling</DocLink>.
        </P>
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
