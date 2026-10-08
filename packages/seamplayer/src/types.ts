import type { CSSProperties } from "react";

/** The same video in one MP4/WebM size. */
export type SeamSource = {
  src: string;
  /** pixel height of this file, e.g. 720 */
  height: number;
};

/**
 * A sprite sheet of frames for the filmstrip and hover previews: `count`
 * frames of `width` × `height`, `columns` per row; frame i shows the moment
 * (i + 0.5) × `interval` seconds.
 */
export type SeamThumbnails = {
  url: string;
  width: number;
  height: number;
  columns: number;
  count: number;
  interval: number;
};

export type SeamChapter = {
  /** seconds */
  start: number;
  title: string;
};

/** A WebVTT file. The player draws captions itself, above its controls. */
export type SeamCaption = {
  src: string;
  /** language code, e.g. "en" */
  lang: string;
  /** shown in the menu, e.g. "English" */
  label: string;
};

/** A file to offer for download. */
export type SeamDownload = {
  url: string;
  /** names it in a list of several, e.g. "1080p" */
  label?: string;
  /** the saved file's name */
  filename?: string;
  /** bytes, shown next to the label */
  size?: number;
};

/** Every colour also reads from a CSS variable; see styles.css. */
export type SeamTheme = {
  /** play button, fills, active choices; default #e0115f */
  accent?: string;
  /** text and icons on the accent; default #ffffff */
  accentText?: string;
  /** player background; default #15121a */
  background?: string;
  /** control surfaces; default #15121a */
  surface?: string;
  /** text and icons; default #ffffff */
  text?: string;
  /** highlighted moments; default #ffd23f */
  highlight?: string;
  /** text on highlights; default #1a0b14 */
  highlightText?: string;
  /** corner radius of the player; default 16px */
  radius?: string;
  /** default inherits the page font */
  font?: string;
  /** times and sizes; default a monospace stack */
  monoFont?: string;
};

export type SeamPlayerHandle = {
  play: () => void;
  pause: () => void;
  /** jump to a moment, in seconds */
  seek: (time: number) => void;
  /** the underlying element, once the first play has created it */
  readonly video: HTMLVideoElement | null;
};

export type SeamPlayerProps = {
  /**
   * An MP4/WebM file, an HLS playlist (.m3u8), or the same video in several
   * MP4 sizes. With sizes, Quality switches between them and Auto picks the
   * smallest that's sharp at the player's size on this screen.
   */
  src: string | SeamSource[];
  /** names the player for screen readers; default "Video" */
  title?: string;
  /** shown until the first play; the video itself loads only then */
  poster?: string;
  /** seconds; shown on the poster before anything has loaded */
  duration?: number;
  /** frames for the filmstrip seek bar and hover previews */
  thumbnails?: SeamThumbnails;
  /** the seek bar splits into segments at each */
  chapters?: SeamChapter[];
  captions?: SeamCaption[];
  /**
   * Offer Download: one file, several (Download then lists each with its
   * size), or your own handler, e.g. one that fetches a signed URL first.
   * URLs must be same-origin or send Content-Disposition: attachment.
   */
  download?: SeamDownload | SeamDownload[] | (() => void);
  /**
   * Offer "Copy link at 0:12": the URL of the page the player is on (can be
   * relative). The player adds ?t=12; pass that back as `startTime`.
   */
  shareUrl?: string;
  /** start at this second, e.g. from a link's ?t= */
  startTime?: number;
  /** start straight away, muted, with a tap-to-unmute button */
  autoPlay?: boolean;
  /** start with Loop on */
  loop?: boolean;
  /** remember where each viewer stopped, under this key */
  resumeKey?: string;
  /** frames per second, for stepping a frame with , and . */
  fps?: number;
  theme?: SeamTheme;
  /** a button on the end screen, next to Replay */
  endAction?: { label: string; href: string };
  className?: string;
  style?: CSSProperties;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: MediaError | null) => void;
};
