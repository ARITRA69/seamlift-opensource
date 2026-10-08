"use client";

import { useEffect, useState } from "react";
import { BookOpen, Github, Package, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  { id: "basic-usage", label: "Basic usage" },
  { id: "playground", label: "Playground" },
  { id: "props", label: "Props" },
  { id: "styling", label: "Styling" },
  { id: "react-api", label: "React API" },
] as const;

export function PageNavigation() {
  const [active, setActive] = useState<string>("basic-usage");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const section = entries.find((entry) => entry.isIntersecting);
        if (section)
          setActive(
            section.target.id === "intro" ? "basic-usage" : section.target.id
          );
      },
      { rootMargin: "-15% 0px -65% 0px" }
    );
    for (const id of ["intro", ...sections.map((section) => section.id)]) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  const dock = [
    {
      label: "Docs",
      href: "#basic-usage",
      icon: BookOpen,
      selected: active !== "playground",
    },
    {
      label: "Playground",
      href: "#playground",
      icon: SlidersHorizontal,
      selected: active === "playground",
    },
    {
      label: "GitHub",
      href: "https://github.com/ARITRA69/seamplayer",
      icon: Github,
      selected: false,
    },
    {
      label: "npm",
      href: "https://www.npmjs.com/package/seamplayer",
      icon: Package,
      selected: false,
    },
  ];

  return (
    <>
      <nav
        aria-label="On this page"
        className="flex flex-wrap gap-x-6 gap-y-3 text-sm lg:sticky lg:top-12 lg:flex-col lg:items-start lg:gap-5"
      >
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active === section.id ? "location" : undefined}
            className={cn(
              "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active === section.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {section.label}
          </a>
        ))}
      </nav>
      <nav
        aria-label="Quick navigation"
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-3xl border border-border/60 bg-muted/95 p-2 shadow-sm backdrop-blur-lg"
      >
        {dock.map(({ label, href, icon: Icon, selected }) => (
          <a
            key={label}
            href={href}
            aria-current={selected ? "location" : undefined}
            className={cn(
              "flex min-w-16 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-w-20",
              selected
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>
    </>
  );
}
