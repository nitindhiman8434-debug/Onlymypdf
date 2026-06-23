import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/home/Hero";
import { ToolCard } from "@/components/ToolCard";
import { ToolsGrid } from "@/components/home/ToolsGrid";
import { POPULAR_TOOLS } from "@/lib/tools";
import { t, type Locale } from "@/lib/i18n";

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <Header locale={locale} />
      <main>
        <Hero locale={locale} />

        <div className="mx-auto max-w-7xl px-4 py-14">
          {/* Popular quick cards (no upload box on homepage — only on tool pages) */}
          <h2 className="mb-4 text-xl font-bold text-navy">{t(locale, "home.popular")}</h2>
          <div className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {POPULAR_TOOLS.map((tool) => (
              <ToolCard key={tool.code} tool={tool} locale={locale} />
            ))}
          </div>

          {/* Full tools grid */}
          <h2 className="mb-6 text-2xl font-bold text-navy">{t(locale, "home.allTools")}</h2>
          <ToolsGrid locale={locale} />
        </div>
      </main>
      <Footer locale={locale} />
    </>
  );
}
