import { DocsPage } from "@/components/docs/docs-page";
import { PlayerPlayground } from "@/components/player-playground";
import { docsMetadata, seamplayer } from "@/lib/docs";

const href = "/seamplayer/playground";
export const metadata = docsMetadata(seamplayer, href);

export default function PlaygroundPage() {
  return (
    <DocsPage project={seamplayer} href={href} toc={false}>
      <div id="playground">
        <PlayerPlayground />
      </div>
    </DocsPage>
  );
}
