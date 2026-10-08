import { CodeBlock } from "@/components/code-block";
import { DocsPage } from "@/components/docs/docs-page";
import { P, Section, DocLink, Code } from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";
const href = "/seamplayer/frameworks";
export const metadata = docsMetadata(seamplayer, href);
export default function Page() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <Section id="element" title="One player across frameworks">
        <P>
          Import <Code>seamplayer/element</Code> to register{" "}
          <Code>&lt;seam-player&gt;</Code>. Simple options are attributes;
          arrays, objects and handlers are properties. React is optional for
          this entry. CSS injects automatically after registration.
        </P>
        <CodeBlock label="One player across frameworks" language="typescript">
          {
            'import "seamplayer/element";\nconst player = document.querySelector("seam-player")!;\nplayer.options = { src: "/film.mp4", title: "Film", chapters: [{ start: 0, title: "Intro" }] };\nplayer.play();'
          }
        </CodeBlock>
      </Section>
      <Section id="astro" title="Astro">
        <P>
          {
            "No React integration or client hydration directive is required. Import the element in a browser script. For a poster before JavaScript loads, render the core poster HTML and import the stylesheet on the server."
          }
        </P>
        <CodeBlock label="Astro" language="markup">
          {
            '---\nimport { renderPoster } from "seamplayer/core";\nimport "seamplayer/styles.css";\nconst options = { src: "/film.mp4", poster: "/poster.jpg", title: "Film" };\n---\n<seam-player class="sp" src={options.src} poster={options.poster} title={options.title}>\n  <Fragment set:html={renderPoster(options)} />\n</seam-player>\n<script>\n  import "seamplayer/element";\n</script>\n'
          }
        </CodeBlock>
      </Section>
      <Section id="svelte" title="Svelte and Vue">
        <P>
          The Svelte 5 example registers only in the browser and assigns{" "}
          <Code>chapters</Code> as a property. Vue can use the same element;
          configure <Code>isCustomElement</Code> for <Code>seam-player</Code> in
          the Vue compiler.
        </P>
        <CodeBlock label="Svelte and Vue" language="markup">
          {
            '<script lang="ts">\n  import { onMount } from "svelte";\n  import type { SeamPlayerElement } from "seamplayer/element";\n  import type { SeamChapter } from "seamplayer/core";\n  import "seamplayer/styles.css";\n\n  let { src, poster, title = "Film", chapters = [] }: {\n    src: string; poster?: string; title?: string; chapters?: SeamChapter[];\n  } = $props();\n  let player = $state<SeamPlayerElement>();\n  onMount(() => { void import("seamplayer/element"); });\n  $effect(() => { if (player) player.chapters = chapters; });\n</script>\n\n<seam-player class="sp" bind:this={player} {src} {poster} {title} />\n'
          }
        </CodeBlock>
      </Section>
      <Section id="vanilla" title="Plain JavaScript">
        <P>
          The core entry exposes <Code>createSeamPlayer</Code>,{" "}
          <Code>renderPoster</Code> and the shared option types. Call{" "}
          <Code>destroy</Code> when removing the host to release media, timers
          and listeners.
        </P>
        <CodeBlock label="Plain JavaScript" language="typescript">
          {
            'import { createSeamPlayer } from "seamplayer/core";\nconst player = createSeamPlayer(document.querySelector<HTMLElement>("#player")!, { src: "/film.mp4" });\nplayer.update({ src: "/next.mp4" });\nplayer.destroy();'
          }
        </CodeBlock>
      </Section>
      <Section id="expo" title="Expo and React Native">
        <P>
          Copy this file into your app so Expo processes the{" "}
          <Code>use dom</Code> directive. It runs the web player in a webview on
          native. Props must be serializable; native actions must be top-level
          async functions. Expo SDK 55 and earlier require{" "}
          <Code>react-native-webview</Code>; SDK 56+ includes the default DOM
          webview. Fullscreen, picture-in-picture, clipboard and downloads
          depend on the platform. Native lock-screen media controls are not
          implemented.
        </P>
        <CodeBlock label="Expo and React Native" language="tsx">
          {
            '"use dom";\n\nimport type { DOMProps } from "expo/dom";\nimport { SeamPlayer } from "seamplayer/react";\n\n// Keep props serializable. Native actions must be top-level async functions.\nexport default function SeamPlayerDOM({ src, poster, title, onTimeUpdate }: {\n  src: string;\n  poster?: string;\n  title?: string;\n  dom?: DOMProps;\n  onTimeUpdate?: (time: number) => Promise<void>;\n}) {\n  return <SeamPlayer src={src} poster={poster} title={title}\n    onTimeUpdate={(time) => { void onTimeUpdate?.(time); }} />;\n}\n'
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
