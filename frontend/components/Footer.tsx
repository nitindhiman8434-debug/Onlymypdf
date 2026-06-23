import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { localeHref, t, type Locale } from "@/lib/i18n";

const LEGAL = [
  ["privacy", "Privacy Policy"],
  ["terms", "Terms of Use"],
  ["refund", "Refund Policy"],
  ["fair-usage", "Fair Usage Policy"],
  ["cookie", "Cookie Policy"],
  ["auto-delete", "Auto-delete Policy"],
  ["abuse", "Abuse/Malware Policy"],
  ["data-processing", "Data Processing Policy"],
] as const;

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-20 border-t border-slate-100 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-navy/60">{t(locale, "brand.tagline")}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-navy">{t(locale, "footer.product")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-navy/60">
            <li><Link href={localeHref(locale, "/tools")}>{t(locale, "nav.tools")}</Link></li>
            <li><Link href={localeHref(locale, "/pricing")}>{t(locale, "nav.pricing")}</Link></li>
            <li><Link href={localeHref(locale, "/ai-tools")}>{t(locale, "nav.aiTools")}</Link></li>
            <li><Link href={localeHref(locale, "/security")}>{t(locale, "nav.security")}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-navy">{t(locale, "footer.company")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-navy/60">
            <li><Link href={localeHref(locale, "/support")}>{t(locale, "nav.support")}</Link></li>
            <li><a href="mailto:support@onlymypdf.com">support@onlymypdf.com</a></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-navy">{t(locale, "footer.legal")}</h3>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-navy/60">
            {LEGAL.map(([slug, label]) => (
              <li key={slug}>
                <Link href={localeHref(locale, `/legal/${slug}`)}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-navy/50">
        © {new Date().getFullYear()} {t(locale, "footer.rights")}
      </div>
    </footer>
  );
}
