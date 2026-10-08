# Changelog

## Unreleased

- Move the repository to `ARITRA69/seamlift-opensource`, home of Seamlift's open-source projects. Seamplayer's docs now live at https://opensource.seamlift.com/seamplayer.

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
