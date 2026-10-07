import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerPlayground } from "@/components/player-playground";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-5 md:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b py-6">
        <Link
          href="/"
          aria-label="Seamplayer home"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <Play className="size-5 text-primary" aria-hidden="true" />
          seamplayer
        </Link>
        <nav aria-label="Resources" className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href="https://www.npmjs.com/package/seamplayer">
              npm <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="https://github.com/ARITRA69/seamplayer">
              GitHub <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </nav>
      </header>
      <main className="pb-12">
        <section
          className="flex flex-wrap items-end justify-between gap-6 py-8"
          aria-labelledby="intro-title"
        >
          <div className="space-y-3">
            <Badge variant="secondary">Open source · React 18 &amp; 19</Badge>
            <h1
              id="intro-title"
              className="text-3xl font-semibold tracking-tighter md:text-4xl"
            >
              Make it your player.
            </h1>
            <p className="max-w-xl text-muted-foreground">
              Try every tool. Tweak the details. Take the code.
            </p>
          </div>
          <code className="rounded-lg border bg-card px-4 py-3 text-sm">
            npm install seamplayer
          </code>
        </section>
        <PlayerPlayground />
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t py-7 text-sm text-muted-foreground">
        <p>Built by Seamlift. MIT licensed.</p>
        <a
          href="https://github.com/ARITRA69/seamplayer/blob/main/packages/seamplayer/README.md"
          className="underline-offset-4 hover:underline"
        >
          API reference
        </a>
      </footer>
    </div>
  );
}
