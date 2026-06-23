import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { localeHref, t, type Locale } from "@/lib/i18n";

export function Header({ locale }: { locale: Locale }) {
  const nav = [
    { href: localeHref(locale, "/tools"), label: t(locale, "nav.tools") },
    { href: localeHref(locale, "/pricing"), label: t(locale, "nav.pricing") },
    { href: localeHref(locale, "/ai-tools"), label: t(locale, "nav.aiTools") },
    { href: localeHref(locale, "/security"), label: t(locale, "nav.security") },
    { href: localeHref(locale, "/support"), label: t(locale, "nav.support") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href={localeHref(locale, "/")} aria-label="OnlyMyPDF home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-navy/70 transition-colors hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitch locale={locale} />
          <Link
            href={localeHref(locale, "/login")}
            className="hidden text-sm font-medium text-navy/70 hover:text-navy sm:block"
          >
            {t(locale, "nav.login")}
          </Link>
          <Link href={localeHref(locale, "/pricing")}>
            <Button variant="gradient" size="sm">
              {t(locale, "nav.pro")}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
