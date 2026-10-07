import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PlayerDemo } from "@/components/player-demo";

const features = [
  {
    title: "Poster first",
    detail:
      "Your page starts with an image. Video loads when someone presses play.",
  },
  {
    title: "Find the moment",
    detail:
      "A filmstrip timeline, chapters, and frame stepping make seeking precise.",
  },
  {
    title: "Feels familiar",
    detail:
      "Keyboard shortcuts, touch gestures, captions, speed, and fullscreen are built in.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 md:px-10">
      <header className="flex items-center justify-between py-7">
        <Link
          href="/"
          aria-label="Seamplayer home"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <Play className="size-5 text-primary" aria-hidden="true" />
          seamplayer
        </Link>
        <Button asChild variant="ghost" size="sm">
          <a href="https://github.com/ARITRA69/seamplayer">
            GitHub
            <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      </header>
      <main>
        <section
          className="grid items-center gap-10 py-16 lg:grid-cols-3 lg:gap-10 lg:py-24"
          aria-labelledby="intro-title"
        >
          <div className="space-y-7">
            <Badge variant="secondary">Open source · React 18 &amp; 19</Badge>
            <h1
              id="intro-title"
              className="text-5xl font-semibold leading-tight tracking-tighter md:text-6xl lg:text-5xl"
            >
              Your video.
              <br />A better player.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              A small React video player with a filmstrip timeline, chapters,
              and the controls people already know.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="https://github.com/ARITRA69/seamplayer/tree/main/packages/seamplayer#use">
                  Get started
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="https://www.npmjs.com/package/seamplayer">
                  View on npm
                </a>
              </Button>
            </div>
            <code className="inline-block rounded-lg border border-border bg-muted px-4 py-3 text-sm">
              npm install seamplayer
            </code>
          </div>
          <div className="space-y-4 lg:col-span-2">
            <PlayerDemo />
            <p className="text-center text-sm text-muted-foreground">
              Try 720p, 480p, or 360p, English captions, seven chapters, and a
              link to any moment.
            </p>
          </div>
        </section>
        <Separator />
        <section
          className="grid gap-9 py-12 md:grid-cols-3"
          aria-label="Player features"
        >
          {features.map(({ title, detail }) => (
            <article key={title} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {detail}
              </p>
            </article>
          ))}
        </section>
        <section
          className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-10"
          aria-labelledby="code-title"
        >
          <div className="space-y-2">
            <h2
              id="code-title"
              className="text-2xl font-semibold tracking-tight"
            >
              Start with three props.
            </h2>
            <p className="text-muted-foreground">
              Add chapters, captions, and thumbnails when your video needs them.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-5 text-sm leading-relaxed">
            <code>{`import { SeamPlayer } from "seamplayer";
import "seamplayer/styles.css";

<SeamPlayer
  src="/film.mp4"
  poster="/poster.jpg"
  title="Your film"
/>`}</code>
          </pre>
        </section>
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-4 py-10 text-sm text-muted-foreground">
        <p>Built by Seamlift. MIT licensed.</p>
        <a
          href="https://github.com/ARITRA69/seamplayer/blob/main/packages/seamplayer/README.md"
          className="underline-offset-4 hover:underline"
        >
          Documentation
        </a>
      </footer>
    </div>
  );
}
