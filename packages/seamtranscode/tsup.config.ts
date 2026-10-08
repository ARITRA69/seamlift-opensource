import { defineConfig } from "tsup";

// the S3 SDK and sharp are optional peers: only the entries that need them
// import them, so a plain install never pulls them in
const external = ["@aws-sdk/client-s3", "sharp"];

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      s3: "src/storage/s3.ts",
      server: "src/server/index.ts",
      webhooks: "src/webhooks.ts",
      player: "src/player.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node18",
    platform: "node",
    external,
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    sourcemap: true,
    target: "node18",
    platform: "node",
    external,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
