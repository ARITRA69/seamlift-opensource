"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyCodeButton({
  code,
  label,
  compact = false,
}: {
  code: string;
  label: string;
  compact?: boolean;
}) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copied = copiedCode === code;
  return (
    <Button
      variant="outline"
      size={compact ? "icon-xs" : "sm"}
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopiedCode(code);
          toast.success("Code copied", { id: `copy-${label}` });
        } catch {
          toast.error("Could not copy code", {
            id: `copy-${label}`,
            description: "Select the code and copy it manually.",
          });
        }
      }}
    >
      {copied ? (
        <HugeiconsIcon icon={Tick02Icon} aria-hidden="true" />
      ) : (
        <HugeiconsIcon icon={Copy01Icon} aria-hidden="true" />
      )}
      {!compact && (copied ? "Copied" : "Copy code")}
    </Button>
  );
}
