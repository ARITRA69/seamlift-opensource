"use client";

import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownRight, RotateCcw } from "lucide-react";
import { SeamPlayer, type SeamPlayerHandle } from "seamplayer";
import { PageLink } from "@/components/page-link";
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
    <div className="flex flex-col items-center gap-7">
      <div className="w-full max-w-lg" aria-label="Featured player demo">
        <SeamPlayer {...props} ref={player} />
      </div>
      <p className="max-w-lg text-center text-lg leading-relaxed text-muted-foreground">
        A video player for React.
        <br />
        Filmstrip seeking. Familiar controls. Yours to customize.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          onClick={() => {
            player.current?.seek(startTime);
            player.current?.play();
          }}
        >
          <RotateCcw aria-hidden="true" />
          Replay demo
        </Button>
        <Button asChild variant="ghost" size="lg">
          <PageLink href="#playground">
            Try the playground
            <ArrowDownRight aria-hidden="true" />
          </PageLink>
        </Button>
      </div>
    </div>
  );
}
