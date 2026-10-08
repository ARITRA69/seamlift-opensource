"use client";

import { Fragment, type CSSProperties } from "react";
import {
  CodeLanguageSelect,
  useCodeLanguage,
} from "@/components/code-language";
import { CopyCodeButton } from "@/components/copy-code-button";
import { Highlight, themes } from "prism-react-renderer";
import { usePageTheme } from "@/lib/use-page-theme";
import { cn } from "@/lib/utils";

export function CodeBlock({
  children,
  label,
  language = "tsx",
  embedded = false,
  javascriptCode,
}: {
  children: string;
  label: string;
  language?: "tsx" | "bash";
  embedded?: boolean;
  javascriptCode?: string;
}) {
  const theme = usePageTheme();
  const { language: exampleLanguage } = useCodeLanguage();
  const syntax =
    language === "bash"
      ? "bash"
      : exampleLanguage === "javascript"
        ? "jsx"
        : "tsx";
  const code = syntax === "jsx" ? (javascriptCode ?? children) : children;
  return (
    <div className={cn(!embedded && "overflow-hidden rounded-lg border")}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3">
          <span className="font-mono text-xs text-muted-foreground">
            {language === "bash" ? "Terminal" : "React"}
          </span>
          <div className="flex items-center gap-2">
            {language !== "bash" && <CodeLanguageSelect label={label} />}
            <CopyCodeButton code={code} label={label} compact />
          </div>
        </div>
      )}
      <Highlight
        code={code}
        language={syntax}
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
