# Changelog

## Unreleased (seamplayer 0.2.0, seamtranscode 0.1.0)

- Seamplayer shows the playing video on the lock screen and in the system's media controls, and answers media keys and headset buttons (Media Session API).
- "Try again" after a playback error reloads the video and picks up where it stopped, instead of starting over.
- Home and End jump to the start and end; number keys, Home and End flash the time they jumped to.
- The resume point is saved the moment the tab is hidden, so closing a tab keeps the exact second.
- Add a framework-free seamplayer core and `<seam-player>` custom element for Astro, Svelte, Vue and plain JavaScript. Preserve the React 18/19 API through a thin adapter.
- Add framework examples and an Expo DOM bridge example for React Native.
- Add seamtranscode: aligned adaptive HLS, posters, scrub sheets, storage adapters, CLI, signed-webhook HTTP worker and distributed compute steps.
- Add both projects to the site, sitemap and LLM documentation.

## 0.1.2

- Move the repository to `ARITRA69/seamlift-opensource`, home of Seamlift's open-source projects. Seamplayer's docs now live at https://opensource.seamlift.com/seamplayer.
- Use Hugeicons for the player's icons. They are bundled into the build, so the package gains no dependency.
- Lower the package's `engines.node` to `>=18`. The library needs no Node 22 APIs, and the old range blocked Yarn 1 installs on Node 18 and 20.

## 0.1.1

- Move development and publishing into the standalone `ARITRA69/seamplayer` repository.
- Organize the repository into two Bun workspaces: `packages/seamplayer` and the Next.js/shadcn companion site at `apps/site`.
- Enforce website styling with `@shadcn/lint` in CI.
- Add a single-page playground with live configuration and typechecked, copyable React examples.
- Keep settings menus scrollable inside short player previews.
- Remove the Seamlift workspace configuration dependency.
- Add CI, player regression tests, and packed-package checks for React 18 and 19, ESM, CommonJS, and TypeScript consumers.
- Honor `startTime` during autoplay.
- Report HLS loading failures through the player error state and `onError`.
- Restore playback speed when a touch hold is cancelled.
