# Seamplayer

A React video player and its companion website in a small Bun monorepo.

```text
apps/site/             Next.js App Router website with shadcn/ui
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
bun run check          # formatting, lint, both builds, types, player tests
bun run verify:package # isolated React 18/19 tarball checks
bun run format
bun run lint
```

## Website

The website uses Next.js, Tailwind v4, and shadcn/ui. Add UI components from the repository root:

```sh
bun run --filter @seamplayer/site ui:add dialog
```

`apps/site/components.json` configures component generation. `apps/site/src/app/globals.css` owns the site's semantic theme tokens. `apps/site/eslint.config.mjs` combines Next.js linting with all six `@shadcn/lint` rules as errors: component styling contracts, semantic colors, scale values, inline styles, known classes, and static classes. Edit component variants instead of restyling them at call sites.

## Package and releases

See [the package README](packages/seamplayer/README.md) for installation, props, and examples.

1. Update `packages/seamplayer/package.json` and `CHANGELOG.md`.
2. Run `bun install`, `bun run check`, and `bun run verify:package`.
3. Commit, then run `bun run publish:player` from the repository root.
4. Tag the published commit as `v<version>` and push the tag.

The root and site are private. Only `packages/seamplayer` is published; its packing and publishing hooks build fresh outputs and run package checks.

Seamlift consumes a pinned npm release from this repository.

## License

MIT
