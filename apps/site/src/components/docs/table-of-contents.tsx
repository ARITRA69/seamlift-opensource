"use client";

import { useEffect, useState } from "react";
import { PageLink } from "@/components/page-link";
import { cn } from "@/lib/utils";

type Heading = { id: string; title: string; level: 2 | 3 };

export function TableOfContents() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-docs-content] h2[id], [data-docs-content] h3[id]"
      )
    );
    // The current section is the last heading above a line near the top.
    function update() {
      const line = window.innerHeight * 0.25;
      let current = elements[0]?.id ?? null;
      for (const element of elements)
        if (element.getBoundingClientRect().top <= line) current = element.id;
      setActive(current);
    }
    const initial = requestAnimationFrame(() => {
      setHeadings(
        elements.map((element) => ({
          id: element.id,
          title: element.textContent ?? "",
          level: element.tagName === "H3" ? 3 : 2,
        }))
      );
      update();
    });
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(initial);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (headings.length === 0) return null;
  return (
    <nav aria-label="On this page" className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground">
        On this page
      </h2>
      <ul className="space-y-2 text-nav">
        {headings.map((heading) => (
          <li key={heading.id} className={cn(heading.level === 3 && "pl-3")}>
            <PageLink
              href={`#${heading.id}`}
              aria-current={active === heading.id ? "location" : undefined}
              className={cn(
                "block rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                active === heading.id
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {heading.title}
            </PageLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
