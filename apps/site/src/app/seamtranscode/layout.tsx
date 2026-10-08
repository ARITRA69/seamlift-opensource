import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs/docs-shell";
import { seamtranscode } from "@/lib/docs";
export default function Layout({ children }: { children: ReactNode }) {
  return <DocsShell project={seamtranscode}>{children}</DocsShell>;
}
