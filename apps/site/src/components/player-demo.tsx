"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SeamPlayer } from "seamplayer";
import { AccentSwitch } from "@/components/ui/accent-switch";
import { demoProps, demoThemes } from "@/lib/player-demo";

export function PlayerDemo() {
  return (
    <Suspense fallback={<PlayerDemoBody />}>
      <LinkedPlayerDemo />
    </Suspense>
  );
}

function LinkedPlayerDemo() {
  const params = useSearchParams();
  const time = Number(params.get("t"));
  const startTime = Number.isFinite(time) && time > 0 ? time : undefined;
  return <PlayerDemoBody key={startTime ?? 0} startTime={startTime} />;
}

function PlayerDemoBody({ startTime }: { startTime?: number }) {
  const [accent, setAccent] = useState<keyof typeof demoThemes>("pop");
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <AccentSwitch value={accent} onChange={setAccent} />
      <SeamPlayer
        {...demoProps}
        startTime={startTime}
        theme={demoThemes[accent]}
      />
    </div>
  );
}
