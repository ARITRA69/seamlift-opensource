"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import type { CSSProperties } from "react";
import { usePageTheme } from "@/lib/use-page-theme";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = usePageTheme();

  return (
    <Sonner
      theme={theme}
      className="group"
      icons={{
        success: (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
        ),
        info: <HugeiconsIcon icon={InformationCircleIcon} className="size-4" />,
        warning: <HugeiconsIcon icon={Alert02Icon} className="size-4" />,
        error: <HugeiconsIcon icon={CancelCircleIcon} className="size-4" />,
        loading: (
          <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
