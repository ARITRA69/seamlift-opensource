import type { Metadata } from "next";

export const siteUrl = "https://opensource.seamlift.com";

export type DocsPage = {
  title: string;
  href: string;
  description: string;
};

export type DocsProject = {
  name: string;
  summary: string;
  description: string;
  href: string;
  github: string;
  npm: string;
  /** Top bar links; the first is the docs home. */
  links: { title: string; href: string }[];
  /** Sidebar groups, in reading order. Prev and next follow this order. */
  sections: { title: string; pages: DocsPage[] }[];
};

export const seamplayer: DocsProject = {
  name: "seamplayer",
  summary: "A video player for every web framework",
  description:
    "Poster-first playback, a filmstrip timeline, chapters, captions, quality switching, downloads, and the shortcuts people already know.",
  href: "/seamplayer",
  github:
    "https://github.com/ARITRA69/seamlift-opensource/tree/main/packages/seamplayer",
  npm: "https://www.npmjs.com/package/seamplayer",
  links: [
    { title: "Docs", href: "/seamplayer" },
    { title: "Playground", href: "/seamplayer/playground" },
    { title: "Showcase", href: "/seamplayer/showcase" },
    { title: "Changelog", href: "/seamplayer/changelog" },
  ],
  sections: [
    {
      title: "Getting started",
      pages: [
        {
          title: "Introduction",
          href: "/seamplayer",
          description:
            "A video player for React, Astro, Svelte and plain JavaScript that loads like an image and plays like the players people already know.",
        },
        {
          title: "Installation",
          href: "/seamplayer/installation",
          description:
            "Add Seamplayer to a React 18 or 19 app, including Next.js and other server-rendered frameworks.",
        },
        {
          title: "Playground",
          href: "/seamplayer/playground",
          description:
            "Switch tools on and off, change the appearance, or bring your own video. The complete React example follows every change.",
        },
        {
          title: "Showcase",
          href: "/seamplayer/showcase",
          description:
            "Seamplayer in production, and ready-made setups you can copy into your app.",
        },
      ],
    },
    {
      title: "Guides",
      pages: [
        {
          title: "Other frameworks",
          href: "/seamplayer/frameworks",
          description:
            "Astro, Svelte, Vue, plain JavaScript and Expo DOM components, powered by one framework-free player.",
        },
        {
          title: "Sources and quality",
          href: "/seamplayer/sources",
          description:
            "Play an MP4, WebM, or HLS stream, or offer the same video in several sizes.",
        },
        {
          title: "Media tools",
          href: "/seamplayer/media-tools",
          description:
            "Posters, the filmstrip seek bar, chapters, captions, downloads, links to a moment, and resume.",
        },
        {
          title: "Keyboard and touch",
          href: "/seamplayer/keyboard-and-touch",
          description:
            "The shortcuts and gestures every player gets, with nothing to configure.",
        },
        {
          title: "Styling",
          href: "/seamplayer/styling",
          description:
            "Match the player to your brand with the theme prop or CSS variables.",
        },
      ],
    },
    {
      title: "API reference",
      pages: [
        {
          title: "Props",
          href: "/seamplayer/props",
          description: "Every prop SeamPlayer accepts.",
        },
        {
          title: "React API",
          href: "/seamplayer/react-api",
          description:
            "Control playback through a ref and react to playback events.",
        },
      ],
    },
    {
      title: "Resources",
      pages: [
        {
          title: "Changelog",
          href: "/seamplayer/changelog",
          description: "What changed in each release of seamplayer.",
        },
      ],
    },
  ],
};

export const seamtranscode: DocsProject = {
  name: "seamtranscode",
  summary: "Video uploads to adaptive HLS",
  description:
    "Aligned renditions, posters, filmstrip previews, storage adapters, a CLI and a signed-webhook worker.",
  href: "/seamtranscode",
  github:
    "https://github.com/ARITRA69/seamlift-opensource/tree/main/packages/seamtranscode",
  npm: "https://www.npmjs.com/package/seamtranscode",
  links: [
    {
      title: "Docs",
      href: "/seamtranscode",
    },
    {
      title: "Compute",
      href: "/seamtranscode/compute",
    },
  ],
  sections: [
    {
      title: "Getting started",
      pages: [
        {
          title: "Introduction",
          href: "/seamtranscode",
          description:
            "From a video upload to adaptive HLS, a poster and a scrub sheet.",
        },
        {
          title: "Installation and CLI",
          href: "/seamtranscode/installation",
          description:
            "Install the package and ffmpeg, encode your first file, and preview the result.",
        },
        {
          title: "Storage and player",
          href: "/seamtranscode/storage",
          description:
            "Local files, S3 and R2, with output ready for seamplayer.",
        },
        {
          title: "Compute",
          href: "/seamtranscode/compute",
          description:
            "Run locally, in Docker or across workers with a serializable transcode plan.",
        },
        {
          title: "HTTP worker and webhooks",
          href: "/seamtranscode/server",
          description:
            "Queue jobs, poll results, cancel work and verify signed callbacks.",
        },
      ],
    },
  ],
};

export const projects = [seamplayer, seamtranscode];

export function findDocsPage(project: DocsProject, href: string) {
  const pages = project.sections.flatMap((section) => section.pages);
  const index = pages.findIndex((page) => page.href === href);
  const page = pages[index];
  if (!page) throw new Error(`${href} is not in the ${project.name} docs.`);
  return { page, previous: pages[index - 1], next: pages[index + 1] };
}

export function docsMetadata(project: DocsProject, href: string): Metadata {
  const { page } = findDocsPage(project, href);
  const isHome = href === project.href;
  return {
    title: isHome
      ? `${project.name}: ${project.summary}`
      : `${page.title} · ${project.name}`,
    description: page.description,
    alternates: { canonical: href },
  };
}
