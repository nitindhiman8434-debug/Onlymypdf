"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Minimize2,
  Layers,
  Scissors,
  FileDown,
  FileUp,
  ImageIcon,
  PenLine,
  PenTool,
  Mail,
  MapPin,
  Globe,
  Heart,
  ArrowUpRight,
} from "lucide-react";
import { FooterLogo } from "@/components/common/logo";
import { FILE_LIMITS, SUPPORT_EMAIL } from "@/config/constants";
import { TOOL_KEYS } from "@/components/marketing/home/home-shared";
import { useTranslation } from "@/i18n";
import { withLocalePrefix } from "@/lib/i18n/locale-path";
import { useLocaleHref } from "@/hooks/use-locale-href";
import { getExternalStatusPageUrl } from "@/lib/ops/status-page";

const toolCount = TOOL_KEYS.length;

const toolLinks = [
  { name: "Compress PDF", href: "/compress-pdf", icon: Minimize2, color: "text-orange-500" },
  { name: "Merge PDF", href: "/merge-pdf", icon: Layers, color: "text-blue-500" },
  { name: "Split PDF", href: "/split-pdf", icon: Scissors, color: "text-violet-500" },
  { name: "PDF to Word", href: "/pdf-to-word", icon: FileDown, color: "text-emerald-500" },
  { name: "Word to PDF", href: "/word-to-pdf", icon: FileUp, color: "text-cyan-500" },
  { name: "JPG to PDF", href: "/jpg-to-pdf", icon: ImageIcon, color: "text-pink-500" },
  { name: "Edit PDF", href: "/edit-pdf", icon: PenLine, color: "text-cyan-500" },
  { name: "Sign PDF", href: "/sign-pdf", icon: PenTool, color: "text-rose-500" },
];

const companyLinks = [
  { nameKey: "footer.about", href: "/about" },
  { nameKey: "footer.contact", href: "/contact" },
  { nameKey: "footer.privacy", href: "/privacy" },
  { nameKey: "footer.cookies", href: "/cookies" },
  { nameKey: "footer.terms", href: "/terms" },
  { nameKey: "footer.refund", href: "/refund" },
  { nameKey: "footer.trust", href: "/trust" },
  { nameKey: "footer.sla", href: "/sla" },
  { nameKey: "footer.faq", href: "/faq" },
  { nameKey: "nav.pricing", href: "/pricing" },
  { nameKey: "footer.allToolsLink", href: "/all-tools" },
];

export function Footer() {
  const { t } = useTranslation();
  const localeHref = useLocaleHref();
  const pathname = usePathname();
  const enHref = withLocalePrefix(pathname, "en");
  const hiHref = withLocalePrefix(pathname, "hi");
  const externalStatusUrl = getExternalStatusPageUrl();
  const statusLink = {
    nameKey: "footer.status" as const,
    href: externalStatusUrl ?? "/status",
    external: Boolean(externalStatusUrl),
  };
  const allCompanyLinks = [...companyLinks, statusLink];

  return (
    <footer className="pd-site-footer relative overflow-hidden border-t border-gray-200 bg-gradient-to-b from-gray-50 to-white">
      {/* Decorative blobs */}
      <div className="absolute -left-20 top-10 h-60 w-60 rounded-full bg-blue-400/5 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-60 w-60 rounded-full bg-violet-400/5 blur-3xl" />
      <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-rose-400/5 blur-3xl" />

      <div className="pd-container relative py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
          {/* Brand column */}
          <div className="lg:col-span-4">
            <Link
              href={localeHref("/")}
              className="pd-footer-logo-link group inline-flex items-center rounded-lg"
            >
              <FooterLogo />
            </Link>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-gray-500">
              {t("footer.description")}
            </p>

            {/* Security badge */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span className="text-[11px] font-medium text-emerald-700">
                HTTPS/TLS transfer · 2h Free retention
              </span>
            </div>

            {/* Contact info */}
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[12px] text-pd-muted">
                <Mail className="h-3.5 w-3.5" />
                <span>{SUPPORT_EMAIL}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-pd-muted">
                <MapPin className="h-3.5 w-3.5" />
                <span>India · Serving globally</span>
              </div>
            </div>
          </div>

          {/* Tools column */}
          <nav className="lg:col-span-3" aria-label="PDF tools">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pd-muted">
              <div className="h-1 w-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
              {t("footer.tools")}
            </h3>
            <ul className="mt-4 space-y-1.5">
              {toolLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={localeHref(link.href)}
                    className="group/link flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-gray-600 transition-colors hover:bg-gray-100/80 hover:text-gray-900"
                  >
                    <link.icon className={`h-3.5 w-3.5 ${link.color}`} />
                    <span>{link.name}</span>
                    <ArrowUpRight className="ml-auto h-3 w-3 text-gray-300 opacity-0 transition-opacity group-hover/link:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company column */}
          <nav className="lg:col-span-2" aria-label="Company">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pd-muted">
              <div className="h-1 w-4 rounded-full bg-gradient-to-r from-violet-500 to-purple-500" />
              {t("footer.company")}
            </h3>
            <ul className="mt-4 space-y-1.5">
              {allCompanyLinks.map((link) => (
                <li key={link.nameKey}>
                  {"external" in link && link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/link flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-gray-600 transition-colors hover:bg-gray-100/80 hover:text-gray-900"
                    >
                      <span>{t(link.nameKey)}</span>
                      <ArrowUpRight className="ml-auto h-3 w-3 text-gray-300 opacity-0 transition-opacity group-hover/link:opacity-100" />
                    </a>
                  ) : (
                    <Link
                      href={localeHref(link.href)}
                      className="group/link flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-gray-600 transition-colors hover:bg-gray-100/80 hover:text-gray-900"
                    >
                      <span>{t(link.nameKey)}</span>
                      <ArrowUpRight className="ml-auto h-3 w-3 text-gray-300 opacity-0 transition-opacity group-hover/link:opacity-100" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Language + Newsletter column */}
          <div className="lg:col-span-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pd-muted">
              <div className="h-1 w-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-500" />
              {t("footer.language")}
            </h3>
            <div className="mt-4 flex gap-2">
              <Link
                href={enHref}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <Globe className="h-3.5 w-3.5 text-blue-500" />
                English
              </Link>
              <Link
                href={hiHref}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
              >
                <Globe className="h-3.5 w-3.5 text-orange-500" />
                हिंदी
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-pd-muted">{t("footer.whyTitle")}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-lg font-extrabold text-blue-600">{toolCount}+</p>
                  <p className="text-[10px] text-pd-muted">{t("footer.toolsCount")}</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-emerald-800">{FILE_LIMITS.maxFreeUsesPerDay}</p>
                  <p className="text-[10px] text-pd-muted">Free uses/day</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-violet-800">{FILE_LIMITS.maxFreeFileSizeMB} MB</p>
                  <p className="text-[10px] text-pd-muted">Free file limit</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-rose-800">{FILE_LIMITS.fileRetentionHours}h</p>
                  <p className="text-[10px] text-pd-muted">Free retention</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-6 sm:flex-row">
          <p className="text-[13px] text-pd-muted">
            {t("footer.allRightsReserved", { year: String(new Date().getFullYear()) })}
          </p>
          <p className="flex items-center gap-1 text-[12px] text-pd-muted">
            Made with <Heart className="h-3 w-3 fill-rose-500 text-rose-500" /> in India for the world
          </p>
        </div>
      </div>
    </footer>
  );
}
