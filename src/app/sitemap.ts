import type { MetadataRoute } from "next";
import { APP_URL } from "@/config/constants";
import { ALL_PUBLIC_TOOL_SLUGS, MARKETING_ROUTES } from "@/lib/seo/routes";
import {
  sitemapLastModifiedForAeo,
  sitemapLastModifiedForMarketing,
  sitemapLastModifiedForTools,
} from "@/lib/seo/sitemap-dates";

export default function sitemap(): MetadataRoute.Sitemap {
  const marketingEntries: MetadataRoute.Sitemap = MARKETING_ROUTES.map((path) => {
    const enUrl = path === "" ? APP_URL : `${APP_URL}${path}`;
    const lastMod = sitemapLastModifiedForMarketing(path);
    const changeFrequency = path === "" ? ("daily" as const) : ("weekly" as const);
    const priority = path === "" ? 1 : 0.8;
    return { url: enUrl, lastModified: lastMod, changeFrequency, priority };
  });

  const toolLastMod = sitemapLastModifiedForTools();
  const toolEntries: MetadataRoute.Sitemap = ALL_PUBLIC_TOOL_SLUGS.map((slug) => ({
    url: `${APP_URL}/${slug}`,
    lastModified: toolLastMod,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  const aeoLastMod = sitemapLastModifiedForAeo();
  const aeoEntries: MetadataRoute.Sitemap = [
    {
      url: `${APP_URL}/llms.txt`,
      lastModified: aeoLastMod,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${APP_URL}/ai.txt`,
      lastModified: aeoLastMod,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  return [...marketingEntries, ...toolEntries, ...aeoEntries];
}
