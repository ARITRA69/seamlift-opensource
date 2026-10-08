"use client";

import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, ReplayIcon } from "@hugeicons/core-free-icons";
import { SeamPlayer, type SeamPlayerHandle } from "seamplayer";
import { Button } from "@/components/ui/button";
import { buildPlayerProps, defaultConfig } from "@/lib/playground";

export function HeroDemo() {
  return (
    <Suspense fallback={<HeroDemoBody />}>
      <LinkedHeroDemo />
    </Suspense>
  );
}

function LinkedHeroDemo() {
  const params = useSearchParams();
  const time = Number(params.get("t"));
  const startTime = Number.isFinite(time) && time > 0 ? Math.min(time, 29) : 0;
  return <HeroDemoBody key={startTime} startTime={startTime} />;
}

function HeroDemoBody({ startTime = 0 }: { startTime?: number }) {
  const player = useRef<SeamPlayerHandle>(null);
  const props = buildPlayerProps({
    ...defaultConfig,
    resume: false,
    startTime,
  });
  return (
    <div className="space-y-4">
      <div aria-label="Featured player demo">
        <SeamPlayer {...props} ref={player} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            player.current?.seek(startTime);
            player.current?.play();
          }}
        >
          <HugeiconsIcon icon={ReplayIcon} aria-hidden="true" />
          Replay demo
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/seamplayer/playground">
            Try the playground
            <HugeiconsIcon icon={ArrowRight02Icon} aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
