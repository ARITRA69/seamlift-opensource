"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon, Menu01Icon } from "@hugeicons/core-free-icons";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { SearchDialog } from "@/components/docs/search-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DocsProject } from "@/lib/docs";
import { cn } from "@/lib/utils";

export function SiteHeader({ project }: { project: DocsProject }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const others = project.links.slice(1);
  const activeLink =
    others.find((link) => pathname.startsWith(link.href))?.href ?? project.href;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-lg">
      <a
        href="#content"
        className="sr-only rounded-md bg-background px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-header max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open menu"
              className="lg:hidden"
            >
              <HugeiconsIcon icon={Menu01Icon} aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-svh overflow-y-auto">
            <DialogTitle>{project.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Pages in the {project.name} docs.
            </DialogDescription>
            <nav aria-label="Site" className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/" onClick={() => setMenuOpen(false)}>
                  All projects
                </Link>
              </Button>
              {others.map((link) => (
                <Button key={link.href} asChild variant="outline" size="sm">
                  <Link href={link.href} onClick={() => setMenuOpen(false)}>
                    {link.title}
                  </Link>
                </Button>
              ))}
            </nav>
            <DocsSidebar
              project={project}
              onNavigate={() => setMenuOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <Link
          href="/"
          className="flex shrink-0 items-baseline gap-1.5 rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="font-semibold tracking-tight">Seamlift</span>
          <span className="hidden text-muted-foreground sm:inline">
            Open Source
          </span>
        </Link>
        <span
          className="hidden text-muted-foreground lg:inline"
          aria-hidden="true"
        >
          /
        </span>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {project.links.map((link) => {
            const active = activeLink === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.title === "Docs" ? project.name : link.title}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <SearchDialog project={project} />
          <Button asChild variant="ghost" size="icon-sm">
            <a href={project.github} aria-label={`${project.name} on GitHub`}>
              <HugeiconsIcon icon={GithubIcon} aria-hidden="true" />
            </a>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
