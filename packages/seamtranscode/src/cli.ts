import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { parseArgs } from "node:util";
import { deliver, makeEvent } from "./deliver";
import { resolveEncoder, type EncoderChoice } from "./encoders";
import { storageFromEnv } from "./env";
import { SeamtranscodeError } from "./errors";
import { resolveTools } from "./ffmpeg";
import { toSeamPlayer } from "./player";
import { previews, type PreviewSizes } from "./previews";
import { probe } from "./probe";
import { createServer } from "./server/index";
import { local } from "./storage/local";
import {
  encodeRendition,
  finishTranscode,
  planTranscode,
  transcode,
  type RenditionResult,
  type TranscodePlan,
  type TranscodeResult,
} from "./transcode";
import type { WebhookEventType } from "./webhooks";
import type { Input } from "./work";

const HELP = `seamtranscode: video in, adaptive HLS + poster + scrub sheet out

Usage
  seamtranscode <video> [options]       transcode a video on this machine
  seamtranscode preview <folder>        play a transcoded folder in the browser
  seamtranscode previews <file>         poster and scrub sheet only (images too)
  seamtranscode probe <video>           size, length, frame rate as JSON
  seamtranscode serve                   run the HTTP worker (see the README)

Options
  -o, --out <folder>         where it goes (default: ./<video name>/)
  -r, --renditions <sizes>   short sides, e.g. 360,720,1080 (the default)
  -e, --encoder <name>       auto (default here), libx264, h264_videotoolbox,
                             h264_nvenc, h264_qsv
      --preset <name>        libx264 preset (default fast)
      --no-previews          skip the poster and scrub sheet
      --no-scrub             skip the scrub sheet
      --background           run ffmpeg at low priority
      --json                 print the result as JSON, nothing else
  -p, --port <port>          for serve and preview
  -h, --help

Across machines (storage from the environment; see the README)
  seamtranscode plan <key> --out <prefix> [--source-cache <path>]
  seamtranscode encode --plan <json|@file> --rendition <720p>
  seamtranscode finish --plan <json|@file> --results <json|@file>
  seamtranscode previews <key> --key --out <prefix>
  seamtranscode notify --type <event> --job <id> --data <json|@file>
  These take --webhook <url> --job <id> --metadata <json> to send signed
  events, with SEAMTRANSCODE_WEBHOOK_SECRET (or SEAMTRANSCODE_SECRET).
`;

const COMMANDS = new Set([
  "preview",
  "previews",
  "probe",
  "serve",
  "plan",
  "encode",
  "finish",
  "notify",
  "help",
]);

const { values: flags, positionals } = (() => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        out: { type: "string", short: "o" },
        renditions: { type: "string", short: "r" },
        encoder: { type: "string", short: "e" },
        preset: { type: "string" },
        "no-previews": { type: "boolean" },
        "no-scrub": { type: "boolean" },
        background: { type: "boolean" },
        json: { type: "boolean" },
        port: { type: "string", short: "p" },
        key: { type: "boolean" },
        plan: { type: "string" },
        rendition: { type: "string" },
        results: { type: "string" },
        previews: { type: "string" },
        "source-cache": { type: "string" },
        kind: { type: "string" },
        webhook: { type: "string" },
        job: { type: "string" },
        metadata: { type: "string" },
        type: { type: "string" },
        data: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`${(err as Error).message}\n\n${HELP}`);
    process.exit(2);
  }
})();

const tty = process.stderr.isTTY && !flags.json;
const color = tty && !process.env.NO_COLOR;
const paint = (code: string) => (text: string) =>
  color ? `\x1b[${code}m${text}\x1b[0m` : text;
const dim = paint("2");
const green = paint("32");
const bold = paint("1");
const red = paint("31");

const fail = (message: string): never => {
  throw new SeamtranscodeError("invalid_options", message);
};

