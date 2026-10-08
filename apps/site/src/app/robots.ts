import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/docs";

/** Everything is public docs, so search engines and AI crawlers alike may read it all. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
