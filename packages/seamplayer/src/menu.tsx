import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./icons";
import { Toggle } from "./controls";
import type { SeamChapter } from "./types";
import { formatTime } from "./utils";

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type CaptionSize = "sm" | "md" | "lg";

type Page = "main" | "chapters" | "speed" | "captions" | "quality" | "download";

const speedLabel = (rate: number) => (rate === 1 ? "Normal" : `${rate}×`);

// A row on the main page: what it is, what it's set to, where it goes.
const MenuRow = ({
  icon,
  label,
  value,
  mono,
  trailing,
  onClick,
}: {
  icon: IconName;
  label: ReactNode;
  value?: string;
  /** values that are metadata (sizes, times) */
  mono?: boolean;
  /** replaces the chevron; pass null for an action with nothing after */
  trailing?: ReactNode;
  onClick: () => void;
}) => (
  <button type="button" role="menuitem" className="sp-row" onClick={onClick}>
    <span className="sp-row-icon">
      <Icon name={icon} size={18} />
    </span>
    <span className="sp-row-label">{label}</span>
    {value && (
      <span className="sp-row-value" data-mono={mono || undefined}>
        {value}
      </span>
    )}
    {trailing === undefined ? (
      <span className="sp-row-chevron">
        <Icon name="chevronRight" size={16} />
      </span>
    ) : (
      trailing
    )}
  </button>
);

// One choice on a sub-page; the chosen one carries the accent tick.
const OptionRow = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    role="menuitemradio"
    aria-checked={selected}
    className="sp-row sp-option"
    onClick={onClick}
  >
    <span className="sp-option-tick">
      {selected && <Icon name="check" size={18} />}
    </span>
    <span className="sp-option-label">{children}</span>
  </button>
);

