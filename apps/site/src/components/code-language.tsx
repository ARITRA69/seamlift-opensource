"use client";

import Image from "next/image";
import { createContext, useContext, useState, type ReactNode } from "react";
import { OptionCombobox } from "@/components/option-combobox";
import type { ExampleLanguage } from "@/lib/playground";

const languages = [
  {
    value: "typescript",
    label: "TypeScript",
    icon: (
      <Image
        src="/logos/typescript.png"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0"
      />
    ),
  },
  {
    value: "javascript",
    label: "JavaScript",
    icon: (
      <Image
        src="/logos/javascript.png"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0"
      />
    ),
  },
] as const;

const CodeLanguageContext = createContext<{
  language: ExampleLanguage;
  setLanguage: (language: ExampleLanguage) => void;
} | null>(null);

export function CodeLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<ExampleLanguage>("typescript");
  return (
    <CodeLanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </CodeLanguageContext.Provider>
  );
}

export function useCodeLanguage() {
  const context = useContext(CodeLanguageContext);
  if (!context) throw new Error("Code examples require CodeLanguageProvider.");
  return context;
}

export function CodeLanguageSelect({ label }: { label: string }) {
  const { language, setLanguage } = useCodeLanguage();
  return (
    <OptionCombobox
      label={`${label} language`}
      options={languages}
      value={language}
      onValueChange={setLanguage}
      size="xs"
      searchable={false}
    />
  );
}
