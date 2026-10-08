import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";

const repo = fileURLToPath(new URL("..", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "seamtranscode-package-"));
async function run(cmd: string[], cwd: string) {
  const process = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  const status = await process.exited;
  if (status !== 0) throw new Error(`${cmd.join(" ")} exited with ${status}`);
}
try {
  const tarball = join(temporary, "seamtranscode.tgz");
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
  for (const entry of ["index", "s3", "server", "webhooks", "player"]) {
    for (const ext of [".js", ".cjs", ".d.ts", ".d.cts"]) {
      assert(
        files.includes(`package/dist/${entry}${ext}`),
        `Missing ${entry}${ext}`
      );
    }
  }
  assert(files.includes("package/dist/cli.js"), "Missing cli.js");

  const consumer = join(temporary, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "bunfig.toml"),
    await readFile(join(repo, "bunfig.toml"))
  );
  const manifest = (dependencies: Record<string, string>) =>
    writeFile(
      join(consumer, "package.json"),
      JSON.stringify({ private: true, type: "module", dependencies })
    );

  // Without the optional peers: everything but s3 works, and so does the CLI.
  await manifest({ seamtranscode: `file:${tarball}` });
  await run(["bun", "install"], consumer);
  await writeFile(
    join(consumer, "verify.mjs"),
    await readFile(join(repo, "tests/fixtures/runtime.mjs"))
  );
  await run(["node", "verify.mjs"], consumer);
  await run(["node", "node_modules/.bin/seamtranscode", "--help"], consumer);
  await run(
    [
      "ffmpeg",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x180:rate=25:duration=3",
      "-pix_fmt",
      "yuv420p",
      "clip.mp4",
    ],
    consumer
  );
  await run(
    [
      "node",
      "node_modules/.bin/seamtranscode",
      "clip.mp4",
      "-r",
      "180",
      "--json",
    ],
    consumer
  );
  const result = JSON.parse(
    await readFile(join(consumer, "clip/seamtranscode.json"), "utf8")
  ) as { playlist: { key: string } };
  assert.equal(result.playlist.key, "master.m3u8");
  await writeFile(
    join(consumer, "preview.mjs"),
    await readFile(join(repo, "tests/fixtures/preview.mjs"))
  );
  await run(["node", "preview.mjs"], consumer);

  // With them: the types of every entry, from ESM and CommonJS.
  await manifest({
    seamtranscode: `file:${tarball}`,
    "@aws-sdk/client-s3": "^3.0.0",
    "@types/node": "^22.0.0",
    typescript: "5.9.2",
  });
  await run(["bun", "install"], consumer);
  for (const destination of ["consumer.mts", "consumer.cts"]) {
    await writeFile(
      join(consumer, destination),
      await readFile(join(repo, "tests/fixtures/consumer.ts"))
    );
  }
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
      "consumer.mts",
      "consumer.cts",
    ],
    consumer
  );
  console.log("package ok");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
