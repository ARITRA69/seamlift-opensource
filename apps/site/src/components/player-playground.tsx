"use client";

import { Suspense, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Pause, Play, RotateCcw, Code2 } from "lucide-react";
import { SeamPlayer, type SeamPlayerHandle } from "seamplayer";
import {
  CodeLanguageSelect,
  useCodeLanguage,
} from "@/components/code-language";
import { CopyCodeButton } from "@/components/copy-code-button";
import { CodeBlock } from "@/components/code-block";
import { AccentSwitch } from "@/components/ui/accent-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionCombobox } from "@/components/option-combobox";
import { Separator } from "@/components/ui/separator";
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

function PlaygroundBody({ startTime = 0 }: { startTime?: number }) {
  const { language } = useCodeLanguage();
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
  const code = generateExample(props, config, language);
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
    <section
      aria-label="Player playground"
      className="grid scroll-mt-10 items-start gap-6 md:grid-cols-3"
    >
      <aside
        aria-label="Player options"
        className="min-w-0 rounded-lg border bg-card max-h-96 overflow-y-auto md:sticky md:top-6 md:max-h-112"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="font-semibold">Your player</h2>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Reset
          </Button>
        </div>
        <div className="space-y-5 p-5">
          <Field id="source" label="Video source">
            <OptionCombobox
              id="source"
              label="Video source"
              options={sourceOptions}
              value={config.source}
              onValueChange={(value) => update("source", value)}
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
                className="text-xs leading-relaxed text-muted-foreground"
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
        </div>
        {featureGroups.map((group) => (
          <div key={group.title} className="space-y-4 border-t p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h3>
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
                  className="flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <Label htmlFor={item.key}>{item.label}</Label>
                    <p
                      id={`${item.key}-help`}
                      className="text-xs leading-relaxed text-muted-foreground"
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
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Field id="start-time" label="Start at (seconds)">
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
          </div>
        ))}
        <div className="space-y-4 border-t p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance
          </h3>
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
                fullWidth
              />
            </Field>
          </div>
        </div>
      </aside>
      <div className="min-w-0 space-y-6 md:col-span-2">
        <section aria-labelledby="preview-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="preview-title" className="font-semibold">
              Live preview
            </h2>
            <Badge variant="outline">
              {config.source === "qualities"
                ? "3 quality levels"
                : custom
                  ? "Your source"
                  : "Single source"}
            </Badge>
          </div>
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
                <Play aria-hidden="true" />
                Play
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => player.current?.pause()}
              >
                <Pause aria-hidden="true" />
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => player.current?.seek(0)}
              >
                <RotateCcw aria-hidden="true" />
                Seek to start
              </Button>
            </div>
          )}
          {config.events && (
            <p
              role="status"
              className="rounded-lg border bg-card px-4 py-3 font-mono text-xs"
            >
              {status}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Option changes restart the preview. Viewer preferences, such as
            volume and captions, stay saved.
          </p>
        </section>
        <section
          aria-labelledby="code-title"
          className="overflow-hidden rounded-lg border bg-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <h2
              id="code-title"
              className="flex items-center gap-2 font-semibold"
            >
              <Code2
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Your React code
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <CodeLanguageSelect label="Complete React example" />
              <CopyCodeButton code={code} label="Complete React example" />
            </div>
          </div>
          <CodeBlock label="Complete React example" embedded>
            {code}
          </CodeBlock>
          <div className="space-y-2 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              The full component updates with every option. Replace demo paths
              with your media. Brand fonts are self-hosted on this site; load
              them in your app or choose System.
            </p>
            <a
              className="underline underline-offset-4"
              href="https://github.com/ARITRA69/seamlift-opensource/tree/main/apps/site/public/demo"
            >
              Get the demo assets
            </a>
          </div>
        </section>
        <section
          aria-labelledby="built-in-title"
          className="space-y-4 rounded-lg border bg-card p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="built-in-title" className="font-semibold">
              Always in the player
            </h2>
            <Badge variant="secondary">Built in</Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Playback speed, volume, mute, fullscreen, picture in picture,
            keyboard shortcuts, and touch gestures are available without extra
            props. Browser support determines fullscreen and picture in picture
            availability.
          </p>
          <Separator />
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="font-semibold">Play &amp; seek</dt>
              <dd className="text-muted-foreground">
                K / Space · ← → 5 seconds · J / L 10 seconds
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold">Frame precision</dt>
              <dd className="text-muted-foreground">
                Pause, then , or . to step at your frame rate
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold">Sound &amp; screen</dt>
              <dd className="text-muted-foreground">
                M mute · ↑ ↓ volume · C captions · F fullscreen
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-semibold">Touch</dt>
              <dd className="text-muted-foreground">
                Double tap a side to skip · hold for 2× speed
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
