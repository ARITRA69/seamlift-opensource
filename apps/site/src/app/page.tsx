import Link from "next/link";

import { projects } from "@/lib/docs";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-5 sm:px-8">
      <header className="pt-16 pb-12 sm:pt-24">
        <h1 className="text-2xl font-semibold tracking-tight">
          Seamlift Open Source
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The parts of Seamlift we build in the open. MIT licensed, and used in
          production by Seamlift.
        </p>
      </header>
      <main>
        <h2 className="sr-only">Projects</h2>
        <ul className="divide-y border-y">
          {projects.map((project) => (
            <li key={project.name} className="space-y-3 py-6">
              <h3 className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={project.href}
                  className="font-semibold tracking-tight underline-offset-4 hover:underline"
                >
                  {project.name}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {project.summary}
                </span>
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {project.description}
              </p>
              <div className="flex gap-5 text-sm">
                <Link
                  href={project.href}
                  className="underline underline-offset-4"
                >
                  Documentation
                </Link>
                <a
                  href={project.github}
                  className="underline underline-offset-4"
                >
                  GitHub ↗
                </a>
                <a href={project.npm} className="underline underline-offset-4">
                  npm ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <footer className="py-12 text-sm text-muted-foreground">
        Built by{" "}
        <a href="https://seamlift.com" className="underline underline-offset-4">
          Seamlift
        </a>
        .{" "}
        <a
          href="https://github.com/ARITRA69/seamlift-opensource"
          className="underline underline-offset-4"
        >
          Source on GitHub ↗
        </a>
      </footer>
    </div>
  );
}
