import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Icon } from "./icons";
import { clamp, cx } from "./utils";

/** A round icon button on the dark bar; bigger under a finger. */
export const PlayerButton = ({
  label,
  onClick,
  pressed,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    onClick={onClick}
    className={cx("sp-btn", className)}
  >
    {children}
  </button>
);

/** A 0–1 slider: drag anywhere on it, arrows step by 5%. */
export const Slider = ({
  label,
  value,
  valueText,
  onChange,
}: {
  label: string;
  value: number;
  valueText: string;
  onChange: (value: number) => void;
}) => {
  const dragging = useRef(false);

  const valueAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return clamp((e.clientX - rect.left) / rect.width, 0, 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = (
      {
        ArrowLeft: -0.05,
        ArrowDown: -0.05,
        ArrowRight: 0.05,
        ArrowUp: 0.05,
      } as Record<string, number>
    )[e.key];
    if (step === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(clamp(value + step, 0, 1));
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={valueText}
      className="sp-slider"
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        onChange(valueAt(e));
      }}
      onPointerMove={(e) => dragging.current && onChange(valueAt(e))}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      style={{ "--sp-level": `${value * 100}%` } as CSSProperties}
    >
      <span className="sp-slider-track">
        <span className="sp-slider-fill" />
      </span>
      <span className="sp-slider-thumb" />
    </div>
  );
};

/**
 * Mute, with the volume slider sliding out on hover or focus. A finger only
 * gets mute: phones have volume buttons.
 */
export const VolumeControl = ({
  volume,
  muted,
  onVolume,
  onToggleMute,
}: {
  volume: number;
  muted: boolean;
  onVolume: (volume: number) => void;
  onToggleMute: () => void;
}) => {
  const level = muted ? 0 : volume;
  return (
    <div className="sp-volume">
      <PlayerButton
        label={muted ? "Unmute (M)" : "Mute (M)"}
        onClick={onToggleMute}
      >
        <Icon
          name={
            level === 0
              ? "volumeMute"
              : level < 0.5
                ? "volumeLow"
                : "volumeHigh"
          }
        />
      </PlayerButton>
      <div className="sp-volume-slide">
        <div className="sp-volume-slide-inner">
          <Slider
            label="Volume"
            value={level}
            valueText={`${Math.round(level * 100)}%`}
            onChange={onVolume}
          />
        </div>
      </div>
    </div>
  );
};

/** On/off in the accent colour. */
export const Toggle = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" className="sp-toggle" data-on={on || undefined} />
);

const SHORTCUTS: [string, string][] = [
  ["Space · K", "Play or pause"],
  ["← →", "Back or forward 5s"],
  ["J L", "Back or forward 10s"],
  ["↑ ↓", "Volume"],
  ["M", "Mute"],
  ["F", "Fullscreen"],
  ["C", "Captions"],
  ["0–9", "Jump to 0–90%"],
  ["< >", "Slower or faster"],
  [", .", "One frame, while paused"],
];

export const ShortcutSheet = ({ onClose }: { onClose: () => void }) => (
  <div className="sp-sheet" role="dialog" aria-label="Keyboard shortcuts">
    <div className="sp-sheet-head">
      <b>Keyboard shortcuts</b>
      <button type="button" className="sp-sheet-close" onClick={onClose}>
        Close
      </button>
    </div>
    <dl className="sp-sheet-list">
      {SHORTCUTS.map(([keys, what]) => (
        <div key={keys}>
          <dt className="sp-kbd">{keys}</dt>
          <dd>{what}</dd>
        </div>
      ))}
    </dl>
  </div>
);
