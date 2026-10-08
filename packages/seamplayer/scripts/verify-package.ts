import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";

const repo = fileURLToPath(new URL("..", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "seamplayer-package-"));
async function run(cmd: string[], cwd: string) {
  const process = Bun.spawn(cmd, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...globalThis.process.env, ASTRO_TELEMETRY_DISABLED: "1" },
  });
  const status = await process.exited;
  if (status !== 0) throw new Error(`${cmd.join(" ")} exited with ${status}`);
}
try {
  const tarball = join(temporary, "seamplayer.tgz");
  await run(["bun", "pm", "pack", "--filename", tarball], repo);
  const listing = Bun.spawn(["tar", "-tzf", tarball], { stdout: "pipe" });
  const files = (await new Response(listing.stdout).text()).trim().split("\n");
  assert.equal(await listing.exited, 0);
  assert(
    files.every((file) =>
      /^package\/(dist\/|package.json$|README.md$|LICENSE$)/.test(file)
    ),
    "Unexpected file in the npm tarball"
  );
  for (const file of [
    "index.js",
    "index.cjs",
    "index.d.ts",
    "index.d.cts",
    "styles.css",
    ...["react", "core", "element"].flatMap((entry) =>
      [".js", ".cjs", ".d.ts", ".d.cts"].map((ext) => entry + ext)
    ),
  ]) {
    assert(files.includes(`package/dist/${file}`), `Missing ${file}`);
  }
  for (const major of [18, 19]) {
    const consumer = join(temporary, `react-${major}`);
    await mkdir(consumer);
    await writeFile(
      join(consumer, "bunfig.toml"),
      await readFile(join(repo, "bunfig.toml"))
    );
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: {
          seamplayer: `file:${tarball}`,
          react: `^${major}.0.0`,
          "react-dom": `^${major}.0.0`,
        },
        devDependencies: {
          "@types/react": `^${major}.0.0`,
          "@types/react-dom": `^${major}.0.0`,
          typescript: "5.9.2",
        },
      })
    );
    await run(["bun", "install"], consumer);
    for (const [source, destination] of [
      ["runtime.mjs", "verify.mjs"],
      ["consumer.ts", "consumer.mts"],
      ["consumer.ts", "consumer.cts"],
    ]) {
      await writeFile(
        join(consumer, destination!),
        await readFile(join(repo, "tests/fixtures", source!))
      );
    }
    await run(["node", "verify.mjs"], consumer);
    await run(
      [
        "bun",
        "x",
        "--no-install",
        "tsc",
        "--noEmit",
        "--strict",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2022",
        "consumer.mts",
        "consumer.cts",
      ],
      consumer
    );
  }
  // Real framework consumers, with no React dependency.
  const frameworks = join(temporary, "frameworks");
  await mkdir(join(frameworks, "src/pages"), { recursive: true });
  await writeFile(
    join(frameworks, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { seamplayer: `file:${tarball}` },
      devDependencies: {
        typescript: "5.9.2",
        "happy-dom": "^20.0.0",
        svelte: "5.57.1",
        astro: "7.3.5",
        "@types/node": "^22.0.0",
      },
    })
  );
  await writeFile(
    join(frameworks, "bunfig.toml"),
    await readFile(join(repo, "bunfig.toml"))
  );
  await run(["bun", "install"], frameworks);
  for (const name of [
    "framework-server.mjs",
    "framework-dom.mjs",
    "framework-build.mjs",
    "framework-consumer.ts",
  ]) {
    await writeFile(
      join(frameworks, name),
      await readFile(join(repo, "tests/fixtures", name))
    );
  }
  await writeFile(
    join(frameworks, "framework-consumer.cts"),
    await readFile(join(repo, "tests/fixtures/framework-consumer.ts"))
  );
  await writeFile(
    join(frameworks, "src/pages/index.astro"),
    await readFile(join(repo, "../../examples/astro/Player.astro"))
  );
  await writeFile(
    join(frameworks, "Player.svelte"),
    await readFile(join(repo, "../../examples/svelte/Player.svelte"))
  );
  await run(["node", "framework-server.mjs"], frameworks);
  await run(["node", "framework-dom.mjs"], frameworks);
  await run(
    [
      "bun",
      "x",
      "--no-install",
      "tsc",
      "--noEmit",
      "--strict",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--target",
      "ES2022",
      "--types",
      "node",
      "framework-consumer.ts",
      "framework-consumer.cts",
    ],
    frameworks
  );
  await run(["bun", "x", "--no-install", "astro", "build"], frameworks);
  await run(["node", "framework-build.mjs"], frameworks);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
