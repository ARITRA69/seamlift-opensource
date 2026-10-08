"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocsProject } from "@/lib/docs";
import { cn } from "@/lib/utils";

export function DocsSidebar({
  project,
  onNavigate,
}: {
  project: DocsProject;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={`${project.name} docs`} className="space-y-6">
      {project.sections.map((section) => (
        <div key={section.title} className="space-y-1">
          <h2 className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">
            {section.title}
          </h2>
          <ul className="space-y-px">
            {section.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 text-nav font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/70 hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
