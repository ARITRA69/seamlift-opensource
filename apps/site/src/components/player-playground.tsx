"use client";

import { Suspense, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Backward01Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { SeamPlayer, type SeamPlayerHandle } from "seamplayer";
import { CodeBlock } from "@/components/code-block";
import { AccentSwitch } from "@/components/ui/accent-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionCombobox } from "@/components/option-combobox";
import { Switch } from "@/components/ui/switch";
import {
  buildPlayerProps,
  defaultConfig,
  featureGroups,
  generateExample,
  validMediaUrl,
  type PlaygroundConfig,
} from "@/lib/playground";

const sourceOptions = [
  { value: "qualities", label: "Demo · 720p / 480p / 360p" },
  { value: "single", label: "Demo · single MP4" },
  { value: "custom", label: "Your MP4, WebM, or HLS URL" },
] as const;

const radiusOptions = [
  { value: "0px", label: "Square" },
  { value: "8px", label: "8px" },
  { value: "16px", label: "16px" },
  { value: "24px", label: "24px" },
] as const;

const fontOptions = [
  { value: "brand", label: "Brand" },
  { value: "system", label: "System" },
] as const;

export function PlayerPlayground() {
  return (
    <Suspense fallback={<PlaygroundBody />}>
      <LinkedPlayground />
    </Suspense>
  );
}

function LinkedPlayground() {
  const params = useSearchParams();
  const time = Number(params.get("t"));
  const startTime = Number.isFinite(time) && time > 0 ? Math.min(time, 29) : 0;
  return <PlaygroundBody key={startTime} startTime={startTime} />;
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function OptionGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 border-t p-4">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function PlaygroundBody({ startTime = 0 }: { startTime?: number }) {
  const [config, setConfig] = useState<PlaygroundConfig>({
    ...defaultConfig,
    startTime,
  });
  const [draftSource, setDraftSource] = useState(defaultConfig.customSrc);
  const [sourceError, setSourceError] = useState("");
  const [status, setStatus] = useState("Ready");
  const [revision, setRevision] = useState(0);
  const player = useRef<SeamPlayerHandle>(null);
  const props = buildPlayerProps(config);
  const custom = config.source === "custom";

  function update<K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) {
    setConfig((current) => ({ ...current, [key]: value }));
    setStatus("Ready");
  }

  function reset() {
    setConfig({ ...defaultConfig, startTime });
    setDraftSource(defaultConfig.customSrc);
    setSourceError("");
    setStatus("Ready");
    setRevision((current) => current + 1);
  }

  return (
    <div className="space-y-10">
      <section
        aria-label="Player playground"
        className="grid items-start gap-6 lg:grid-cols-3"
      >
        <div className="min-w-0 space-y-3 lg:sticky lg:top-20 lg:col-span-2">
          <SeamPlayer
            key={`${revision}:${JSON.stringify(props)}`}
            {...props}
            ref={player}
            onPlay={config.events ? () => setStatus("Playing") : undefined}
            onPause={config.events ? () => setStatus("Paused") : undefined}
            onEnded={config.events ? () => setStatus("Ended") : undefined}
            onTimeUpdate={
              config.events
                ? (time) => setStatus(`Time: ${Math.floor(time)}s`)
                : undefined
            }
            onError={
              config.events
                ? (error) =>
                    setStatus(
                      `Error: ${error?.message || "Unable to play this source"}`
                    )
                : undefined
            }
          />
          <div className="flex items-start gap-3">
            <Badge variant="outline">
              {config.source === "qualities"
                ? "3 quality levels"
                : custom
                  ? "Your source"
                  : "Single source"}
            </Badge>
            <p className="text-xs leading-5 text-muted-foreground">
              Option changes restart the preview. Viewer preferences, such as
              volume and captions, stay saved.
            </p>
          </div>
          {config.controls && (
            <div
              className="flex flex-wrap gap-2"
              aria-label="Imperative player controls"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => player.current?.play()}
              >
                <HugeiconsIcon icon={PlayIcon} aria-hidden="true" />
                Play
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => player.current?.pause()}
              >
                <HugeiconsIcon icon={PauseIcon} aria-hidden="true" />
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => player.current?.seek(0)}
              >
                <HugeiconsIcon icon={Backward01Icon} aria-hidden="true" />
                Seek to start
              </Button>
            </div>
          )}
          {config.events && (
            <p
              role="status"
              className="rounded-lg border bg-card px-4 py-3 font-mono text-code"
            >
              {status}
            </p>
          )}
        </div>
        <aside
          aria-label="Player options"
          className="min-w-0 overflow-hidden rounded-lg border bg-card lg:order-first"
        >
          <div className="flex h-10 items-center justify-between gap-3 pr-2 pl-4">
            <h2 className="text-sm font-semibold">Options</h2>
            <Button variant="ghost" size="xs" onClick={reset}>
              <HugeiconsIcon icon={RefreshIcon} aria-hidden="true" />
              Reset
            </Button>
          </div>
          <OptionGroup title="Source">
            <Field id="source" label="Video">
              <OptionCombobox
                id="source"
                label="Video source"
                options={sourceOptions}
                value={config.source}
                onValueChange={(value) => update("source", value)}
                size="default"
                fullWidth
              />
            </Field>
            {custom && (
              <div className="space-y-3">
                <Field id="custom-source" label="Media URL">
                  <Input
                    id="custom-source"
                    value={draftSource}
                    aria-invalid={!!sourceError}
                    aria-describedby="source-help"
                    onChange={(event) => {
                      setDraftSource(event.target.value);
                      setSourceError("");
                    }}
                  />
                </Field>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!validMediaUrl(draftSource)) {
                      setSourceError(
                        "Enter an HTTP(S) URL or a relative media path."
                      );
                      return;
                    }
                    update("customSrc", draftSource.trim());
                  }}
                >
                  Apply source
                </Button>
                <p
                  id="source-help"
                  role={sourceError ? "alert" : undefined}
                  className="text-xs leading-5 text-muted-foreground"
                >
                  {sourceError ||
                    "Demo metadata and moment links are disabled for your media. Add your own metadata and share page in the code. HLS downloads need your own handler."}
                </p>
              </div>
            )}
            <Field id="video-title" label="Accessible title">
              <Input
                id="video-title"
                value={config.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </Field>
          </OptionGroup>
          {featureGroups.map((group) => (
            <OptionGroup key={group.title} title={group.title}>
              {group.items.map((item) => {
                const disabled =
                  custom &&
                  [
                    "poster",
                    "thumbnails",
                    "chapters",
                    "captions",
                    "share",
                  ].includes(item.key);
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <Label htmlFor={item.key}>{item.label}</Label>
                      <p
                        id={`${item.key}-help`}
                        className="text-xs leading-5 text-muted-foreground"
                      >
                        {item.detail}
                      </p>
                    </div>
                    <Switch
                      id={item.key}
                      checked={!disabled && config[item.key]}
                      disabled={disabled}
                      aria-describedby={`${item.key}-help`}
                      onCheckedChange={(checked) => update(item.key, checked)}
                    />
                  </div>
                );
              })}
              {group.title === "Playback" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field id="start-time" label="Start at (s)">
                    <Input
                      id="start-time"
                      type="number"
                      min={0}
                      max={custom ? 86400 : 29}
                      step={1}
                      value={config.startTime}
                      onChange={(event) =>
                        update(
                          "startTime",
                          Math.min(
                            custom ? 86400 : 29,
                            Math.max(0, event.target.valueAsNumber || 0)
                          )
                        )
                      }
                    />
                  </Field>
                  <Field id="fps" label="Frame rate">
                    <Input
                      id="fps"
                      type="number"
                      min={1}
                      max={120}
                      step={1}
                      value={config.fps}
                      onChange={(event) =>
                        update(
                          "fps",
                          Math.min(
                            120,
                            Math.max(
                              1,
                              Math.round(event.target.valueAsNumber || 1)
                            )
                          )
                        )
                      }
                    />
                  </Field>
                </div>
              )}
            </OptionGroup>
          ))}
          <OptionGroup title="Appearance">
            <AccentSwitch
              value={config.accent}
              onChange={(accent) => update("accent", accent)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field id="radius" label="Corners">
                <OptionCombobox
                  id="radius"
                  label="Corners"
                  options={radiusOptions}
                  value={config.radius}
                  onValueChange={(value) => update("radius", value)}
                  size="default"
                  fullWidth
                />
              </Field>
              <Field id="font" label="Font">
                <OptionCombobox
                  id="font"
                  label="Font"
                  options={fontOptions}
                  value={config.font}
                  onValueChange={(value) => update("font", value)}
                  size="default"
                  fullWidth
                />
              </Field>
            </div>
          </OptionGroup>
        </aside>
      </section>
      <section aria-label="Generated code" className="space-y-3">
        <CodeBlock
          label="Complete React example"
          title="Your React code"
          scroll
          javascriptCode={generateExample(props, config, "javascript")}
        >
          {generateExample(props, config, "typescript")}
        </CodeBlock>
        <p className="text-xs leading-5 text-muted-foreground">
          The component updates with every option. Replace the demo paths with
          your media, and load the brand fonts in your app or choose System.{" "}
          <a
            className="font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            href="https://github.com/ARITRA69/seamlift-opensource/tree/main/apps/site/public/demo"
          >
            Get the demo assets
          </a>
          . Speed, volume, fullscreen, picture in picture, shortcuts, and
          gestures are always on; see{" "}
          <Link
            className="font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            href="/seamplayer/keyboard-and-touch"
          >
            Keyboard and touch
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
