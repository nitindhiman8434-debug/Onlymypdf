import { ToolCard } from "@/components/ToolCard";
import { CATEGORIES, toolsByCategory } from "@/lib/tools";
import { pick, type Locale } from "@/lib/i18n";

/** Full tools grid, grouped by category (homepage + /tools page). */
export function ToolsGrid({ locale }: { locale: Locale }) {
  return (
    <div className="space-y-12">
      {CATEGORIES.map((cat) => {
        const tools = toolsByCategory(cat.key);
        if (tools.length === 0) return null;
        return (
          <section key={cat.key} id={cat.key}>
            <h2 className="mb-4 text-xl font-bold text-navy">{pick(locale, cat.label)}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tools.map((tool) => (
                <ToolCard key={tool.code} tool={tool} locale={locale} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
