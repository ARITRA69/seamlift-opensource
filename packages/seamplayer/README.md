# seamplayer

A video player for React that loads like an image and plays like the players people already know.

- **Poster first.** Until someone presses play, it's a picture and a button. The video, and hls.js for HLS streams, load on the first play.
- **A filmstrip seek bar.** Give it a sprite sheet of frames and the bar opens into the video's real frames as the pointer comes near, with the frame under the pointer magnified.
- **Chapters, quality, captions, speed and loop** in one settings menu, where every row shows what it's set to.
- **Download** in one or several sizes, and **Copy link at 0:12**.
- **Keyboard and touch.** YouTube's keys (Space, J/K/L, arrows, 0–9, F, M, C, `<` `>`, `,` `.`, `?`). On phones, tap shows the controls, double-tap a side skips 10s, and holding plays at 2×.
- **It remembers** volume, speed, captions and where each viewer stopped.

## Install

```sh
npm install seamplayer
```

React 18 or 19.

## Use

```tsx
import { SeamPlayer } from "seamplayer";

export const Launch = () => (
  <SeamPlayer
    src="https://cdn.example.com/launch/master.m3u8"
    poster="https://cdn.example.com/launch/poster.jpg"
    title="Launch film"
  />
);
```

The player includes its default styles automatically, including during server rendering. No CSS import or separate download is needed. It fills its container's width at 16:9.

### Several sizes

Pass the same video in several MP4 sizes. Quality switches between them, and Auto picks the smallest that's sharp at the player's size on that screen. Switching keeps the moment, and whether it was playing.

```tsx
<SeamPlayer
  src={[
    { src: "/film-1080.mp4", height: 1080 },
    { src: "/film-720.mp4", height: 720 },
    { src: "/film-480.mp4", height: 480 },
  ]}
/>
```

An HLS playlist gets its sizes from the stream instead.

### Everything else

```tsx
<SeamPlayer
  src={sources}
  poster="/poster.jpg"
  title="Creators around the world"
  duration={29}
  thumbnails={{
    url: "/scrub.jpg",
    width: 320,
    height: 180,
    columns: 10,
    count: 29,
    interval: 1,
  }}
  chapters={[
    { start: 0, title: "Lisbon" },
    { start: 4, title: "Western Norway" },
  ]}
  captions={[{ src: "/en.vtt", lang: "en", label: "English" }]}
  download={[
    { url: "/film-1080.mp4", label: "1080p", size: 210_000_000 },
    { url: "/film-720.mp4", label: "720p", size: 98_000_000 },
  ]}
  shareUrl="/watch/creators"
  startTime={Number(searchParams.get("t")) || undefined}
  resumeKey="creators"
  theme={{ accent: "#2f6bff" }}
  onEnded={() => track("watched")}
/>
```

| Prop                                                  |                                                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src`                                                 | An MP4/WebM URL, an HLS playlist, or `{ src, height }[]` sizes                                                                            |
| `title`                                               | Names the player for screen readers                                                                                                       |
| `poster`                                              | Shown until the first play                                                                                                                |
| `duration`                                            | Seconds, shown on the poster                                                                                                              |
| `thumbnails`                                          | A sprite sheet: `count` frames of `width` × `height`, `columns` per row; frame i shows (i + 0.5) × `interval` seconds                     |
| `chapters`                                            | `{ start, title }[]`; the bar splits into segments, and the current chapter shows next to the time                                        |
| `captions`                                            | WebVTT `{ src, lang, label }[]`, drawn by the player above its controls. From another host they need CORS                                 |
| `download`                                            | One `{ url, label?, filename?, size? }`, several, or your own handler. URLs must be same-origin or send `Content-Disposition: attachment` |
| `shareUrl`                                            | Adds "Copy link at 0:12" (the player appends `?t=12`)                                                                                     |
| `startTime`                                           | Start at this second, e.g. from `?t=`                                                                                                     |
| `autoPlay`                                            | Start muted straight away, with a "Tap to unmute" button                                                                                  |
| `loop`                                                | Start with Loop on                                                                                                                        |
| `resumeKey`                                           | Remember where each viewer stopped, and offer "Continue from"                                                                             |
| `fps`                                                 | For frame stepping with `,` and `.` (default 30)                                                                                          |
| `theme`                                               | `{ accent, accentText, radius, font, monoFont }`                                                                                          |
| `endAction`                                           | `{ label, href }`, a button next to Replay at the end                                                                                     |
| `onPlay` `onPause` `onEnded` `onTimeUpdate` `onError` |                                                                                                                                           |

### Control it

```tsx
import { useRef } from "react";
import { SeamPlayer, type SeamPlayerHandle } from "seamplayer";

const player = useRef<SeamPlayerHandle>(null);

<SeamPlayer ref={player} src="/film.mp4" />;

player.current?.seek(42);
player.current?.play();
player.current?.video; // the <video> element, once it exists
```

### Style it

`theme` controls accent, background, surface, text and highlight colors, corners and fonts. Translucent controls follow these colors automatically. Every colour, the radius and the easing are CSS variables on `.sp`, so you can also set them in your own CSS:

```css
.sp {
  --sp-accent: #2f6bff;
  --sp-highlight: #fff3b0;
  --sp-radius: 0;
  --sp-font-mono: "IBM Plex Mono", monospace;
}
```

## Server rendering

The player renders on the server as its poster and button, and reads storage only in the browser. Its build starts with `"use client"`, so it works in Next.js app router pages without a wrapper.

## Development

This workspace owns the `seamplayer` npm package. It builds independently and has no workspace dependencies. The companion Next.js site lives in `apps/site`.

Requires Node.js 22+ and Bun 1.4.2. Run development and release commands from the repository root.

```sh
bun install --frozen-lockfile
bun run check
bun run verify:package
bun run dev
```

`check` runs formatting, lint, strict TypeScript checking, the package and website production builds, and player regression tests. `verify:package` installs the actual tarball in temporary React 18 and React 19 projects, checks both module formats and server rendering in Node, and typechecks public imports. New dependency releases wait three days before installation.

## Release

1. Update `version` in `packages/seamplayer/package.json` and add the changes to `CHANGELOG.md`.
2. Run `bun install` to update the lockfile, then `bun run check` and `bun run verify:package`.
3. Commit the release and publish from the repository root with `bun run publish:player` using an npm account with access to `seamplayer`.
4. Tag the published commit as `v<version>` and push the commit and tag.

Publishing runs the checks first. Packing builds fresh outputs. The package includes only `dist`, the README, the license, and package metadata; React and React DOM remain peer dependencies, and hls.js is loaded on demand.

Seamlift consumes a pinned registry version. To develop against a local build, run `bun run build:player` from the repository root and temporarily set its dependency to `file:../../../seamplayer/packages/seamplayer`, then install from Seamlift's root. Restore the published version before committing.

## License

MIT
