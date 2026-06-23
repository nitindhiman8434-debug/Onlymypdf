import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToolCard } from "@/components/ToolCard";
import { TOOLS } from "@/lib/tools";
import { LEGAL_DOCS } from "@/lib/legal";
import { localeHref, t, type Locale } from "@/lib/i18n";

/* ---------------- Shell ---------------- */
function Shell({ locale, title, children }: { locale: Locale; title: string; children: React.ReactNode }) {
  return (
    <>
      <Header locale={locale} />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-6 text-3xl font-bold text-navy">{title}</h1>
        {children}
      </main>
      <Footer locale={locale} />
    </>
  );
}

/* ---------------- AI Tools ---------------- */
export function AiToolsPage({ locale }: { locale: Locale }) {
  const aiTools = TOOLS.filter((tool) => tool.ai && tool.enabled !== false);
  return (
    <Shell locale={locale} title={t(locale, "nav.aiTools")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {aiTools.map((tool) => (
          <ToolCard key={tool.code} tool={tool} locale={locale} />
        ))}
      </div>
    </Shell>
  );
}

/* ---------------- Security ---------------- */
export function SecurityPage({ locale }: { locale: Locale }) {
  const points =
    locale === "hi"
      ? [
          "क्लाइंट-साइड टूल्स आपकी फ़ाइल कभी अपलोड नहीं करते।",
          "सर्वर-साइड फ़ाइलें 1 घंटे में ऑटो-डिलीट हो जाती हैं।",
          "साइन किए हुए, समय-सीमित डाउनलोड लिंक।",
          "HTTPS, CSRF सुरक्षा, रेट लिमिटिंग और हैश किए गए पासवर्ड।",
          "हम केवल मेटाडेटा रखते हैं, फ़ाइल सामग्री नहीं।",
        ]
      : [
          "Client-side tools never upload your file.",
          "Server-side files auto-delete after 1 hour.",
          "Signed, expiring download links.",
          "HTTPS, CSRF protection, rate limiting, hashed passwords.",
          "We store metadata only — never your file contents.",
        ];
  return (
    <Shell locale={locale} title={t(locale, "nav.security")}>
      <div className="mb-4 flex gap-2">
        <Badge kind="privacy">{t(locale, "hero.badges.autoDelete")}</Badge>
        <Badge kind="privacy">{t(locale, "badges.privacyBrowser")}</Badge>
      </div>
      <ul className="space-y-3">
        {points.map((p) => (
          <li key={p} className="rounded-xl border border-slate-100 bg-white p-4 shadow-card text-navy/80">
            {p}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

/* ---------------- Support / Contact ---------------- */
export function SupportPage({ locale }: { locale: Locale }) {
  return (
    <Shell locale={locale} title={t(locale, "nav.support")}>
      <p className="mb-6 text-navy/60">
        support@onlymypdf.com ·{" "}
        {locale === "hi" ? "लॉगिन करने पर डैशबोर्ड से टिकट बनाएँ।" : "Logged-in users can create tickets from the dashboard."}
      </p>
      {/* Public contact form (wired to POST /api/support/contact in Phase 2) */}
      <form className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="h-11 rounded-xl border border-slate-200 px-3" placeholder="Name" aria-label="Name" />
          <input className="h-11 rounded-xl border border-slate-200 px-3" placeholder="Email" aria-label="Email" />
        </div>
        <input className="h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="Subject" aria-label="Subject" />
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="h-11 rounded-xl border border-slate-200 px-3" placeholder="Tool name (optional)" aria-label="Tool name" />
          <input className="h-11 rounded-xl border border-slate-200 px-3" placeholder="Job ID (optional)" aria-label="Job ID" />
        </div>
        <textarea className="min-h-32 w-full rounded-xl border border-slate-200 p-3" placeholder="Message" aria-label="Message" />
        <Button variant="gradient" type="button">{t(locale, "nav.support")}</Button>
      </form>
    </Shell>
  );
}

/* ---------------- Login / Signup ---------------- */
export function LoginPage({ locale }: { locale: Locale }) {
  return (
    <Shell locale={locale} title={t(locale, "nav.login")}>
      <Card className="mx-auto max-w-md">
        <Button variant="secondary" className="w-full" type="button">
          {locale === "hi" ? "Google से जारी रखें" : "Continue with Google"}
        </Button>
        <div className="my-4 text-center text-xs text-navy/40">or</div>
        <form className="space-y-3">
          <input className="h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="Email" aria-label="Email" />
          <input type="password" className="h-11 w-full rounded-xl border border-slate-200 px-3" placeholder="Password" aria-label="Password" />
          <Button variant="gradient" className="w-full" type="button">{t(locale, "nav.login")}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-navy/50">
          {locale === "hi" ? "ईमेल सत्यापन ज़रूरी है। लॉन्च पर फ़ोन OTP नहीं।" : "Email verification required. No phone OTP at launch."}
        </p>
      </Card>
    </Shell>
  );
}

/* ---------------- Dashboard ---------------- */
export function DashboardPage({ locale }: { locale: Locale }) {
  const cards = [
    { label: locale === "hi" ? "बचे हुए क्रेडिट" : "Credits remaining", value: "2100" },
    { label: locale === "hi" ? "प्लान" : "Plan", value: "Free Pro Trial" },
    { label: locale === "hi" ? "ट्रायल दिन शेष" : "Trial days left", value: "30" },
    { label: locale === "hi" ? "आज का उपयोग" : "Usage today", value: "0 / 20" },
  ];
  return (
    <Shell locale={locale} title={locale === "hi" ? "डैशबोर्ड" : "Dashboard"}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <p className="text-sm text-navy/50">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-navy">{c.value}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <h2 className="font-semibold text-navy">{locale === "hi" ? "फ़ाइल गतिविधि (केवल मेटाडेटा)" : "File activity (metadata only)"}</h2>
        <p className="mt-1 text-sm text-navy/50">
          {locale === "hi"
            ? "फ़ाइलें 1 घंटे बाद डाउनलोड के लिए उपलब्ध नहीं रहतीं — केवल मेटाडेटा रखा जाता है।"
            : "Downloads are unavailable after 1 hour — only metadata is kept."}
        </p>
      </Card>
    </Shell>
  );
}

/* ---------------- Legal ---------------- */
export function LegalPageView({ locale, slug }: { locale: Locale; slug: string }) {
  const doc = LEGAL_DOCS[slug];
  if (!doc) return null;
  return (
    <Shell locale={locale} title={doc.title[locale]}>
      <article className="prose max-w-none text-navy/80">
        <p>{doc.body[locale]}</p>
      </article>
      <p className="mt-8 text-sm">
        <Link className="text-brand" href={localeHref(locale, "/support")}>
          {t(locale, "nav.support")} →
        </Link>
      </p>
    </Shell>
  );
}