/** A JSON value from an argument: inline, @file, or - for stdin. */
const jsonArg = async <T>(
  value: string | undefined,
  name: string
): Promise<T> => {
  if (value === undefined) return fail(`--${name} is required`);
  let text = value;
  if (value === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    text = Buffer.concat(chunks).toString("utf8");
  } else if (value.startsWith("@"))
    text = await readFile(value.slice(1), "utf8");
  try {
    return JSON.parse(text) as T;
  } catch {
    return fail(`--${name} isn't valid JSON`);
  }
};

const sizesArg = (value: string | undefined) =>
  value === undefined
    ? undefined
    : value.split(",").map((s) => {
        const n = Number(s.trim().replace(/p$/i, ""));
        if (!Number.isInteger(n)) fail(`Bad rendition size "${s}"`);
        return n;
      });

const previewSizes = (): PreviewSizes =>
  flags["no-scrub"] ? { scrub: false } : {};

const clock = (secs: number | null | undefined) => {
  if (!secs || !Number.isFinite(secs)) return "?";
  const s = Math.round(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

const out = (value: unknown) =>
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");

const webhookSecret = () =>
  process.env.SEAMTRANSCODE_WEBHOOK_SECRET ??
  process.env.SEAMTRANSCODE_SECRET ??
  fail("Set SEAMTRANSCODE_WEBHOOK_SECRET to send webhooks");

/** Send a signed event if --webhook was given. */
const notify = async (type: WebhookEventType, data: unknown) => {
  if (!flags.webhook) return;
  const metadata = flags.metadata
    ? await jsonArg(flags.metadata, "metadata")
    : null;
  await deliver(
    flags.webhook,
    webhookSecret(),
    makeEvent(type, flags.job ?? "job_cli", data as never, metadata)
  );
};

/** The live board: one row per thing being made. */
const board = () => {
  type Row = {
    label: string;
    state: "waiting" | "working" | "done";
    note: string;
    progress?: number;
  };
  const rows: Row[] = [];
  let drawn = 0;
  let header: string[] = [];
  let timer: NodeJS.Timeout | undefined;

  const bar = (p: number) => {
    const filled = Math.round(p * 12);
    return "█".repeat(filled) + dim("░".repeat(12 - filled));
  };
  const draw = () => {
    timer = undefined;
    if (!tty) return;
    const lines = [
      ...header,
      ...rows.map((r) => {
        const label = r.label.padEnd(14);
        if (r.state === "done") return `  ${green("✓")} ${label}${r.note}`;
        if (r.state === "waiting") return `    ${dim(label + "waiting")}`;
        const p = r.progress ?? 0;
        return `  ◐ ${label}${bar(p)} ${String(Math.round(p * 100)).padStart(3)}%  ${dim(r.note)}`;
      }),
    ];
    let text = drawn ? `\x1b[${drawn}A` : "";
    for (const line of lines) text += `\x1b[2K${line}\n`;
    process.stderr.write(text);
    drawn = lines.length;
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(draw, 80);
  };
  return {
    header: (lines: string[]) => {
      header = lines;
      if (!tty) for (const line of lines) process.stderr.write(line + "\n");
      schedule();
    },
    add: (label: string) => {
      rows.push({ label, state: "waiting", note: "" });
      schedule();
    },
    update: (label: string, change: Partial<Row>) => {
      const row = rows.find((r) => r.label === label);
      if (!row) return;
      const finished = change.state === "done" && row.state !== "done";
      Object.assign(row, change);
      if (!tty && finished)
        process.stderr.write(`  ✓ ${label.padEnd(14)}${row.note}\n`);
      schedule();
    },
    flush: () => {
      if (timer) clearTimeout(timer);
      draw();
    },
  };
};

const runTranscode = async (file: string) => {
  const outDir = path.resolve(flags.out ?? path.parse(file).name);
  const tools = resolveTools({
    ...(flags.background ? { priority: "background" as const } : {}),
  });
  const encoder = await resolveEncoder(
    tools,
    (flags.encoder ?? "auto") as EncoderChoice
  );
  const started = Date.now();
  const since = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  const ui = board();
  const shown = path.relative(process.cwd(), outDir) || ".";
  let firstPlayable = true;

  const result = await transcode({
    input: file,
    // keys relative to the folder, so the result travels with it
    storage: local({ root: outDir }),
    output: "",
    encoder,
    ...(flags.preset ? { preset: flags.preset } : {}),
    ...(flags.background ? { priority: "background" as const } : {}),
    ...(sizesArg(flags.renditions)
      ? { renditions: sizesArg(flags.renditions)! }
      : {}),
    previews: flags["no-previews"] ? false : previewSizes(),
    onPlan: (plan) => {
      const s = plan.source;
      ui.header([
        `${bold("seamtranscode")}  ${path.basename(file)} → ./${shown}/`,
        dim(
          `  ${s.width}×${s.height} · ${clock(s.duration)} · ${s.codec ?? "?"}` +
            `${s.fps ? ` · ${s.fps} fps` : ""} · ${encoder}`
        ),
        "",
      ]);
      if (!flags["no-previews"]) ui.add("poster");
      for (const r of plan.renditions) ui.add(r.name);
    },
    onPreviews: (p) =>
      ui.update("poster", {
        state: "done",
        note: `${since().padEnd(7)}${p.scrub ? dim(`with a ${p.scrub.count}-frame scrub sheet`) : ""}`,
      }),
    onProgress: (p) => {
      if (p.stage !== "encoding" || !p.rendition) return;
      ui.update(p.rendition, {
        state: "working",
        progress: p.renditionProgress ?? 0,
        note: p.eta === null ? "" : `~${clock(p.eta)} left`,
      });
    },
    onRendition: (r) => {
      ui.update(r.name, {
        state: "done",
        note: `${since().padEnd(7)}${firstPlayable ? green("← playable now") : ""}`,
      });
      firstPlayable = false;
    },
  });
  ui.flush();

  await writeFile(
    path.join(outDir, "seamtranscode.json"),
    JSON.stringify(result, null, 2)
  );
  if (flags.json) return out(result);

  const files: [string, string][] = [
    ["master.m3u8", `HLS, ${result.renditions.map((r) => r.name).join(" / ")}`],
  ];
  if (result.previews) {
    const p = result.previews;
    files.push([
      path.basename(p.poster.key),
      `${p.poster.width}×${p.poster.height}`,
    ]);
    if (p.scrub)
      files.push([
        "scrub.jpg",
        `${p.scrub.count} frames for the filmstrip seek bar`,
      ]);
  }
  const width = Math.max(...files.map(([name]) => name.length)) + 3;
  const lines = [
    "",
    `  ${green("✓")} done in ${since()}`,
    "",
    ...files.map(
      ([name, about]) =>
        `  ${`${shown}/${name}`.padEnd(shown.length + 1 + width)}${about}`
    ),
  ];
  for (const w of result.warnings) lines.push(`  ${paint("33")("!")} ${w}`);
  lines.push(
    "",
    `  Play it:  ${bold(`npx seamtranscode preview ${shown}`)}`,
    ""
  );
  process.stderr.write(lines.join("\n") + "\n");
};

const runPreview = async (dir: string) => {
  const root = path.resolve(dir);
  const manifest = JSON.parse(
    await readFile(path.join(root, "seamtranscode.json"), "utf8").catch(() =>
      fail(
        `No seamtranscode.json in ${dir}: transcode into it with the CLI first`
      )
    )
  ) as TranscodeResult;
  const media = toSeamPlayer(manifest, { baseUrl: "/" });
  const title = path.basename(root);
  const htmlTitle = title.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!
  );
  const scriptJson = (value: unknown) =>
    JSON.stringify(value).replace(/</g, "\\u003c");
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlTitle} · seamtranscode</title>
<style>
:root{color-scheme:dark}body{margin:0;background:#0c0c0d;color:#e8e8ea;font:14px/1.5 system-ui,sans-serif}
main{max-width:960px;margin:0 auto;padding:32px 16px}h1{font-size:15px;font-weight:600;margin:0 0 16px}
table{margin-top:20px;border-collapse:collapse;width:100%;font-size:13px}td{padding:6px 8px 6px 0;border-top:1px solid #222;color:#a0a0a6}td:first-child{color:#e8e8ea}
</style>
<script type="importmap">{"imports":{
"react":"https://esm.sh/react@19.2.0",
"react-dom/client":"https://esm.sh/react-dom@19.2.0/client?external=react",
"seamplayer":"https://esm.sh/seamplayer@0.1?external=react,react-dom"}}</script>
</head><body><main><h1>${htmlTitle}</h1><div id="player"></div><table id="info"></table></main>
<script type="module">
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { SeamPlayer } from "seamplayer";
const media = ${scriptJson(media)};
const result = ${scriptJson({ renditions: manifest.renditions, source: manifest.source })};
createRoot(document.getElementById("player")).render(createElement(SeamPlayer, { ...media, title: ${scriptJson(title)} }));
const info = document.getElementById("info");
for (const r of result.renditions) {
  const row = document.createElement("tr");
  for (const value of [r.name, r.width + "×" + r.height, Math.round(r.bandwidth / 1000) + " kbps peak", r.segments + " segments", r.encoder]) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.append(cell);
  }
  info.append(row);
}
</script></body></html>`;

  const types: Record<string, string> = {
    ".m3u8": "application/vnd.apple.mpegurl",
    ".ts": "video/mp2t",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".json": "application/json",
  };
  const server = http.createServer(async (req, res) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(
        new URL(req.url ?? "/", "http://x").pathname
      );
    } catch {
      res.writeHead(400);
      return res.end("Invalid URL");
    }
    if (pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(page);
    }
    const file = path.resolve(root, "." + pathname);
    const info = file.startsWith(root + path.sep)
      ? await stat(file).catch(() => null)
      : null;
    if (!info?.isFile()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      "content-type": types[path.extname(file)] ?? "application/octet-stream",
      "content-length": info.size,
    });
    createReadStream(file).pipe(res);
  });
  const port = Number(flags.port ?? 4800);
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const actualPort =
      typeof address === "object" && address ? address.port : port;
    process.stderr.write(
      `\n  Playing ${bold(title)} at ${bold(`http://localhost:${actualPort}`)}  ${dim("(Ctrl+C to stop)")}\n\n`
    );
  });
};

const inputArg = (value: string | undefined): Input => {
  if (!value) return fail("Which file? See seamtranscode --help");
  return flags.key ? { key: value } : value;
};

const main = async () => {
  const [first, ...rest] = positionals;
  if (flags.help || first === "help" || !first) {
    if (!first && !flags.help) {
      process.stderr.write(HELP);
      process.exit(2);
    }
    return process.stdout.write(HELP);
  }
  const command = COMMANDS.has(first) ? first : "transcode";
  const arg = command === "transcode" ? first : rest[0];
  const storage =
    flags.key || ["plan", "encode", "finish"].includes(command)
      ? await storageFromEnv()
      : undefined;

  switch (command) {
    case "transcode":
      return runTranscode(arg!);

    case "preview":
      return runPreview(arg ?? ".");

    case "probe":
      return out(await probe(arg ?? fail("Which video?")));

    case "previews": {
      const input = inputArg(arg);
      const output =
        flags.out ??
        (typeof input === "string"
          ? path.parse(input).name
          : fail("--out is required with --key"));
      const result = await previews({
        input,
        output,
        ...(storage ? { storage } : {}),
        ...previewSizes(),
        ...(flags.kind === "video" || flags.kind === "image"
          ? { kind: flags.kind }
          : {}),
      });
      await notify("previews.completed", result);
      return out(result);
    }

    case "serve": {
      const secret =
        process.env.SEAMTRANSCODE_SECRET ??
        fail("Set SEAMTRANSCODE_SECRET: callers send it as a Bearer token");
      const env = process.env;
      const server = createServer({
        storage: await storageFromEnv(),
        secret,
        ...(env.SEAMTRANSCODE_WEBHOOK_SECRET
          ? { webhookSecret: env.SEAMTRANSCODE_WEBHOOK_SECRET }
          : {}),
        ...(env.SEAMTRANSCODE_WEBHOOK_URL
          ? { webhookUrl: env.SEAMTRANSCODE_WEBHOOK_URL }
          : {}),
        ...(env.SEAMTRANSCODE_RENDITIONS
          ? { renditions: sizesArg(env.SEAMTRANSCODE_RENDITIONS)! }
          : {}),
        encoder: (flags.encoder ??
          env.SEAMTRANSCODE_ENCODER ??
          "libx264") as EncoderChoice,
        ...(env.SEAMTRANSCODE_CONCURRENCY
          ? {
              concurrency: { transcode: Number(env.SEAMTRANSCODE_CONCURRENCY) },
            }
          : {}),
        ...(env.SEAMTRANSCODE_WORK_DIR
          ? { workDir: env.SEAMTRANSCODE_WORK_DIR }
          : {}),
        ...(flags.background ? { priority: "background" as const } : {}),
      });
      await server.listen(
        Number(flags.port ?? env.SEAMTRANSCODE_PORT ?? env.PORT ?? 8100)
      );
      const stop = () => void server.close().then(() => process.exit(0));
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      return;
    }

    case "plan": {
      const plan = await planTranscode({
        input: inputArg(arg),
        output: flags.out ?? fail("--out is required"),
        storage: storage!,
        ...(sizesArg(flags.renditions)
          ? { renditions: sizesArg(flags.renditions)! }
          : {}),
        ...(flags.encoder ? { encoder: flags.encoder as EncoderChoice } : {}),
        ...(flags.preset ? { preset: flags.preset } : {}),
        ...(flags["source-cache"]
          ? { sourceCache: flags["source-cache"] }
          : {}),
      });
      return out(plan);
    }

    case "encode": {
      const plan = await jsonArg<TranscodePlan>(flags.plan, "plan");
      const result = await encodeRendition(
        plan,
        flags.rendition ?? fail("--rendition is required"),
        {
          storage: storage!,
          ...(flags.background ? { priority: "background" as const } : {}),
        }
      );
      await notify("transcode.rendition", result);
      return out(result);
    }

    case "finish": {
      const plan = await jsonArg<TranscodePlan>(flags.plan, "plan");
      const results = await jsonArg<RenditionResult[]>(
        flags.results,
        "results"
      );
      const preview = flags.previews
        ? await jsonArg<TranscodeResult["previews"]>(flags.previews, "previews")
        : null;
      const result = await finishTranscode(plan, results, {
        storage: storage!,
        previews: preview,
      });
      await notify("transcode.completed", result);
      return out(result);
    }

    case "notify": {
      if (!flags.webhook) fail("--webhook is required");
      const type = (flags.type ??
        fail("--type is required")) as WebhookEventType;
      await notify(type, await jsonArg(flags.data, "data"));
      return;
    }
  }
};

main().catch((err: unknown) => {
  if (flags.json) {
    out({
      error:
        err instanceof SeamtranscodeError
          ? { kind: err.kind, message: err.message }
          : { kind: "internal", message: String(err) },
    });
  } else if (err instanceof SeamtranscodeError) {
    process.stderr.write(`\n  ${red("✗")} ${err.message}\n`);
    if (err.log && process.env.DEBUG) process.stderr.write(`\n${err.log}\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
