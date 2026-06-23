"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { TOOLS } from "@/lib/tools";
import { localeHref, t, type Locale } from "@/lib/i18n";

/** Smart search bar for PDF tools (homepage). Filters the tool registry live. */
export function SmartSearch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return TOOLS.filter(
      (tool) =>
        tool.enabled !== false &&
        (tool.name.en.toLowerCase().includes(query) ||
          tool.name.hi.includes(query) ||
          tool.slug.includes(query))
    ).slice(0, 6);
  }, [q]);

  const go = (slug: string) => router.push(localeHref(locale, `/${slug}`));

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-card focus-within:ring-2 focus-within:ring-brand/30">
        <Search className="h-5 w-5 text-navy/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && matches[0] && go(matches[0].slug)}
          placeholder={t(locale, "hero.searchPlaceholder")}
          aria-label={t(locale, "hero.searchPlaceholder")}
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-navy/40"
        />
      </div>

      {matches.length > 0 && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white shadow-glow">
          {matches.map((tool) => (
            <li key={tool.code}>
              <button
                onClick={() => go(tool.slug)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-soft"
              >
                <span className="font-medium text-navy">{tool.name[locale]}</span>
                <span className="text-xs text-navy/50">{tool.short[locale]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!q && (
        <p className="mt-2 text-xs text-navy/50">{t(locale, "home.searchHint")}</p>
      )}
    </div>
  );
}
