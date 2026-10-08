/** @jsxImportSource react */
"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createSeamPlayer, renderPoster, themeStyle } from "./player";
import { styles } from "./styles";
import type {
  SeamPlayerHandle,
  SeamPlayerInstance,
  SeamPlayerOptions,
} from "./types";
import { cx } from "./utils";

export type SeamPlayerProps = Omit<SeamPlayerOptions, "style"> & {
  style?: CSSProperties;
};

/** React 18/19 adapter. The same framework-free player powers every entry. */
export const SeamPlayer = forwardRef<SeamPlayerHandle, SeamPlayerProps>(
  function SeamPlayer(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const player = useRef<SeamPlayerInstance | null>(null);
    const options = props as SeamPlayerOptions;
    const latest = useRef(options);
    latest.current = options;
    // React owns the host, the player owns its children. Keep the initial HTML
    // stable across prop changes so React never replaces a playing video.
    const [poster] = useState(() => ({ __html: renderPoster(options) }));
    useImperativeHandle(
      ref,
      () => ({
        play: () => player.current?.play(),
        pause: () => player.current?.pause(),
        seek: (time) => player.current?.seek(time),
        get video() {
          return player.current?.video ?? null;
        },
      }),
      []
    );
    useEffect(() => {
      const instance = createSeamPlayer(host.current!, latest.current);
      player.current = instance;
      return () => {
        instance.destroy();
        player.current = null;
      };
    }, []);
    useEffect(() => {
      player.current?.update(options);
    });
    return (
      <>
        <style
          data-seamplayer=""
          dangerouslySetInnerHTML={{ __html: styles }}
        />
        <div
          ref={host}
          className={cx("sp", props.className)}
          role="group"
          tabIndex={0}
          aria-label={`${props.title ?? "Video"}, video player`}
          style={
            { ...themeStyle(options.theme), ...props.style } as CSSProperties
          }
          dangerouslySetInnerHTML={poster}
        />
      </>
    );
  }
);
