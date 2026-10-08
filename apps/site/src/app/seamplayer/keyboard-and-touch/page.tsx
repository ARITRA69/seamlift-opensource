import type { ReactNode } from "react";
import { DocsPage } from "@/components/docs/docs-page";
import { Code, Definitions, P, Section } from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";

const href = "/seamplayer/keyboard-and-touch";
export const metadata = docsMetadata(seamplayer, href);

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {keys.map((key) => (
        <kbd
          key={key}
          className="rounded border bg-muted px-1.5 font-mono text-xs leading-5"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

const keyboard: [string[], ReactNode][] = [
  [["Space", "K"], "Play or pause"],
  [["←", "→"], "Back or forward 5 seconds"],
  [["J", "L"], "Back or forward 10 seconds"],
  [["↑", "↓"], "Volume up or down 5%"],
  [["M"], "Mute or unmute"],
  [["F"], "Fullscreen"],
  [["C"], "Captions on or off"],
  [["0", "–", "9"], "Jump to 0% through 90% of the video"],
  [["<", ">"], "Slower or faster"],
  [[",", "."], "Back or forward one frame, while paused"],
  [["?"], "Show every shortcut"],
  [["Esc"], "Close the open menu"],
];

const pointer: [string, ReactNode][] = [
  ["Click", "Play or pause"],
  ["Double-click", "Fullscreen"],
  ["Tap", "Show the controls"],
  [
    "Double-tap a side",
    "Skip 10 seconds back or forward. Keep tapping to add more.",
  ],
  ["Touch and hold", "Play at 2× until you let go"],
];

export default function KeyboardAndTouchPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      <div className="space-y-4">
        <P>
          Every player gets these controls. They match YouTube’s, so most
          viewers already know them.
        </P>
      </div>
      <Section id="keyboard" title="Keyboard">
        <P>
          Shortcuts work while the player has focus. A focused button keeps its
          own Space and Enter.
        </P>
        <Definitions
          items={keyboard.map(([keys, action]) => [
            <Keys key={keys.join()} keys={keys} />,
            action,
          ])}
        />
        <P>
          Frame stepping uses the <Code>fps</Code> prop, 30 by default.
        </P>
      </Section>
      <Section id="mouse-and-touch" title="Mouse and touch">
        <Definitions items={pointer} />
      </Section>
    </DocsPage>
  );
}
