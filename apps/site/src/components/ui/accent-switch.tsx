"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

type Accent = "pop" | "sun";
const options: { value: Accent; label: string }[] = [
  { value: "pop", label: "Pop accent" },
  { value: "sun", label: "Sun accent" },
];

export function AccentSwitch({
  value,
  onChange,
}: {
  value: Accent;
  onChange: (accent: Accent) => void;
}) {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const buttons = useRef(new Map<Accent, HTMLButtonElement>());
  return (
    <LayoutGroup id={id}>
      <div
        role="radiogroup"
        aria-label="Accent"
        className="inline-flex rounded-full bg-card p-1 shadow-sm"
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            tabIndex={value === option.value ? 0 : -1}
            ref={(node) => {
              if (node) buttons.current.set(option.value, node);
              else buttons.current.delete(option.value);
            }}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? (index + 1) % options.length
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? (index - 1 + options.length) % options.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? options.length - 1
                        : null;
              if (next === null) return;
              const selected = options[next];
              if (!selected) return;
              event.preventDefault();
              onChange(selected.value);
              buttons.current.get(selected.value)?.focus();
            }}
            className={cn(
              "relative rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring",
              value === option.value
                ? "text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {value === option.value && (
              <motion.span
                layoutId="accent-thumb"
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-foreground"
                transition={{
                  duration: reducedMotion ? 0 : 0.5,
                  ease: [0.625, 0.05, 0, 1],
                }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
