"use client";

import type { ReactNode } from "react";
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option<Value extends string> = {
  value: Value;
  label: string;
  icon?: ReactNode;
};

export function OptionCombobox<Value extends string>({
  id,
  label,
  options,
  value,
  onValueChange,
  size = "sm",
  fullWidth = false,
  searchable = true,
}: {
  id?: string;
  label: string;
  options: readonly Option<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  size?: "xs" | "sm";
  fullWidth?: boolean;
  searchable?: boolean;
}) {
  // A picker without an input needs Select's listbox keyboard navigation.
  if (!searchable) {
    return (
      <Select
        value={value}
        onValueChange={(nextValue) => {
          const option = options.find((item) => item.value === nextValue);
          if (option) onValueChange(option.value);
        }}
      >
        <SelectTrigger
          id={id}
          aria-label={label}
          size={size}
          className={fullWidth ? "w-full" : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.icon}
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
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
        {options.find((option) => option.value === value)?.icon}
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
              {option.icon}
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
