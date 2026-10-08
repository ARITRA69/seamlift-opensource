import type { SeamThumbnails } from "./types";
import { clamp, formatTime, spriteAt } from "./utils";

// Open strip height in px: keep in step with .sp-strip[data-open] in the CSS.
const STRIP_HEIGHT = 48;
// Magnified frame width in px: keep in step with .sp-loupe.
const LOUPE_WIDTH = 176;

export type TimelineProps = {
  duration: number;
  currentTime: number;
  thumbnails?: SeamThumbnails;
  buffered: { start: number; end: number }[];
  /** chapter starts: the bar splits into segments there */
  marks: number[];
  onSeek: (time: number) => void;
  onScrubChange: (scrubbing: boolean) => void;
};

type TimelineState = {
  width: number;
  near: boolean;
  scrubbing: boolean;
  hoverX: number | null;
};

/**
 * The seek bar. With thumbnails it opens into a strip of the video's real
 * frames when the pointer comes near, with the frame under the pointer
 * magnified above it; without, it thickens and shows the time. Drag
 * anywhere to scrub; arrows step 1s (5s with Shift).
 */
export class Timeline {
  private state: TimelineState = {
    width: 0,
    near: false,
    scrubbing: false,
    hoverX: null,
  };
  private observer: ResizeObserver | null = null;

  constructor(private readonly invalidate: () => void) {}

  private set(next: Partial<TimelineState>) {
    Object.assign(this.state, next);
    this.invalidate();
  }

  private readonly ref = (el: HTMLDivElement | null) => {
    if (!el) return;
    this.observer?.disconnect();
    this.observer = new ResizeObserver(([entry]) =>
      this.set({ width: entry?.contentRect.width ?? 0 })
    );
    this.observer.observe(el);
  };

  dispose() {
    this.observer?.disconnect();
    this.observer = null;
  }

  view({
    duration,
    currentTime,
    thumbnails,
    buffered,
    marks,
    onSeek,
    onScrubChange,
  }: TimelineProps) {
    const { width, near, scrubbing, hoverX } = this.state;
    const active = near || scrubbing;
    const open = active && !!thumbnails;
    const pct = (t: number) =>
      duration > 0 ? `${clamp(t / duration, 0, 1) * 100}%` : "0%";
    const xToTime = (x: number) =>
      width > 0 ? clamp(x / width, 0, 1) * duration : 0;
    const pointerX = (e: PointerEvent) =>
      clamp(
        e.clientX - (e.currentTarget as Element).getBoundingClientRect().left,
        0,
        width
      );

    const tileWidth =
      STRIP_HEIGHT *
      (thumbnails ? thumbnails.width / thumbnails.height : 16 / 9);
    const tiles = thumbnails && width > 0 ? Math.ceil(width / tileWidth) : 0;

    const hoverTime = hoverX === null ? null : xToTime(hoverX);
    const loupeWidth = thumbnails ? LOUPE_WIDTH : 56;
    const loupeLeft =
      hoverX === null
        ? 0
        : clamp(hoverX, loupeWidth / 2, Math.max(width - loupeWidth / 2, 0));

    const endScrub = (e: PointerEvent) => {
      if (!this.state.scrubbing) return;
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      this.set({ scrubbing: false });
      onScrubChange(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
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
        ref={this.ref}
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
        onFocus={() => this.set({ near: true })}
        onBlur={() => this.set({ near: false })}
        onKeyDown={onKeyDown}
        onPointerEnter={() => this.set({ near: true })}
        onPointerLeave={() =>
          this.set({
            near: false,
            ...(!this.state.scrubbing && { hoverX: null }),
          })
        }
        onPointerMove={(e) => {
          const x = pointerX(e);
          this.set({ hoverX: x });
          if (this.state.scrubbing) onSeek(xToTime(x));
        }}
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          const x = pointerX(e);
          this.set({ scrubbing: true, hoverX: x });
          onScrubChange(true);
          onSeek(xToTime(x));
        }}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        style={{
          "--sp-played": pct(currentTime),
          "--sp-hx": `${hoverX ?? 0}px`,
          "--sp-loupe": `${loupeLeft}px`,
        }}
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
  }
}
