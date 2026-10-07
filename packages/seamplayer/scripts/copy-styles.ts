await Bun.write(
  new URL("../dist/styles.css", import.meta.url),
  Bun.file(new URL("../src/styles.css", import.meta.url))
);
export {};