const PageHeader = ({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) => (
  <button type="button" className="sp-page-head" onClick={onBack}>
    <Icon name="chevronLeft" size={16} />
    {title}
  </button>
);

const CAPTION_SIZES: { value: CaptionSize; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

/**
 * The player's settings as a menu: each row says what it's set to and opens
 * its own page, with a way back. Actions (download, copy link) sit under a
 * hairline, shortcuts in a quiet footer.
 */
export const SettingsMenu = ({
  initialPage = "main",
  time,
  chapters,
  currentChapter,
  onChapter,
  rate,
  onRate,
  captions,
  caption,
  onCaption,
  captionSize,
  onCaptionSize,
  qualities,
  quality,
  playingHeight,
  onQuality,
  loop,
  onLoop,
  downloads,
  onDownload,
  onCopyLink,
  onShortcuts,
}: {
  initialPage?: "main" | "chapters";
  time: number;
  chapters: SeamChapter[];
  currentChapter: SeamChapter | null;
  onChapter: (chapter: SeamChapter) => void;
  rate: number;
  onRate: (rate: number) => void;
  captions: { value: string; label: string }[];
  caption: string;
  onCaption: (lang: string) => void;
  captionSize: CaptionSize;
  onCaptionSize: (size: CaptionSize) => void;
  /** heights to choose from; fewer than two hides the row */
  qualities: number[];
  quality: number;
  /** the height Auto is playing, if known */
  playingHeight: number | null;
  onQuality: (height: number) => void;
  loop: boolean;
  onLoop: (loop: boolean) => void;
  /** files to offer; more than one gets its own page */
  downloads: { label: string; detail?: string }[];
  /** with the chosen file's index; none for a custom handler */
  onDownload?: (index?: number) => void;
  onCopyLink?: () => Promise<void>;
  onShortcuts: () => void;
}) => {
  const [page, setPage] = useState<Page>(initialPage);
  const [back, setBack] = useState(false);
  const [copied, setCopied] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  // the panel's height follows the page, so moving between pages resizes it
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [page]);

  const go = (next: Page) => {
    setBack(next === "main");
    setPage(next);
  };

  const copy = async () => {
    if (!onCopyLink) return;
    try {
      await onCopyLink();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // nothing copied; the row stays as it was
    }
  };

  const captionLabel =
    captions.find((c) => c.value === caption)?.label ?? "Off";
  const qualityLabel =
    quality === -1
      ? playingHeight
        ? `Auto · ${playingHeight}p`
        : "Auto"
      : `${quality}p`;
  const sizeIndex = CAPTION_SIZES.findIndex((s) => s.value === captionSize);

  return (
    <div
      className="sp-menu"
      role="menu"
      aria-label="Settings"
      style={height === undefined ? undefined : { height: height + 8 }}
    >
      <div
        ref={pageRef}
        key={page}
        className="sp-page"
        data-back={back || undefined}
      >
        {page === "main" && (
          <>
            {chapters.length > 0 && (
              <MenuRow
                icon="chapters"
                label="Chapters"
                value={currentChapter?.title}
                onClick={() => go("chapters")}
              />
            )}
            <MenuRow
              icon="speed"
              label="Speed"
              value={speedLabel(rate)}
              onClick={() => go("speed")}
            />
            {qualities.length > 1 && (
              <MenuRow
                icon="quality"
                label="Quality"
                value={qualityLabel}
                onClick={() => go("quality")}
              />
            )}
            {captions.length > 0 && (
              <MenuRow
                icon="captions"
                label="Captions"
                value={captionLabel}
                onClick={() => go("captions")}
              />
            )}
            <MenuRow
              icon="loop"
              label="Loop"
              trailing={<Toggle on={loop} />}
              onClick={() => onLoop(!loop)}
            />

            {(onDownload || onCopyLink) && <div className="sp-divider" />}
            {onDownload &&
              (downloads.length > 1 ? (
                <MenuRow
                  icon="download"
                  label="Download"
                  value={`${downloads.length} sizes`}
                  onClick={() => go("download")}
                />
              ) : (
                <MenuRow
                  icon="download"
                  label="Download"
                  value={downloads[0]?.detail}
                  mono
                  trailing={null}
                  onClick={() => onDownload(0)}
                />
              ))}
            {onCopyLink && (
              <MenuRow
                icon={copied ? "check" : "link"}
                label={
                  <span key={copied ? "copied" : "copy"} className="sp-roll">
                    {copied ? (
                      "Link copied"
                    ) : (
                      <>
                        Copy link at{" "}
                        <span className="sp-mono">{formatTime(time)}</span>
                      </>
                    )}
                  </span>
                }
                trailing={null}
                onClick={() => void copy()}
              />
            )}

            <button type="button" className="sp-footer" onClick={onShortcuts}>
              <span>
                <Icon name="keyboard" size={14} />
                Keyboard shortcuts
              </span>
              <kbd className="sp-kbd">?</kbd>
            </button>
          </>
        )}

        {page === "chapters" && (
          <>
            <PageHeader title="Chapters" onBack={() => go("main")} />
            {chapters.map((c) => (
              <OptionRow
                key={c.start}
                selected={c === currentChapter}
                onClick={() => onChapter(c)}
              >
                <span className="sp-option-time">{formatTime(c.start)}</span>
                <span className="sp-truncate">{c.title}</span>
              </OptionRow>
            ))}
          </>
        )}

        {page === "speed" && (
          <>
            <PageHeader title="Speed" onBack={() => go("main")} />
            {SPEEDS.map((s) => (
              <OptionRow
                key={s}
                selected={s === rate}
                onClick={() => {
                  onRate(s);
                  go("main");
                }}
              >
                {speedLabel(s)}
              </OptionRow>
            ))}
          </>
        )}

        {page === "quality" && (
          <>
            <PageHeader title="Quality" onBack={() => go("main")} />
            <OptionRow
              selected={quality === -1}
              onClick={() => {
                onQuality(-1);
                go("main");
              }}
            >
              Auto
              {playingHeight && (
                <span className="sp-option-note">{playingHeight}p now</span>
              )}
            </OptionRow>
            {qualities.map((h) => (
              <OptionRow
                key={h}
                selected={quality === h}
                onClick={() => {
                  onQuality(h);
                  go("main");
                }}
              >
                {h}p
              </OptionRow>
            ))}
          </>
        )}

        {page === "captions" && (
          <>
            <PageHeader title="Captions" onBack={() => go("main")} />
            {[{ value: "off", label: "Off" }, ...captions].map((c) => (
              <OptionRow
                key={c.value}
                selected={c.value === caption}
                onClick={() => onCaption(c.value)}
              >
                {c.label}
              </OptionRow>
            ))}
            <div className="sp-divider" />
            <div className="sp-size">
              <span className="sp-size-title">Text size</span>
              <div
                role="radiogroup"
                aria-label="Caption text size"
                className="sp-seg"
                style={{ "--sp-i": sizeIndex } as CSSProperties}
              >
                <span className="sp-seg-thumb" />
                {CAPTION_SIZES.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    role="radio"
                    aria-checked={size.value === captionSize}
                    onClick={() => onCaptionSize(size.value)}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {page === "download" && onDownload && (
          <>
            <PageHeader title="Download" onBack={() => go("main")} />
            {downloads.map((d, i) => (
              <MenuRow
                key={d.label}
                icon="download"
                label={d.label}
                value={d.detail}
                mono
                trailing={null}
                onClick={() => onDownload(i)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};
