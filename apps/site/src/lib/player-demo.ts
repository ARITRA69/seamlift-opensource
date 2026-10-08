import type { SeamPlayerProps } from "seamplayer";

const sizes = [
  { height: 720, src: "/demo/film.mp4", bytes: 3274724 },
  { height: 480, src: "/demo/film-480.mp4", bytes: 1991535 },
  { height: 360, src: "/demo/film-360.mp4", bytes: 1406970 },
];

export const demoProps = {
  src: sizes.map(({ src, height }) => ({ src, height })),
  poster: "/demo/poster.jpg",
  title: "Creators around the world",
  duration: 29,
  fps: 24,
  resumeKey: "seamplayer-demo-v1",
  thumbnails: {
    url: "/demo/scrub.jpg",
    width: 320,
    height: 180,
    columns: 10,
    count: 29,
    interval: 1,
  },
  chapters: [
    { start: 0, title: "Lisbon" },
    { start: 4, title: "Western Norway" },
    { start: 9, title: "Mumbai" },
    { start: 13, title: "Goa" },
    { start: 17, title: "Lagos" },
    { start: 21, title: "Mexico City" },
    { start: 25, title: "Tokyo" },
  ],
  captions: [{ src: "/demo/places.vtt", lang: "en", label: "English" }],
  download: sizes.map(({ src, height, bytes }) => ({
    url: src,
    label: `${height}p`,
    filename: `creators-around-the-world-${height}p.mp4`,
    size: bytes,
  })),
  shareUrl: "/seamplayer",
} satisfies SeamPlayerProps;
