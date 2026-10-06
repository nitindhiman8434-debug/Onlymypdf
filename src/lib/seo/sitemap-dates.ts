import { MARKETING_ROUTES } from "@/lib/seo/routes";

/** ISO dates for sitemap lastModified — update when page content materially changes. */
const MARKETING_LAST_MODIFIED: Partial<Record<(typeof MARKETING_ROUTES)[number], string>> = {
  "": "2026-06-01",
  "/all-tools": "2026-06-01",
  "/about": "2026-05-15",
  "/faq": "2026-05-20",
  "/contact": "2026-06-05",
  "/pricing": "2026-06-01",
  "/convert": "2026-05-25",
  "/privacy": "2026-06-01",
  "/cookies": "2026-06-01",
  "/terms": "2026-05-10",
  "/benchmarks": "2026-10-07",
  "/guides/scanned-pdf-to-word": "2026-10-07",
};

const TOOLS_LAST_MODIFIED = "2026-06-01";
const AEO_LAST_MODIFIED = "2026-10-07";

function resolveBuildFallback(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE ??
    process.env.SITEMAP_DEFAULT_LASTMOD ??
    "2026-06-01"
  );
}

export function sitemapLastModifiedForMarketing(path: (typeof MARKETING_ROUTES)[number]): Date {
  const iso = MARKETING_LAST_MODIFIED[path] ?? resolveBuildFallback();
  return new Date(iso);
}

export function sitemapLastModifiedForTools(): Date {
  return new Date(TOOLS_LAST_MODIFIED);
}

export function sitemapLastModifiedForAeo(): Date {
  return new Date(AEO_LAST_MODIFIED);
}
