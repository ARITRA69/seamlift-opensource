export const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

/** Class names, skipping the falsy ones. */
export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

const pad = (n: number) => String(n).padStart(2, "0");

/** 0:07, 4:30, 1:02:03 */
export const formatTime = (seconds: number) => {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  return h ? `${h}:${pad(m)}:${pad(rest)}` : `${m}:${pad(rest)}`;
};

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 3.1 MB */
export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1
  );
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${UNITS[unit]}`;
};

// localStorage can be missing or refuse (private windows, blocked storage);
// the player then just doesn't remember.
export const store = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // not remembered
    }
  },
};

export const isHls = (src: string) => /\.m3u8($|\?)/i.test(src);

/** The frame of a sprite sheet at a moment, as background values. */
export const spriteAt = (
  sheet: {
    url: string;
    columns: number;
    count: number;
    interval: number;
  },
  time: number
) => {
  const rows = Math.ceil(sheet.count / sheet.columns);
  const i = clamp(Math.floor(time / sheet.interval), 0, sheet.count - 1);
  const col = i % sheet.columns;
  const row = Math.floor(i / sheet.columns);
  return {
    backgroundImage: `url("${sheet.url}")`,
    backgroundSize: `${sheet.columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${sheet.columns > 1 ? (col / (sheet.columns - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`,
  };
};
