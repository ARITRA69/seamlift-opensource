import type { ReactNode } from "react";

// A small hand-drawn set on a 24px grid, so the package needs no icon
// library. Strokes follow currentColor.

export type IconName = keyof typeof PATHS;

const filled = { fill: "currentColor", stroke: "none" } as const;

const PATHS = {
  play: (
    <path
      {...filled}
      d="M8 5.6v12.8a1 1 0 0 0 1.52.86l10.4-6.4a1 1 0 0 0 0-1.72L9.52 4.74A1 1 0 0 0 8 5.6Z"
    />
  ),
  pause: (
    <>
      <rect {...filled} x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect {...filled} x="13.5" y="5" width="4" height="14" rx="1.2" />
    </>
  ),
  volumeHigh: (
    <>
      <path
        {...filled}
        d="M3.5 9.6v4.8a1 1 0 0 0 1 1h2.7l4.2 3.5a.8.8 0 0 0 1.3-.62V5.72a.8.8 0 0 0-1.3-.62L7.2 8.6H4.5a1 1 0 0 0-1 1Z"
      />
      <path d="M15.8 9.3a3.8 3.8 0 0 1 0 5.4M18.4 6.7a7.5 7.5 0 0 1 0 10.6" />
    </>
  ),
  volumeLow: (
    <>
      <path
        {...filled}
        d="M3.5 9.6v4.8a1 1 0 0 0 1 1h2.7l4.2 3.5a.8.8 0 0 0 1.3-.62V5.72a.8.8 0 0 0-1.3-.62L7.2 8.6H4.5a1 1 0 0 0-1 1Z"
      />
      <path d="M15.8 9.3a3.8 3.8 0 0 1 0 5.4" />
    </>
  ),
  volumeMute: (
    <>
      <path
        {...filled}
        d="M3.5 9.6v4.8a1 1 0 0 0 1 1h2.7l4.2 3.5a.8.8 0 0 0 1.3-.62V5.72a.8.8 0 0 0-1.3-.62L7.2 8.6H4.5a1 1 0 0 0-1 1Z"
      />
      <path d="m16 9.5 5 5m0-5-5 5" />
    </>
  ),
  captions: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10.6 10.3a2.2 2.2 0 1 0 0 3.4M16.8 10.3a2.2 2.2 0 1 0 0 3.4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17.5 7H20M4 17h3M11.5 17H20" />
      <circle cx="15.2" cy="7" r="2.2" />
      <circle cx="9.2" cy="17" r="2.2" />
    </>
  ),
  pip: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <rect {...filled} x="12" y="11.5" width="7" height="5.5" rx="1.2" />
    </>
  ),
  fullscreen: (
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9m6 0h3.5A1.5 1.5 0 0 1 20 5.5V9m0 6v3.5a1.5 1.5 0 0 1-1.5 1.5H15m-6 0H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  ),
  fullscreenExit: (
    <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4m16 0h-3.5A1.5 1.5 0 0 1 15 7.5V4m0 16v-3.5a1.5 1.5 0 0 1 1.5-1.5H20M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20" />
  ),
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  download: <path d="M12 4v11m-5-4.5 5 5 5-5M5 20h14" />,
  link: (
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  ),
  loop: (
    <path d="m17 3 3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3m13-2v2a3 3 0 0 1-3 3H4" />
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" />
    </>
  ),
  chapters: (
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  ),
  speed: (
    <>
      <path d="M4.6 16.5a8 8 0 1 1 14.8 0" />
      <path d="m12 13 4-4" />
      <circle {...filled} cx="12" cy="13" r="1.4" />
    </>
  ),
  quality: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7.5 9.5v5m0-2.5h3.2m0-2.5v5m3-5v5h1.3a2.5 2.5 0 0 0 0-5h-1.3Z" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13m0 3.5h.01" />
    </>
  ),
  back: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" />,
  forward: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4" />,
  fastForward: (
    <path
      {...filled}
      d="M4 6.6v10.8a.8.8 0 0 0 1.24.66L12 12.8V17.4a.8.8 0 0 0 1.24.66l7.6-5.4a.8.8 0 0 0 0-1.32l-7.6-5.4A.8.8 0 0 0 12 6.6v4.6L5.24 5.94A.8.8 0 0 0 4 6.6Z"
    />
  ),
} satisfies Record<string, ReactNode>;

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
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {PATHS[name]}
  </svg>
);
