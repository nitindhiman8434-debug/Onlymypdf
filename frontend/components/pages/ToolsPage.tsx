import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ToolsGrid } from "@/components/home/ToolsGrid";
import { t, type Locale } from "@/lib/i18n";

export function ToolsPage({ locale }: { locale: Locale }) {
  return (
    <>
      <Header locale={locale} />
      <main className="mx-auto max-w-7xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold text-navy">{t(locale, "home.allTools")}</h1>
        <p className="mb-10 text-navy/60">{t(locale, "brand.tagline")}</p>
        <ToolsGrid locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
