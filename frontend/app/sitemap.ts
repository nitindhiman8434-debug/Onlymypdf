import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";
import { LEGAL_SLUGS } from "@/lib/legal";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/tools", "/pricing", "/ai-tools", "/security", "/support"];
  const toolPaths = TOOLS.filter((t) => t.enabled !== false).map((t) => `/${t.slug}`);
  const legalPaths = LEGAL_SLUGS.map((s) => `/legal/${s}`);
  const all = [...staticPaths, ...toolPaths, ...legalPaths];

  // Emit both English (root) and Hindi (/hi) URLs.
  return all.flatMap((path) => [
    { url: `${SITE_URL}${path || "/"}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 },
    { url: `${SITE_URL}/hi${path}`, changeFrequency: "weekly" as const, priority: 0.6 },
  ]);
}
