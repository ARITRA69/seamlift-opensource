import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { SeamThumbnails } from "./types";
import { clamp, formatTime, spriteAt } from "./utils";

// Open strip height in px: keep in step with .sp-strip[data-open] in the CSS.
const STRIP_HEIGHT = 48;
// Magnified frame width in px: keep in step with .sp-loupe.
const LOUPE_WIDTH = 176;

/**
 * The seek bar. With thumbnails it opens into a strip of the video's real
 * frames when the pointer comes near, with the frame under the pointer
 * magnified above it; without, it thickens and shows the time. Drag
 * anywhere to scrub; arrows step 1s (5s with Shift).
 */
export const Timeline = ({
  duration,
  currentTime,
  thumbnails,
  buffered,
  marks,
  onSeek,
  onScrubChange,
}: {
  duration: number;
  currentTime: number;
  thumbnails?: SeamThumbnails;
  buffered: { start: number; end: number }[];
  /** chapter starts: the bar splits into segments there */
  marks: number[];
  onSeek: (time: number) => void;
  onScrubChange: (scrubbing: boolean) => void;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [near, setNear] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width ?? 0)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const active = near || scrubbing;
  const open = active && !!thumbnails;
  const pct = (t: number) =>
    duration > 0 ? `${clamp(t / duration, 0, 1) * 100}%` : "0%";
  const xToTime = (x: number) =>
    width > 0 ? clamp(x / width, 0, 1) * duration : 0;
  const pointerX = (e: PointerEvent<HTMLDivElement>) =>
    clamp(e.clientX - e.currentTarget.getBoundingClientRect().left, 0, width);

  const tileWidth =
    STRIP_HEIGHT * (thumbnails ? thumbnails.width / thumbnails.height : 16 / 9);
  const tiles = thumbnails && width > 0 ? Math.ceil(width / tileWidth) : 0;

  const hoverTime = hoverX === null ? null : xToTime(hoverX);
  const loupeWidth = thumbnails ? LOUPE_WIDTH : 56;
  const loupeLeft =
    hoverX === null
      ? 0
      : clamp(hoverX, loupeWidth / 2, Math.max(width - loupeWidth / 2, 0));

  const endScrub = (e: PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setScrubbing(false);
    onScrubChange(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 5 : 1;
    const next =
      e.key === "ArrowLeft"
        ? currentTime - step
        : e.key === "ArrowRight"
          ? currentTime + step
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? duration
              : null;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    onSeek(clamp(next, 0, duration));
  };

  return (
    <div
      ref={rootRef}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      className="sp-timeline"
      data-active={active || undefined}
      data-open={open || undefined}
      onFocus={() => setNear(true)}
      onBlur={() => setNear(false)}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setNear(true)}
      onPointerLeave={() => {
        setNear(false);
        if (!scrubbing) setHoverX(null);
      }}
      onPointerMove={(e) => {
        const x = pointerX(e);
        setHoverX(x);
        if (scrubbing) onSeek(xToTime(x));
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setScrubbing(true);
        onScrubChange(true);
        const x = pointerX(e);
        setHoverX(x);
        onSeek(xToTime(x));
      }}
      onPointerUp={endScrub}
      onPointerCancel={endScrub}
      style={
        {
          "--sp-played": pct(currentTime),
          "--sp-hx": `${hoverX ?? 0}px`,
          "--sp-loupe": `${loupeLeft}px`,
        } as CSSProperties
      }
    >
      <div className="sp-strip">
        {thumbnails && tiles > 0 && (
          <div className="sp-tiles">
            {Array.from({ length: tiles }, (_, i) => (
              <div
                key={i}
                className="sp-tile"
                style={{
                  width: tileWidth,
                  ...spriteAt(thumbnails, xToTime((i + 0.5) * tileWidth)),
                }}
              />
            ))}
          </div>
        )}

        {buffered.map((b) => (
          <span
            key={`${b.start}-${b.end}`}
            className="sp-buffered"
            style={{
              left: pct(b.start),
              width: `calc(${pct(b.end)} - ${pct(b.start)})`,
            }}
          />
        ))}

        <span className="sp-unplayed" />
        <span className="sp-played" />

        {marks
          .filter((m) => m > 0 && m < duration)
          .map((m) => (
            <span key={m} className="sp-mark" style={{ left: pct(m) }} />
          ))}

        <span className="sp-playhead" />
        {active && hoverX !== null && <span className="sp-hoverline" />}
      </div>

      {active && hoverTime !== null && (
        <div className="sp-loupe" data-frame={thumbnails ? true : undefined}>
          {thumbnails && (
            <div
              className="sp-loupe-frame"
              style={{
                aspectRatio: `${thumbnails.width} / ${thumbnails.height}`,
                ...spriteAt(thumbnails, hoverTime),
              }}
            />
          )}
          <span className="sp-loupe-time">{formatTime(hoverTime)}</span>
        </div>
      )}
    </div>
  );
};
