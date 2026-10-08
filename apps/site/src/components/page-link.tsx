"use client";

import type { ComponentProps } from "react";

export function PageLink({
  href,
  ...props
}: Omit<ComponentProps<"a">, "href" | "onClick"> & { href: string }) {
  const sectionId = href.startsWith("#") ? href.slice(1) : null;
  return (
    <a
      {...props}
      href={sectionId ? "/" : href}
      onClick={(event) => {
        if (
          !sectionId ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const section = document.getElementById(sectionId);
        if (!section) return;
        event.preventDefault();
        section.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        });
        section.focus({ preventScroll: true });
      }}
    />
  );
}
