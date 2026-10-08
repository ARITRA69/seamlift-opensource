import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  buildPlayerProps,
  defaultConfig,
  featureGroups,
  generateExample,
  validMediaUrl,
  type PlaygroundConfig,
} from "../src/lib/playground";

const site = fileURLToPath(new URL("../", import.meta.url));
const examples = new Map<string, string>();
for (const source of ["qualities", "single", "custom"] as const) {
  for (const controls of [false, true]) {
    for (const events of [false, true]) {
      const config: PlaygroundConfig = {
        ...defaultConfig,
        source,
        controls,
        events,
        customSrc: "https://media.example/film.m3u8",
        title: 'A "quoted" title\nwith a line break and </script>',
        autoPlay: true,
        loop: true,
        endAction: true,
        startTime: 13,
      };
      const props = buildPlayerProps(config);
      if (source === "custom") {
        assert.equal(props.src, config.customSrc);
        for (const key of [
          "duration",
          "poster",
          "thumbnails",
          "chapters",
          "captions",
        ]) {
          assert.equal(
            Object.hasOwn(props, key),
            false,
            `Custom source must not use demo ${key}`
          );
        }
      }
      for (const language of ["typescript", "javascript"] as const) {
        const name = resolve(
          site,
          "src",
          `__example-${source}-${controls}-${events}.${language === "typescript" ? "tsx" : "jsx"}`
        );
        examples.set(name, generateExample(props, config, language));
      }
    }
  }
}
const minimal = { ...defaultConfig };
for (const group of featureGroups)
  for (const item of group.items) minimal[item.key] = false;
const minimalProps = buildPlayerProps(minimal);
for (const key of [
  "poster",
  "thumbnails",
  "chapters",
  "captions",
  "download",
  "shareUrl",
  "resumeKey",
  "loop",
  "autoPlay",
  "endAction",
]) {
  assert.equal(
    Object.hasOwn(minimalProps, key),
    false,
    `Disabled option ${key} must be absent`
  );
}
for (const language of ["typescript", "javascript"] as const) {
  examples.set(
    resolve(
      site,
      "src",
      `__example-minimal.${language === "typescript" ? "tsx" : "jsx"}`
    ),
    generateExample(minimalProps, minimal, language)
  );
}
for (const value of [
  "",
  "   ",
  "javascript:alert(1)",
  "data:video/mp4,abc",
  "file:///film.mp4",
])
  assert.equal(validMediaUrl(value), false);
for (const value of [
  "/film.mp4",
  "./film.webm",
  "https://media.example/film.m3u8",
])
  assert.equal(validMediaUrl(value), true);

// Typecheck TypeScript and syntax-check JavaScript copyable components,
// including every combination of optional hooks. Virtual files resolve
// dependencies as if they lived in src.
const raw = ts.readConfigFile(resolve(site, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, site);
const options = {
  ...parsed.options,
  allowJs: true,
  checkJs: false,
  incremental: false,
};
const host = ts.createCompilerHost(options);
const getSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (name, version, onError, createNew) =>
  examples.has(name)
    ? ts.createSourceFile(
        name,
        examples.get(name)!,
        version,
        true,
        name.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TSX
      )
    : getSourceFile(name, version, onError, createNew);
const program = ts.createProgram([...examples.keys()], options, host);
const errors = ts
  .getPreEmitDiagnostics(program)
  .filter((d) => d.category === ts.DiagnosticCategory.Error);
if (errors.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => site,
      getNewLine: () => "\n",
    })
  );
  process.exit(1);
}
console.log(
  `Verified ${examples.size} generated React components, disabled tools, and custom media isolation.`
);
