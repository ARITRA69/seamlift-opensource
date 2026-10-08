"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export type FrameworkOption = {
  value: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

/** Large framework buttons; the chosen one's setup steps show below. */
export function FrameworkPicker({
  frameworks,
}: {
  frameworks: [FrameworkOption, ...FrameworkOption[]];
}) {
  const id = useId();
  const [selected, setSelected] = useState(frameworks[0].value);
  const current =
    frameworks.find((framework) => framework.value === selected) ??
    frameworks[0];

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Framework"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {frameworks.map((framework) => {
          const active = framework.value === current.value;
          return (
            <Button
              key={framework.value}
              type="button"
              role="tab"
              id={`${id}-${framework.value}-tab`}
              aria-selected={active}
              aria-controls={`${id}-panel`}
              variant={active ? "default" : "secondary"}
              size="tile"
              onClick={() => setSelected(framework.value)}
            >
              {framework.icon}
              {framework.label}
            </Button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${current.value}-tab`}
        className="space-y-4"
      >
        {current.content}
      </div>
    </div>
  );
}
