"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { setPageTheme, usePageTheme } from "@/lib/use-page-theme";

export function ThemeToggle() {
  const theme = usePageTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Switch to ${next} theme`}
      onClick={() => setPageTheme(next)}
    >
      {theme === "dark" ? (
        <HugeiconsIcon icon={Sun03Icon} aria-hidden="true" />
      ) : (
        <HugeiconsIcon icon={Moon02Icon} aria-hidden="true" />
      )}
    </Button>
  );
}
