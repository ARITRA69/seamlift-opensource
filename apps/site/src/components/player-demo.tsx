"use client";

import { SeamPlayer } from "seamplayer";

export function PlayerDemo() {
  return (
    <SeamPlayer
      src="/demo/film.mp4"
      poster="/demo/poster.jpg"
      title="Creators around the world"
      duration={29}
      thumbnails={{
        url: "/demo/scrub.jpg",
        width: 320,
        height: 180,
        columns: 10,
        count: 29,
        interval: 1,
      }}
      chapters={[
        { start: 0, title: "Lisbon" },
        { start: 4, title: "Western Norway" },
        { start: 12, title: "On the road" },
      ]}
      download={{
        url: "/demo/film.mp4",
        filename: "seamplayer-demo.mp4",
        label: "720p",
      }}
    />
  );
}
