import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm", "cjs"],
  dts: true,
  loader: { ".css": "text" as const },
  sourcemap: true,
  target: "es2020",
  external: ["react", "react-dom", "hls.js"],
};
export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts", react: "src/react.tsx" },
    clean: true,
    banner: { js: '"use client";' },
  },
  { ...shared, entry: { core: "src/core.ts", element: "src/element.ts" } },
]);
