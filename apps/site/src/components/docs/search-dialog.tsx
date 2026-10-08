"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowTurnBackwardIcon,
  File02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DocsProject } from "@/lib/docs";
import { cn } from "@/lib/utils";

export function SearchDialog({ project }: { project: DocsProject }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return project.sections.flatMap((section) =>
      section.pages
        .filter((page) => {
          const text =
            `${section.title} ${page.title} ${page.description}`.toLowerCase();
          return words.every((word) => text.includes(word));
        })
        .map((page) => ({ ...page, section: section.title }))
    );
  }, [project, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing =
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setSelected(0);
    }
  }

  function go(href: string) {
    changeOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full items-center gap-2 rounded-md bg-muted px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-56 lg:w-64"
      >
        <HugeiconsIcon
          icon={Search01Icon}
          className="size-4"
          aria-hidden="true"
        />
        <span className="hidden sm:inline">Search documentation…</span>
        <span className="sm:hidden">Search</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 font-mono text-xs sm:inline">
          ⌘K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent showCloseButton={false} variant="command">
          <DialogTitle className="sr-only">Search documentation</DialogTitle>
          <DialogDescription className="sr-only">
            Find a page in the {project.name} docs.
          </DialogDescription>
          <div className="flex items-center gap-2 border-b px-4">
            <HugeiconsIcon
              icon={Search01Icon}
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              autoFocus
              value={query}
              placeholder={`Search ${project.name} docs…`}
              aria-label="Search documentation"
              aria-controls="search-results"
              aria-activedescendant={
                results[selected] ? `search-${selected}` : undefined
              }
              role="combobox"
              aria-expanded="true"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setSelected(
                    (current) =>
                      (current + step + results.length) %
                      Math.max(results.length, 1)
                  );
                } else if (event.key === "Enter" && results[selected]) {
                  event.preventDefault();
                  go(results[selected].href);
                }
              }}
            />
          </div>
          <ul
            id="search-results"
            role="listbox"
            aria-label="Pages"
            className="max-h-96 overflow-y-auto p-2"
          >
            {results.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                No pages match “{query}”.
              </li>
            )}
            {results.map((page, index) => (
              <li
                key={page.href}
                id={`search-${index}`}
                role="option"
                aria-selected={index === selected}
                onMouseMove={() => setSelected(index)}
                onClick={() => go(page.href)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                  index === selected && "bg-accent text-accent-foreground"
                )}
              >
                <HugeiconsIcon
                  icon={File02Icon}
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{page.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {page.section} · {page.description}
                  </span>
                </span>
                {index === selected && (
                  <HugeiconsIcon
                    icon={ArrowTurnBackwardIcon}
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
