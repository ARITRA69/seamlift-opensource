import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowShrinkIcon,
  ClosedCaptionIcon,
  DashboardSpeed02Icon,
  Download04Icon,
  FastForwardIcon,
  FullScreenIcon,
  HdIcon,
  KeyboardIcon,
  LeftToRightListBulletIcon,
  Link04Icon,
  PauseIcon,
  PictureInPictureOnIcon,
  PlayIcon,
  Redo02Icon,
  RepeatIcon,
  ReplayIcon,
  SlidersHorizontalIcon,
  Tick02Icon,
  Undo02Icon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMute02Icon,
} from "@hugeicons/core-free-icons";
import { element } from "./jsx/dom";

// Hugeicons (free, MIT). The icon data is bundled into the build, so the
// package has no icon dependency. Strokes follow currentColor.

type IconData = readonly (readonly [string, Record<string, unknown>])[];

const ICONS = {
  play: PlayIcon,
  pause: PauseIcon,
  volumeHigh: VolumeHighIcon,
  volumeLow: VolumeLowIcon,
  volumeMute: VolumeMute02Icon,
  captions: ClosedCaptionIcon,
  settings: SlidersHorizontalIcon,
  pip: PictureInPictureOnIcon,
  fullscreen: FullScreenIcon,
  fullscreenExit: ArrowShrinkIcon,
  chevronRight: ArrowRight01Icon,
  chevronLeft: ArrowLeft01Icon,
  check: Tick02Icon,
  download: Download04Icon,
  link: Link04Icon,
  loop: RepeatIcon,
  keyboard: KeyboardIcon,
  chapters: LeftToRightListBulletIcon,
  speed: DashboardSpeed02Icon,
  quality: HdIcon,
  alert: AlertCircleIcon,
  replay: ReplayIcon,
  back: Undo02Icon,
  forward: Redo02Icon,
  fastForward: FastForwardIcon,
} satisfies Record<string, IconData>;

export type IconName = keyof typeof ICONS;

// Transport glyphs read better solid on top of video.
const FILLED = new Set<IconName>(["play", "pause", "fastForward"]);

export const Icon = ({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    {(ICONS[name] as IconData).map(([tag, attrs]) =>
      element(
        tag,
        {
          // the data's own `key` is dropped: the renderer never sets one
          ...attrs,
          // a touch heavier than Hugeicons' 1.5 to stay legible over video
          strokeWidth: 1.8,
          ...(FILLED.has(name) && { fill: "currentColor" }),
        },
        undefined
      )
    )}
  </svg>
);
