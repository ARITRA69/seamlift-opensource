# Seamlift Open Source

The open-source parts of [Seamlift](https://seamlift.com), in one Bun monorepo, documented at [opensource.seamlift.com](https://opensource.seamlift.com).

| Project                                     | Description              | Docs                                                                             |
| ------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| [seamplayer](packages/seamplayer/README.md) | A video player for React | [opensource.seamlift.com/seamplayer](https://opensource.seamlift.com/seamplayer) |

```text
apps/site/             opensource.seamlift.com: Next.js App Router website with shadcn/ui
packages/seamplayer/   The public seamplayer npm package
```

Requires Node.js 22+ and Bun 1.4.2. There is one lockfile. The npm package remains self-contained; website dependencies are never published with it.

## Develop

```sh
bun install --frozen-lockfile
bun run dev
```

The site runs at http://localhost:3001. The player builds before the site starts, then both run in watch mode. The site consumes the actual package exports through `workspace:*`.

```sh
bun run build          # player, then production website
bun run check          # formatting, lint, both builds, types, player and example checks
bun run verify:package # isolated React 18/19 tarball checks
bun run format
bun run lint
```

## Website

The website uses Next.js, Tailwind v4, and shadcn/ui. Add UI components from the repository root:

```sh
bun run --filter @seamlift-opensource/site ui:add dialog
```

`apps/site/components.json` configures component generation. `apps/site/src/app/globals.css` owns the site's semantic theme tokens. `apps/site/eslint.config.mjs` combines Next.js linting with all six `@shadcn/lint` rules as errors: component styling contracts, semantic colors, scale values, inline styles, known classes, and static classes. Edit component variants instead of restyling them at call sites.

The home page lists the projects. Each project gets its own route; `/seamplayer` is one documentation page with a centered player demo, a sticky contents rail, and a floating navigation dock. It includes basic usage, a configurable player playground with complete copyable React code, prop descriptions, styling, and the React API. Media tools, playback options, appearance, imperative controls, and callbacks all feed the same typed configuration used by the preview and code generator. It starts with Seamlift’s full brand demo and supports your own MP4, WebM, or HLS URL. Demo metadata is omitted for custom media. Option changes remount the preview so initial playback props take effect.

`bun run test` also typechecks the generated components for every combination of sources, refs, and callbacks. The page lists built-in keyboard and touch controls, and links to demo assets and the package API reference.

## Seamplayer releases

See [the package README](packages/seamplayer/README.md) for installation, props, and examples.

1. Update `packages/seamplayer/package.json` and `CHANGELOG.md`.
2. Run `bun install`, `bun run check`, and `bun run verify:package`.
3. Commit, then run `bun run publish:player` from the repository root.
4. Tag the published commit as `v<version>` and push the tag.

The root and site are private. Only packages under `packages/` are published; its packing and publishing hooks build fresh outputs and run package checks.

Seamlift consumes a pinned npm release from this repository.

## License

MIT
