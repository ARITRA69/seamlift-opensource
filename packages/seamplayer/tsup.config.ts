import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  loader: { ".css": "text" },
  sourcemap: true,
  clean: true,
  target: "es2020",
  // hls.js stays a separate import, so apps only download it for HLS
  external: ["react", "react-dom", "hls.js"],
  // the player uses state and effects: a client component in Next.js
  banner: { js: '"use client";' },
});
