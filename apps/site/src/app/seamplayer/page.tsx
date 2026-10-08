import { DocsPage } from "@/components/docs/docs-page";
import { Cards, Code, List, P, Section } from "@/components/docs/prose";
import { HeroDemo } from "@/components/hero-demo";
import { docsMetadata, seamplayer } from "@/lib/docs";

const href = "/seamplayer";
export const metadata = docsMetadata(seamplayer, href);

export default function IntroductionPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <div className="space-y-4">
        <HeroDemo />
        <P>
          <strong>
            Until someone presses play, it’s a picture and a button.
          </strong>{" "}
          The video, and hls.js for HLS streams, load on the first play. Then it
          behaves like the players people already know, down to the keyboard
          shortcuts.
        </P>
      </div>
      <Section id="features" title="Features">
        <List>
          <li>
            <strong>Poster first.</strong> Pages stay light until a viewer
            chooses to watch.
          </li>
          <li>
            <strong>A filmstrip seek bar.</strong> Give it a sprite sheet and
            the bar opens into the video’s real frames as the pointer comes
            near.
          </li>
          <li>
            <strong>Chapters, quality, captions, speed, and loop</strong> in one
            settings menu, where every row shows its current value.
          </li>
          <li>
            <strong>Downloads</strong> in one or several sizes, and{" "}
            <strong>Copy link at 0:12</strong>.
          </li>
          <li>
            <strong>Keyboard and touch.</strong> YouTube’s keys, double-tap to
            skip, and hold for 2× on phones.
          </li>
          <li>
            <strong>It remembers</strong> volume, speed, captions, and where
            each viewer stopped.
          </li>
        </List>
      </Section>
      <Section id="quick-start" title="Quick start">
        <P>
          Install <Code>seamplayer</Code>, import <Code>SeamPlayer</Code>, and
          give it a source. Default styles are included automatically. It works
          with React 18 and 19, MP4, WebM, and HLS.
        </P>
      </Section>
      <Section id="next-steps" title="Next steps">
        <Cards
          items={seamplayer.sections
            .flatMap((section) => section.pages)
            .filter((page) =>
              [
                "/seamplayer/installation",
                "/seamplayer/playground",
                "/seamplayer/media-tools",
                "/seamplayer/props",
              ].includes(page.href)
            )}
        />
      </Section>
    </DocsPage>
  );
}
