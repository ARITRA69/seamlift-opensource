import { readFile } from "node:fs/promises";
import path from "node:path";
import { projects, siteUrl } from "@/lib/docs";

const root = path.join(process.cwd(), "..", "..");

export function text(body: string) {
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** The llms.txt index: https://llmstxt.org */
export function llmsIndex() {
  const lines = [
    "# Seamlift Open Source",
    "",
    "> The parts of Seamlift built in the open. MIT licensed, and used in production by Seamlift.",
    "",
    `The complete documentation as a single file is at ${siteUrl}/llms-full.txt.`,
  ];
  for (const project of projects) {
    lines.push(
      "",
      `## ${project.name}`,
      "",
      `${project.summary}. ${project.description}`,
      "",
      `- [npm](${project.npm}): \`npm install ${project.name}\``,
      `- [Source](${project.github})`
    );
    for (const section of project.sections) {
      lines.push("", `### ${section.title}`, "");
      for (const page of section.pages) {
        lines.push(
          `- [${page.title}](${siteUrl}${page.href}): ${page.description}`
        );
      }
    }
  }
  return lines.join("\n") + "\n";
}

/** The package README up to its contributor sections, followed by the changelog. */
export async function llmsFull() {
  const sections = await Promise.all(
    projects.map(async (project) => {
      const readme = await readFile(
        path.join(root, "packages", project.name, "README.md"),
        "utf8"
      );
      return (
        readme.split(/^## Development$/m)[0]!.trim() +
        `\n\nDocs: ${siteUrl}${project.href}`
      );
    })
  );
  const changelog = await readFile(path.join(root, "CHANGELOG.md"), "utf8");
  return (
    [
      ...sections,
      changelog.replace(/^# Changelog/m, "## Changelog").trim(),
    ].join("\n\n") + "\n"
  );
}
