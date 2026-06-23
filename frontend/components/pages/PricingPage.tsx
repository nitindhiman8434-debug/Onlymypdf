import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Check } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export function PricingPage({ locale }: { locale: Locale }) {
  const plans = [
    {
      name: t(locale, "pricing.guest"),
      price: "₹0 / $0",
      sub: t(locale, "hero.badges.noSignup"),
      features: [
        "5 tasks / day",
        "25 MB max file",
        "1 AI summary / day",
        "5 High Accuracy samples / day",
        "1-hour auto-delete",
      ],
      cta: t(locale, "hero.ctaPrimary"),
      highlight: false,
    },
    {
      name: t(locale, "pricing.trial"),
      price: "₹0 / $0",
      sub: "30 days · no card required",
      features: [
        "20 tasks / day",
        "5 High Accuracy tasks / day",
        "Larger files than guest",
        "Email or Google login",
        "Downgrades to Free after trial",
      ],
      cta: t(locale, "pricing.choosePlan"),
      highlight: true,
    },
    {
      name: t(locale, "pricing.pro"),
      price: locale === "hi" ? "₹299 / माह · ₹2499 / वर्ष" : "₹299/mo · ₹2499/yr · $9/mo · $79/yr",
      sub: t(locale, "pricing.creditsIncluded"),
      features: [
        "2100 monthly credits",
        "Up to 500 MB files",
        "High Accuracy Beta + OCR + AI",
        "Metadata-only history",
        "No ads",
      ],
      cta: t(locale, "pricing.choosePlan"),
      highlight: false,
    },
  ];

  return (
    <>
      <Header locale={locale} />
      <main className="mx-auto max-w-6xl px-4 py-14">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-navy">{t(locale, "pricing.title")}</h1>
          <p className="mt-2 text-navy/60">{t(locale, "pricing.subtitle")}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border bg-white p-6 shadow-card ${
                plan.highlight ? "border-brand ring-2 ring-brand/20" : "border-slate-100"
              }`}
            >
              {plan.highlight && <Badge kind="accuracy" className="mb-3">Recommended</Badge>}
              <h2 className="text-lg font-semibold text-navy">{plan.name}</h2>
              <p className="mt-2 text-xl font-bold text-navy">{plan.price}</p>
              <p className="mt-1 text-sm text-navy/50">{plan.sub}</p>
              <ul className="mt-5 space-y-2 text-sm text-navy/70">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-healing" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant={plan.highlight ? "gradient" : "secondary"}>
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-navy/50">{t(locale, "pricing.creditsNote")}</p>
      </main>
      <Footer locale={locale} />
    </>
  );
}
