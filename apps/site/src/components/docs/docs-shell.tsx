import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { SiteHeader } from "@/components/docs/site-header";
import type { DocsProject } from "@/lib/docs";

export function DocsShell({
  project,
  children,
}: {
  project: DocsProject;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader project={project} />
      <div className="mx-auto flex max-w-7xl px-4 sm:px-6">
        <aside className="sticky top-header hidden h-docs-viewport w-56 shrink-0 overflow-y-auto border-r pt-12 pr-4 pb-8 lg:block">
          <DocsSidebar project={project} />
        </aside>
        <main
          id="content"
          tabIndex={-1}
          className="min-w-0 flex-1 outline-none"
        >
          {children}
        </main>
      </div>
    </>
  );
}
