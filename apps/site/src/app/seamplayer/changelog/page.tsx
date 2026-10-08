import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { DocsPage } from "@/components/docs/docs-page";
import { Code, List, Section } from "@/components/docs/prose";
import { docsMetadata, seamplayer } from "@/lib/docs";

const href = "/seamplayer/changelog";
export const metadata = docsMetadata(seamplayer, href);

function inline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`)/)
    .map((part, index) =>
      part.startsWith("`") ? <Code key={index}>{part.slice(1, -1)}</Code> : part
    );
}

async function releases() {
  const file = await readFile(
    path.join(process.cwd(), "..", "..", "CHANGELOG.md"),
    "utf8"
  );
  return file
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [version = "", ...lines] = section.trim().split("\n");
      return {
        version: version.trim(),
        changes: lines
          .filter((line) => line.startsWith("- "))
          .map((line) => line.slice(2)),
      };
    });
}

export default async function ChangelogPage() {
  return (
    <DocsPage project={seamplayer} href={href}>
      {(await releases()).map((release) => (
        <Section
          key={release.version}
          id={release.version.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
          title={release.version}
        >
          <List>
            {release.changes.map((change) => (
              <li key={change}>{inline(change)}</li>
            ))}
          </List>
        </Section>
      ))}
    </DocsPage>
  );
}
