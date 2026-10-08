"use client";

import {
  createContext,
  Fragment,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Highlight, themes } from "prism-react-renderer";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type CodeTheme = "light" | "dark";
const CodeThemeContext = createContext<{
  theme: CodeTheme;
  setTheme: (theme: CodeTheme) => void;
} | null>(null);

export function CodeThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<CodeTheme>("light");
  return (
    <CodeThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </CodeThemeContext.Provider>
  );
}

function useCodeTheme() {
  const context = useContext(CodeThemeContext);
  if (!context) throw new Error("Code blocks require CodeThemeProvider.");
  return context;
}

export function CodeThemeSelect({ label }: { label: string }) {
  const { theme, setTheme } = useCodeTheme();
  return (
    <div className="w-44">
      <NativeSelect
        size="sm"
        aria-label={`${label} color theme`}
        value={theme}
        onChange={(event) =>
          setTheme(event.target.value === "dark" ? "dark" : "light")
        }
      >
        <NativeSelectOption value="light">Atom One Light</NativeSelectOption>
        <NativeSelectOption value="dark">Atom One Dark</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}

export function CodeBlock({
  children,
  label,
  language = "tsx",
  embedded = false,
}: {
  children: string;
  label: string;
  language?: "tsx" | "bash";
  embedded?: boolean;
}) {
  const { theme } = useCodeTheme();
  return (
    <div className={cn(!embedded && "overflow-hidden rounded-lg border")}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3">
          <span className="font-mono text-xs text-muted-foreground">
            {language === "bash" ? "Terminal" : "React · TSX"}
          </span>
          <CodeThemeSelect label={label} />
        </div>
      )}
      <Highlight
        code={children}
        language={language}
        theme={theme === "dark" ? themes.oneDark : themes.oneLight}
      >
        {({ style, tokens, getTokenProps }) => (
          <pre
            tabIndex={0}
            aria-label={label}
            data-code-theme={theme}
            className={cn(
              "code-surface overflow-auto p-5 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:text-sm",
              embedded && "max-h-80"
            )}
            style={
              {
                "--code-color": style.color,
                "--code-background": style.backgroundColor,
                "--code-text-shadow": style.textShadow,
              } as CSSProperties
            }
          >
            <code>
              {tokens.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 && "\n"}
                  {line.map((token, tokenIndex) => {
                    const { style: tokenStyle } = getTokenProps({ token });
                    return (
                      <span
                        key={tokenIndex}
                        className="code-token"
                        data-token={token.types.join(" ")}
                        style={
                          {
                            "--code-color": tokenStyle?.color,
                            "--code-font-style": tokenStyle?.fontStyle,
                            "--code-font-weight": tokenStyle?.fontWeight,
                            "--code-decoration": tokenStyle?.textDecorationLine,
                          } as CSSProperties
                        }
                      >
                        {token.empty ? "" : token.content}
                      </span>
                    );
                  })}
                </Fragment>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
}
