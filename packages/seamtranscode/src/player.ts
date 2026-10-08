import type { TranscodeResult } from "./transcode";
import { joinUrl } from "./storage/types";

/** The props seamplayer's <SeamPlayer> takes for a transcoded video. */
export type SeamPlayerMedia = {
  src: string;
  poster?: string;
  duration?: number;
  fps?: number;
  thumbnails?: {
    url: string;
    width: number;
    height: number;
    columns: number;
    count: number;
    interval: number;
  };
};

const urlOf = (file: { key: string; url?: string }, baseUrl?: string) => {
  if (file.url) return file.url;
  if (baseUrl !== undefined) return joinUrl(baseUrl, file.key);
  throw new Error(
    `No URL for "${file.key}": give the storage a publicUrl, or pass { baseUrl } to toSeamPlayer()`
  );
};

/**
 * A transcode result as <SeamPlayer> props:
 * `<SeamPlayer {...toSeamPlayer(result)} title="Launch" />`.
 * Safe to import in the browser.
 */
export const toSeamPlayer = (
  result: Pick<TranscodeResult, "playlist" | "previews" | "source">,
  options: { baseUrl?: string } = {}
): SeamPlayerMedia => {
  const { playlist, previews, source } = result;
  const media: SeamPlayerMedia = { src: urlOf(playlist, options.baseUrl) };
  if (previews) media.poster = urlOf(previews.poster, options.baseUrl);
  if (source.duration) media.duration = source.duration;
  if (source.fps) media.fps = Math.min(source.fps, 60);
  if (previews?.scrub) {
    const s = previews.scrub;
    media.thumbnails = {
      url: urlOf(s, options.baseUrl),
      width: s.frameWidth,
      height: s.frameHeight,
      columns: s.columns,
      count: s.count,
      interval: s.interval,
    };
  }
  return media;
};
