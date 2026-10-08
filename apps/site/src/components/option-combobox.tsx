"use client";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";

type Option<Value extends string> = { value: Value; label: string };

export function OptionCombobox<Value extends string>({
  id,
  label,
  options,
  value,
  onValueChange,
  size = "sm",
  fullWidth = false,
}: {
  id?: string;
  label: string;
  options: readonly Option<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  size?: "xs" | "sm";
  fullWidth?: boolean;
}) {
  return (
    <Combobox<Option<Value>>
      items={options}
      value={options.find((option) => option.value === value) ?? null}
      onValueChange={(option) => {
        if (option) onValueChange(option.value);
      }}
      autoHighlight
    >
      <ComboboxTrigger
        id={id}
        aria-label={label}
        render={
          <Button
            variant="outline"
            size={size}
            className={fullWidth ? "w-full justify-between" : undefined}
          />
        }
      >
        <span className="min-w-0 truncate">
          <ComboboxValue />
        </span>
      </ComboboxTrigger>
      <ComboboxContent align="end">
        <ComboboxInput
          aria-label={`${label} search`}
          placeholder="Search…"
          showTrigger={false}
        />
        <ComboboxEmpty>No matches.</ComboboxEmpty>
        <ComboboxList>
          {(option: Option<Value>) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
