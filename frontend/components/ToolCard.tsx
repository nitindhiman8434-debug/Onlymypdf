import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ToolIcon } from "@/components/icons/ToolIcon";
import { localeHref, t, type Locale } from "@/lib/i18n";
import type { Tool } from "@/lib/tools";

export function ToolCard({ tool, locale }: { tool: Tool; locale: Locale }) {
  return (
    <Link
      href={localeHref(locale, `/${tool.slug}`)}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow"
    >
      <div className="flex items-start justify-between">
        <ToolIcon code={tool.code} category={tool.category} />
        <div className="flex flex-col items-end gap-1">
          {tool.highAccuracy && <Badge kind="accuracy">{t(locale, "badges.highAccuracy")}</Badge>}
          {tool.ai && <Badge kind="ai">{t(locale, "badges.ai")}</Badge>}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-navy group-hover:text-brand">{tool.name[locale]}</h3>
        <p className="mt-1 text-sm text-navy/60">{tool.short[locale]}</p>
      </div>
    </Link>
  );
}
