"use dom";

import type { DOMProps } from "expo/dom";
import { SeamPlayer } from "seamplayer/react";

// Keep props serializable. Native actions must be top-level async functions.
export default function SeamPlayerDOM({
  src,
  poster,
  title,
  onTimeUpdate,
}: {
  src: string;
  poster?: string;
  title?: string;
  dom?: DOMProps;
  onTimeUpdate?: (time: number) => Promise<void>;
}) {
  return (
    <SeamPlayer
      src={src}
      poster={poster}
      title={title}
      onTimeUpdate={(time) => {
        void onTimeUpdate?.(time);
      }}
    />
  );
}
