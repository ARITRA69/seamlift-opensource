# Changelog

## 0.1.1

- Move development and publishing into the standalone `ARITRA69/seamplayer` repository.
- Remove the Seamlift workspace configuration dependency.
- Add CI, player regression tests, and packed-package checks for React 18 and 19, ESM, CommonJS, and TypeScript consumers.
- Honor `startTime` during autoplay.
- Report HLS loading failures through the player error state and `onError`.
- Restore playback speed when a touch hold is cancelled.
