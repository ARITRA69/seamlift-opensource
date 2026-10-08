import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs/docs-shell";
import { seamplayer } from "@/lib/docs";

export default function SeamplayerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DocsShell project={seamplayer}>{children}</DocsShell>;
}
