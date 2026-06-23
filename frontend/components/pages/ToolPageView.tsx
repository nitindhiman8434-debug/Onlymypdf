import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ToolIcon } from "@/components/icons/ToolIcon";
import { ToolWorkspace } from "@/components/tools/ToolWorkspace";
import { relatedTools, type Tool } from "@/lib/tools";
import { localeHref, t, type Locale } from "@/lib/i18n";
import { toolJsonLd } from "@/lib/seo";

/** Default FAQ per tool (localized, also feeds FAQPage schema). */
export function toolFaq(tool: Tool, locale: Locale): { q: string; a: string }[] {
  const en = [
    { q: `Is ${tool.name.en} free to use?`, a: "Yes. Guests get free daily tasks with no signup. Pro unlocks larger files and more credits." },
    { q: "Are my files private?", a: tool.processing === "client"
      ? "Yes — this tool runs entirely in your browser. Your file is never uploaded."
      : "Yes — files are processed securely and auto-delete after 1 hour. You can also delete instantly." },
    { q: "What file size can I upload?", a: "Guests can upload up to 25 MB. Trial and Pro plans support much larger files." },
  ];
  const hi = [
    { q: `क्या ${tool.name.hi} मुफ़्त है?`, a: "हाँ। गेस्ट को बिना साइनअप रोज़ाना मुफ़्त टास्क मिलते हैं। प्रो में बड़ी फ़ाइलें और ज़्यादा क्रेडिट मिलते हैं।" },
    { q: "क्या मेरी फ़ाइलें निजी हैं?", a: tool.processing === "client"
      ? "हाँ — यह टूल पूरी तरह आपके ब्राउज़र में चलता है। आपकी फ़ाइल कभी अपलोड नहीं होती।"
      : "हाँ — फ़ाइलें सुरक्षित रूप से प्रोसेस होती हैं और 1 घंटे में ऑटो-डिलीट हो जाती हैं। आप तुरंत भी डिलीट कर सकते हैं।" },
    { q: "मैं कितनी बड़ी फ़ाइल अपलोड कर सकता हूँ?", a: "गेस्ट 25 MB तक अपलोड कर सकते हैं। ट्रायल और प्रो प्लान में बहुत बड़ी फ़ाइलें समर्थित हैं।" },
  ];
  return locale === "hi" ? hi : en;
}

export function ToolPageView({ tool, locale }: { tool: Tool; locale: Locale }) {
  const faq = toolFaq(tool, locale);
  const related = relatedTools(tool);
  const jsonLd = toolJsonLd(tool, locale, faq.map((f) => ({ q: f.q, a: f.a })));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header locale={locale} />
      <main className="mx-auto max-w-5xl px-4 py-12">
        {/* Heading block */}
        <div className="mb-8 flex items-start gap-4">
          <ToolIcon code={tool.code} category={tool.category} className="h-14 w-14" />
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {tool.highAccuracy && <Badge kind="accuracy">{t(locale, "badges.highAccuracy")}</Badge>}
              {tool.ai && <Badge kind="ai">{t(locale, "badges.ai")}</Badge>}
            </div>
            <h1 className="text-3xl font-bold text-navy">{tool.name[locale]}</h1>
            <p className="mt-1 text-navy/60">{tool.short[locale]}</p>
          </div>
        </div>

        {/* Legal note (e.g. Unlock PDF) */}
        {tool.legalNote && (
          <p className="mb-6 rounded-xl bg-coral/5 px-4 py-3 text-sm text-coral">
            {tool.legalNote[locale]}
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Workspace */}
          <div className="lg:col-span-2">
            <ToolWorkspace tool={tool} locale={locale} />
          </div>

          {/* Side info: credits, limits */}
          <aside className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-navy">{t(locale, "tool.creditEstimate")}</h3>
              <p className="mt-1 text-2xl font-bold text-brand">
                {tool.credits[0] === tool.credits[1]
                  ? `${tool.credits[0]}`
                  : `${tool.credits[0]}–${tool.credits[1]}`}{" "}
                <span className="text-sm font-normal text-navy/50">credits</span>
              </p>
              <p className="mt-2 text-xs text-navy/50">{t(locale, "pricing.creditsNote")}</p>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-navy">{t(locale, "badges.privacyBrowser").split(" ")[0]}</h3>
              <p className="mt-1 text-sm text-navy/60">
                {tool.processing === "client"
                  ? t(locale, "badges.privacyBrowser")
                  : t(locale, "badges.privacyServer")}
              </p>
            </Card>
          </aside>
        </div>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-bold text-navy">{t(locale, "tool.faq")}</h2>
          <div className="space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="rounded-xl border border-slate-100 bg-white p-4 shadow-card">
                <summary className="cursor-pointer font-medium text-navy">{f.q}</summary>
                <p className="mt-2 text-sm text-navy/60">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Related tools (internal linking for SEO) */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-xl font-bold text-navy">{t(locale, "tool.relatedTools")}</h2>
            <div className="flex flex-wrap gap-3">
              {related.map((r) => (
                <Link
                  key={r.code}
                  href={localeHref(locale, `/${r.slug}`)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-navy hover:border-brand hover:text-brand"
                >
                  {r.name[locale]}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer locale={locale} />
    </>
  );
}
