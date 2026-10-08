"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  Copy01Icon,
  Link04Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Parts of a page that only make sense on screen: players, controls, navigation. */
const skipped =
  "button, nav, aside, .sp, [aria-hidden='true'], [data-copy-ignore]";

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement) || node.matches(skipped)) return "";
  const text = Array.from(node.childNodes).map(inline).join("");
  if (node.tagName === "CODE") return `\`${text}\``;
  if (node.tagName === "STRONG") return `**${text}**`;
  if (node.tagName === "A") {
    const href = (node as HTMLAnchorElement).href;
    return href ? `[${text}](${href})` : text;
  }
  return text;
}

function block(node: Element): string {
  if (!(node instanceof HTMLElement) || node.matches(skipped)) return "";
  const text = () => inline(node).replace(/\s+/g, " ").trim();
  switch (node.tagName) {
    case "H1":
      return `# ${text()}`;
    case "H2":
      return `## ${text()}`;
    case "H3":
      return `### ${text()}`;
    case "P":
      return text();
    case "PRE": {
      const code = node.textContent ?? "";
      const language = /^(npm|bun|pnpm|yarn) /.test(code) ? "bash" : "tsx";
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }
    case "UL":
    case "OL":
      return Array.from(node.children)
        .map((item, index) => {
          const marker = node.tagName === "OL" ? `${index + 1}.` : "-";
          return `${marker} ${inline(item).replace(/\s+/g, " ").trim()}`;
        })
        .join("\n");
    case "DL":
      return Array.from(node.querySelectorAll("dt"))
        .map((term) => {
          const description = term.nextElementSibling;
          return `- **${inline(term).trim()}**: ${description ? inline(description).replace(/\s+/g, " ").trim() : ""}`;
        })
        .join("\n");
    case "TABLE": {
      const rows = Array.from(node.querySelectorAll("tr")).map(
        (row) =>
          `| ${Array.from(row.children)
            .map((cell) => inline(cell).replace(/\s+/g, " ").trim())
            .join(" | ")} |`
      );
      if (rows.length === 0) return "";
      const columns = node.querySelector("tr")?.children.length ?? 1;
      rows.splice(1, 0, `|${" --- |".repeat(columns)}`);
      return rows.join("\n");
    }
    default:
      return Array.from(node.children).map(block).filter(Boolean).join("\n\n");
  }
}

function pageMarkdown() {
  const article = document.querySelector("[data-docs-article]");
  return article ? `${block(article).trim()}\n` : "";
}

export function CopyPage({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message, { id: "copy-page" });
      return true;
    } catch {
      toast.error("Could not copy", {
        id: "copy-page",
        description: "Your browser blocked clipboard access.",
      });
      return false;
    }
  }

  function prompt() {
    return encodeURIComponent(
      `Read ${window.location.href} and help me use it. It is the "${title}" page of the docs.`
    );
  }

  return (
    <ButtonGroup>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          if (await copy(pageMarkdown(), "Page copied as Markdown")) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
      >
        {copied ? (
          <HugeiconsIcon icon={Tick02Icon} aria-hidden="true" />
        ) : (
          <HugeiconsIcon icon={Copy01Icon} aria-hidden="true" />
        )}
        Copy page
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="More page actions"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => copy(window.location.href, "Link copied")}
          >
            <HugeiconsIcon icon={Link04Icon} aria-hidden="true" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a
              href="https://claude.ai/new"
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                event.currentTarget.href = `https://claude.ai/new?q=${prompt()}`;
              }}
            >
              <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" />
              Open in Claude
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href="https://chatgpt.com/"
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                event.currentTarget.href = `https://chatgpt.com/?q=${prompt()}`;
              }}
            >
              <HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" />
              Open in ChatGPT
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
