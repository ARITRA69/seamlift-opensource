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

const href = "/seamplayer/styling";
export const metadata = docsMetadata(seamplayer, href);

const themeExample = `<SeamPlayer
  src="/film.mp4"
  theme={{
    accent: "#e0115f",
    accentText: "#ffffff",
    radius: "16px",
    font: "system-ui, sans-serif",
    monoFont: "ui-monospace, monospace",
  }}
/>`;

const cssExample = `.sp {
  --sp-accent: #2f6bff;
  --sp-highlight: #fff3b0;
  --sp-radius: 0;
  --sp-font-mono: "IBM Plex Mono", monospace;
}`;

const themeFields = [
  ["accent", "Play button, fills, and active choices. Default #e0115f."],
  ["accentText", "Text and icons on the accent. Default #ffffff."],
  ["background", "Player background. Default #15121a."],
  ["surface", "Control surfaces. Default #15121a."],
  ["text", "Text and icons. Default #ffffff."],
  ["highlight", "Highlighted moments. Default #ffd23f."],
  ["highlightText", "Text on highlights. Default #1a0b14."],
  ["radius", "Corner radius of the player. Default 16px."],
  ["font", "Interface font. Inherits the page font by default."],
  ["monoFont", "Times and sizes. A monospace stack by default."],
] as const;

const variables = [
  ["--sp-accent", "accent"],
  ["--sp-accent-text", "accentText"],
  ["--sp-bg", "background"],
  ["--sp-surface", "surface"],
  ["--sp-text", "text"],
  ["--sp-highlight", "highlight"],
  ["--sp-highlight-text", "highlightText"],
  ["--sp-radius", "radius"],
  ["--sp-font", "font"],
  ["--sp-font-mono", "monoFont"],
  ["--sp-ease", "The easing for most motion"],
] as const;

export default function StylingPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <Section id="theme" title="The theme prop">
        <P>
          <Code>theme</Code> sets colors, corners, and fonts. Translucent
          controls follow these colors automatically.
        </P>
        <CodeBlock label="Player theme example">{themeExample}</CodeBlock>
        <Definitions items={themeFields} />
      </Section>
      <Section id="css-variables" title="CSS variables">
        <P>
          Every color, the radius, and the easing are CSS variables on{" "}
          <Code>.sp</Code>, so you can also set them in your own stylesheet, for
          example per color scheme.
        </P>
        <CodeBlock label="CSS variables example">{cssExample}</CodeBlock>
        <Definitions
          items={variables.map(([name, value]) => [
            name,
            value.includes(" ") ? (
              value
            ) : (
              <>
                Same as <Code>{value}</Code>
              </>
            ),
          ])}
        />
      </Section>
      <Section id="layout" title="Layout">
        <P>
          The player fills its container’s width at 16:9. Use{" "}
          <Code>className</Code> or <Code>style</Code> to size and place it.
        </P>
        <P>
          Try the Pop and Sun accents, corner sizes, and fonts in the{" "}
          <DocLink href="/seamplayer/playground">playground</DocLink>.
        </P>
      </Section>
    </DocsPage>
  );
}
