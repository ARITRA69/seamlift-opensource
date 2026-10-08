import type { MetadataRoute } from "next";
import { projects, siteUrl } from "@/lib/docs";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = projects.flatMap((project) =>
    project.sections.flatMap((section) => section.pages)
  );
  return [
    { url: siteUrl, priority: 1 },
    ...pages.map((page) => ({
      url: `${siteUrl}${page.href}`,
      priority: page.href.split("/").length === 2 ? 0.9 : 0.7,
    })),
  ];
}
