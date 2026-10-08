import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { CopyPage } from "@/components/docs/copy-page";
import { TableOfContents } from "@/components/docs/table-of-contents";
import { Button } from "@/components/ui/button";
import { findDocsPage, type DocsProject } from "@/lib/docs";
import { cn } from "@/lib/utils";

export function DocsPage({
  project,
  href,
  toc = true,
  children,
}: {
  project: DocsProject;
  href: string;
  /** Turn off for full-width pages such as the playground. */
  toc?: boolean;
  children: ReactNode;
}) {
  const { page, previous, next } = findDocsPage(project, href);
  return (
    <div className="flex gap-12 lg:pl-10">
      <article
        data-docs-article
        className={cn(
          "min-w-0 flex-1 pt-8 pb-16 lg:pt-12",
          toc && "mx-auto max-w-3xl"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {page.title}
          </h1>
          <div className="flex items-center gap-2">
            <CopyPage title={page.title} />
            {previous && (
              <Button asChild variant="secondary" size="icon-sm">
                <Link
                  href={previous.href}
                  aria-label={`Previous: ${previous.title}`}
                >
                  <HugeiconsIcon icon={ArrowLeft02Icon} aria-hidden="true" />
                </Link>
              </Button>
            )}
            {next && (
              <Button asChild variant="secondary" size="icon-sm">
                <Link href={next.href} aria-label={`Next: ${next.title}`}>
                  <HugeiconsIcon icon={ArrowRight02Icon} aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-base leading-7 text-pretty text-muted-foreground">
          {page.description}
        </p>
        <div data-docs-content className="mt-10 space-y-12">
          {children}
        </div>
        <nav
          aria-label="Previous and next pages"
          className="mt-16 grid gap-3 border-t pt-8 sm:grid-cols-2"
        >
          {previous && (
            <PagerLink
              href={previous.href}
              label="Previous"
              title={previous.title}
            />
          )}
          {next && (
            <PagerLink href={next.href} label="Next" title={next.title} next />
          )}
        </nav>
      </article>
      {toc && (
        <aside className="sticky top-header hidden h-docs-viewport w-52 shrink-0 space-y-8 overflow-y-auto pt-12 pb-8 xl:block">
          <TableOfContents />
          <div className="space-y-2 rounded-lg bg-muted/70 p-4">
            <p className="text-sm font-semibold">Built by Seamlift</p>
            <p className="text-nav text-muted-foreground">
              {project.name} is made and used in production by Seamlift. Open
              source, MIT licensed.
            </p>
            <a
              href="https://seamlift.com"
              className="inline-flex items-center gap-1 pt-1 text-nav font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            >
              Visit Seamlift
            </a>
          </div>
        </aside>
      )}
    </div>
  );
}

function PagerLink({
  href,
  label,
  title,
  next = false,
}: {
  href: string;
  label: string;
  title: string;
  next?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-1 rounded-lg border p-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50",
        next && "items-end text-right sm:col-start-2"
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {!next && (
          <HugeiconsIcon
            icon={ArrowLeft02Icon}
            className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
        )}
        {title}
        {next && (
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </span>
    </Link>
  );
}
