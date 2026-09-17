"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  ChevronDown,
  Menu,
  X,
  Minimize2,
  Scissors,
  FileDown,
  FileUp,
  PenLine,
  PenTool,
  Lock,
  Unlock,
  Sparkles,
  ScanLine,
  ImageIcon,
  Table,
  Presentation,
  FileSpreadsheet,
  Stamp,
  RotateCw,
  Trash2,
  Code2,
} from "lucide-react";
import { useFocusTrap } from "@/lib/a11y/use-focus-trap";
import { cn } from "@/lib/utils/cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { LanguageSwitch } from "@/components/common/language-switch";
import { Logo } from "@/components/common/logo";
import { useAuthContext } from "@/components/providers/auth-provider";
import { useTranslation } from "@/i18n";
import { useLocaleHref } from "@/hooks/use-locale-href";

interface ToolLink {
  name: string;
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  iconText: string;
  hoverBg: string;
}

interface ToolCategory {
  title: string;
  titleColor: string;
  tools: ToolLink[];
}

const megaMenuCategories: ToolCategory[] = [
  {
    title: "Organize PDF",
    titleColor: "text-blue-600",
    tools: [
      { name: "Merge PDF", href: "/merge-pdf", icon: <FileText className="h-4 w-4" />, iconBg: "bg-blue-100", iconText: "text-blue-600", hoverBg: "hover:bg-blue-100/80" },
      { name: "Split PDF", href: "/split-pdf", icon: <Scissors className="h-4 w-4" />, iconBg: "bg-sky-100", iconText: "text-sky-600", hoverBg: "hover:bg-sky-100/80" },
      { name: "Rotate PDF", href: "/rotate-pdf", icon: <RotateCw className="h-4 w-4" />, iconBg: "bg-indigo-100", iconText: "text-indigo-600", hoverBg: "hover:bg-indigo-100/80" },
      { name: "Delete PDF Pages", href: "/delete-pdf", icon: <Trash2 className="h-4 w-4" />, iconBg: "bg-red-100", iconText: "text-red-500", hoverBg: "hover:bg-red-100/80" },
      { name: "Extract PDF Pages", href: "/extract-pdf", icon: <FileDown className="h-4 w-4" />, iconBg: "bg-cyan-100", iconText: "text-cyan-600", hoverBg: "hover:bg-cyan-100/80" },
    ],
  },
  {
    title: "Optimize PDF",
    titleColor: "text-emerald-600",
    tools: [
      { name: "Compress PDF", href: "/compress-pdf", icon: <Minimize2 className="h-4 w-4" />, iconBg: "bg-emerald-100", iconText: "text-emerald-600", hoverBg: "hover:bg-emerald-100/80" },
    ],
  },
  {
    title: "Convert from PDF",
    titleColor: "text-orange-600",
    tools: [
      { name: "PDF to Word", href: "/pdf-to-word", icon: <FileDown className="h-4 w-4" />, iconBg: "bg-blue-100", iconText: "text-blue-700", hoverBg: "hover:bg-blue-100/80" },
      { name: "PDF to Excel", href: "/pdf-to-excel", icon: <Table className="h-4 w-4" />, iconBg: "bg-emerald-100", iconText: "text-emerald-700", hoverBg: "hover:bg-emerald-100/80" },
      { name: "PDF to PowerPoint", href: "/pdf-to-ppt", icon: <Presentation className="h-4 w-4" />, iconBg: "bg-orange-100", iconText: "text-orange-600", hoverBg: "hover:bg-orange-100/80" },
    ],
  },
  {
    title: "Convert to PDF",
    titleColor: "text-violet-600",
    tools: [
      { name: "Word to PDF", href: "/word-to-pdf", icon: <FileUp className="h-4 w-4" />, iconBg: "bg-blue-100", iconText: "text-blue-700", hoverBg: "hover:bg-blue-100/80" },
      { name: "Excel to PDF", href: "/excel-to-pdf", icon: <FileSpreadsheet className="h-4 w-4" />, iconBg: "bg-emerald-100", iconText: "text-emerald-700", hoverBg: "hover:bg-emerald-100/80" },
      { name: "PowerPoint to PDF", href: "/ppt-to-pdf", icon: <Presentation className="h-4 w-4" />, iconBg: "bg-orange-100", iconText: "text-orange-600", hoverBg: "hover:bg-orange-100/80" },
      { name: "JPG to PDF", href: "/jpg-to-pdf", icon: <ImageIcon className="h-4 w-4" />, iconBg: "bg-pink-100", iconText: "text-pink-600", hoverBg: "hover:bg-pink-100/80" },
      { name: "HTML to PDF", href: "/html-to-pdf", icon: <Code2 className="h-4 w-4" />, iconBg: "bg-amber-100", iconText: "text-amber-700", hoverBg: "hover:bg-amber-100/80" },
      { name: "TXT to PDF", href: "/txt-to-pdf", icon: <FileText className="h-4 w-4" />, iconBg: "bg-slate-200", iconText: "text-slate-600", hoverBg: "hover:bg-slate-200/80" },
    ],
  },
  {
    title: "Edit & Sign",
    titleColor: "text-rose-600",
    tools: [
      { name: "Edit PDF", href: "/edit-pdf", icon: <PenLine className="h-4 w-4" />, iconBg: "bg-cyan-100", iconText: "text-cyan-600", hoverBg: "hover:bg-cyan-100/80" },
      { name: "Sign PDF", href: "/sign-pdf", icon: <PenTool className="h-4 w-4" />, iconBg: "bg-rose-100", iconText: "text-rose-600", hoverBg: "hover:bg-rose-100/80" },
      { name: "Add Watermark", href: "/add-watermark", icon: <Stamp className="h-4 w-4" />, iconBg: "bg-fuchsia-100", iconText: "text-fuchsia-600", hoverBg: "hover:bg-fuchsia-100/80" },
    ],
  },
  {
    title: "Security",
    titleColor: "text-amber-600",
    tools: [
      { name: "Protect PDF", href: "/protect-pdf", icon: <Lock className="h-4 w-4" />, iconBg: "bg-amber-100", iconText: "text-amber-600", hoverBg: "hover:bg-amber-100/80" },
      { name: "Unlock PDF", href: "/unlock-pdf", icon: <Unlock className="h-4 w-4" />, iconBg: "bg-lime-100", iconText: "text-lime-700", hoverBg: "hover:bg-lime-100/80" },
    ],
  },
  {
    title: "AI Tools",
    titleColor: "text-purple-600",
    tools: [
      { name: "AI PDF Summarizer", href: "/ai-pdf-summarizer", icon: <Sparkles className="h-4 w-4" />, iconBg: "bg-purple-100", iconText: "text-purple-600", hoverBg: "hover:bg-purple-100/80" },
    ],
  },
  {
    title: "Scan",
    titleColor: "text-teal-600",
    tools: [
      { name: "PDF Scanner", href: "/pdf-scanner", icon: <ScanLine className="h-4 w-4" />, iconBg: "bg-teal-100", iconText: "text-teal-600", hoverBg: "hover:bg-teal-100/80" },
    ],
  },
];

const navLinks = [
  { nameKey: "nav.compress", href: "/compress-pdf" },
  { nameKey: "nav.convert", href: "/convert" },
  { nameKey: "nav.merge", href: "/merge-pdf" },
  { nameKey: "nav.sign", href: "/sign-pdf" },
  { nameKey: "nav.aiPdf", href: "/ai-pdf-summarizer" },
];

const MEGA_MENU_TITLE_KEYS: Record<string, string> = {
  "Organize PDF": "nav.megaMenu.organize",
  "Optimize PDF": "nav.megaMenu.optimize",
  "Convert from PDF": "nav.megaMenu.convertFrom",
  "Convert to PDF": "nav.megaMenu.convertTo",
  "Edit & Sign": "nav.megaMenu.editSign",
  "Security": "nav.megaMenu.security",
  "AI Tools": "nav.megaMenu.aiTools",
  "Scan": "nav.megaMenu.scan",
};

const HOVER_COLORS: Record<string, { bg: string; shadow: string; text: string }> = {
  "text-blue-600":    { bg: "#dbeafe", shadow: "0 2px 10px rgba(59,130,246,0.18)",  text: "#2563eb" },
  "text-sky-600":     { bg: "#e0f2fe", shadow: "0 2px 10px rgba(14,165,233,0.18)",  text: "#0284c7" },
  "text-indigo-600":  { bg: "#e0e7ff", shadow: "0 2px 10px rgba(99,102,241,0.18)",  text: "#4f46e5" },
  "text-red-500":     { bg: "#fee2e2", shadow: "0 2px 10px rgba(239,68,68,0.18)",   text: "#ef4444" },
  "text-cyan-600":    { bg: "#cffafe", shadow: "0 2px 10px rgba(8,145,178,0.18)",   text: "#0891b2" },
  "text-emerald-600": { bg: "#d1fae5", shadow: "0 2px 10px rgba(5,150,105,0.18)",   text: "#059669" },
  "text-emerald-700": { bg: "#d1fae5", shadow: "0 2px 10px rgba(4,120,87,0.18)",    text: "#047857" },
  "text-blue-700":    { bg: "#dbeafe", shadow: "0 2px 10px rgba(29,78,216,0.18)",   text: "#1d4ed8" },
  "text-orange-600":  { bg: "#ffedd5", shadow: "0 2px 10px rgba(234,88,12,0.18)",   text: "#ea580c" },
  "text-violet-600":  { bg: "#ede9fe", shadow: "0 2px 10px rgba(124,58,237,0.18)",  text: "#7c3aed" },
  "text-pink-600":    { bg: "#fce7f3", shadow: "0 2px 10px rgba(219,39,119,0.18)",  text: "#db2777" },
  "text-amber-700":   { bg: "#fef3c7", shadow: "0 2px 10px rgba(180,83,9,0.18)",    text: "#b45309" },
  "text-slate-600":   { bg: "#e2e8f0", shadow: "0 2px 10px rgba(71,85,105,0.18)",   text: "#475569" },
  "text-rose-600":    { bg: "#ffe4e6", shadow: "0 2px 10px rgba(225,29,72,0.18)",   text: "#e11d48" },
  "text-fuchsia-600": { bg: "#fae8ff", shadow: "0 2px 10px rgba(192,38,211,0.18)",  text: "#c026d3" },
  "text-amber-600":   { bg: "#fef3c7", shadow: "0 2px 10px rgba(217,119,6,0.18)",   text: "#d97706" },
  "text-lime-700":    { bg: "#ecfccb", shadow: "0 2px 10px rgba(77,124,15,0.18)",   text: "#4d7c0f" },
  "text-purple-600":  { bg: "#f3e8ff", shadow: "0 2px 10px rgba(147,51,234,0.18)",  text: "#9333ea" },
  "text-teal-600":    { bg: "#ccfbf1", shadow: "0 2px 10px rgba(13,148,136,0.18)",  text: "#0d9488" },
};

function MegaToolLink({
  tool,
  onClose,
  localeHref,
}: {
  tool: ToolLink;
  onClose: () => void;
  localeHref: (path: string) => string;
}) {
  const [hovered, setHovered] = React.useState(false);
  const colors = HOVER_COLORS[tool.iconText];

  return (
    <Link
      href={localeHref(tool.href)}
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-medium text-pd-foreground transition-all duration-150"
      style={
        hovered && colors
          ? { backgroundColor: colors.bg, boxShadow: colors.shadow }
          : undefined
      }
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform duration-150",
          tool.iconBg,
          tool.iconText
        )}
        style={hovered ? { transform: "scale(1.12)" } : undefined}
      >
        {tool.icon}
      </span>
      <span
        className="truncate transition-colors duration-150"
        style={hovered && colors ? { color: colors.text, fontWeight: 600 } : undefined}
      >
        {tool.name}
      </span>
    </Link>
  );
}

function MegaCol({
  categories,
  onClose,
  t,
  localeHref,
}: {
  categories: ToolCategory[];
  onClose: () => void;
  t: (key: string) => string;
  localeHref: (path: string) => string;
}) {
  return (
    <>
      {categories.map((category) => (
        <div key={category.title}>
          <h3 className={cn("mb-2 text-[11px] font-bold uppercase tracking-wider", category.titleColor)}>
            {t(MEGA_MENU_TITLE_KEYS[category.title] ?? category.title)}
          </h3>
          <div className="space-y-0.5">
            {category.tools.map((tool) => (
              <MegaToolLink key={tool.name} tool={tool} onClose={onClose} localeHref={localeHref} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

const headerNavTextClass =
  "text-lg font-bold tracking-tight text-slate-800";

const navItemClass = cn(
  "rounded-lg px-3 py-2 transition-colors hover:bg-pd-brand-muted hover:text-pd-brand",
  headerNavTextClass
);

export function Header() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = React.useState(false);
  const megaMenuRef = React.useRef<HTMLDivElement>(null);
  const megaMenuTriggerRef = React.useRef<HTMLButtonElement>(null);
  const { user, profile, loading, signOut } = useAuthContext();
  const { t } = useTranslation();
  const localeHref = useLocaleHref();
  const isLoggedIn = !loading && !!(user || profile);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        megaMenuRef.current &&
        !megaMenuRef.current.contains(e.target as Node)
      ) {
        setMegaMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  React.useEffect(() => {
    if (!megaMenuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMegaMenuOpen(false);
        megaMenuTriggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [megaMenuOpen]);

  const mobileMenuRef = useFocusTrap(mobileOpen);

  return (
    <header className="pd-site-header sticky top-0 z-40 w-full bg-pd-surface">
      <div className="pd-header-row pd-container">
        <Logo link href={localeHref("/")} variant="wordmark" />

        <nav className="pd-nav-links hidden items-center lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.nameKey}
              href={localeHref(link.href)}
              className={navItemClass}
            >
              {t(link.nameKey)}
            </Link>
          ))}

          <div ref={megaMenuRef} className="relative">
            <button
              ref={megaMenuTriggerRef}
              type="button"
              onClick={() => setMegaMenuOpen((prev) => !prev)}
              aria-expanded={megaMenuOpen}
              aria-haspopup="true"
              aria-controls="mega-menu-panel"
              className={cn(
                "flex cursor-pointer items-center gap-1",
                navItemClass,
                megaMenuOpen
                  ? "bg-pd-brand-muted text-pd-brand"
                  : undefined
              )}
            >
              {t("nav.allTools")}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-200",
                  megaMenuOpen && "rotate-180"
                )}
              />
            </button>

            {megaMenuOpen && (
              <div
                id="mega-menu-panel"
                role="region"
                aria-label="All PDF tools"
                className="absolute left-1/2 top-full z-50 mt-2 w-[820px] max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-fade-in rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)] backdrop-blur-xl"
              >
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <MegaCol categories={[megaMenuCategories[0]]} onClose={() => setMegaMenuOpen(false)} t={t} localeHref={localeHref} />
                  </div>
                  <div>
                    <MegaCol categories={[megaMenuCategories[3]]} onClose={() => setMegaMenuOpen(false)} t={t} localeHref={localeHref} />
                  </div>
                  <div className="space-y-5">
                    <MegaCol categories={[megaMenuCategories[2]]} onClose={() => setMegaMenuOpen(false)} t={t} localeHref={localeHref} />
                    <MegaCol categories={[megaMenuCategories[1]]} onClose={() => setMegaMenuOpen(false)} t={t} localeHref={localeHref} />
                    <MegaCol categories={[megaMenuCategories[6]]} onClose={() => setMegaMenuOpen(false)} t={t} localeHref={localeHref} />
                  </div>
                  <div className="space-y-5">
                    <MegaCol categories={[megaMenuCategories[4]]} onClose={() => setMegaMenuOpen(false)} t={t} localeHref={localeHref} />
                    <MegaCol categories={[megaMenuCategories[5]]} onClose={() => setMegaMenuOpen(false)} t={t} localeHref={localeHref} />
                    <MegaCol categories={[megaMenuCategories[7]]} onClose={() => setMegaMenuOpen(false)} t={t} localeHref={localeHref} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="pd-header-cta hidden items-center gap-3 lg:flex">
          <LanguageSwitch />
          <Link
            href={localeHref("/pricing")}
            className={cn(
              headerNavTextClass,
              "transition-colors hover:text-pd-brand"
            )}
          >
            {t("nav.pricing")}
          </Link>
          {isLoggedIn ? (
            <>
              <Link
                href={localeHref("/dashboard")}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  headerNavTextClass,
                  "h-auto px-3 py-2 hover:bg-pd-brand-muted hover:text-pd-brand"
                )}
              >
                {t("nav.dashboard")}
              </Link>
              <Button
                variant="ghost"
                className={cn(headerNavTextClass, "h-auto px-3 py-2 hover:bg-pd-brand-muted hover:text-pd-brand")}
                onClick={() => signOut()}
              >
                {t("nav.logout")}
              </Button>
            </>
          ) : (
            <Link
              href={localeHref("/login")}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                headerNavTextClass,
                "h-auto px-3 py-2 hover:bg-pd-brand-muted hover:text-pd-brand"
              )}
            >
              {t("nav.login")}
            </Link>
          )}
          <Link
            href={localeHref("/pricing")}
            className={cn(buttonVariants({ size: "sm" }), "px-4 py-2.5 text-base font-bold")}
          >
            {t("nav.getPro")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="cursor-pointer rounded-lg p-2 text-pd-muted hover:bg-pd-brand-muted lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div className="pd-header-border" aria-hidden="true" />

      {/* Mobile Full-screen Overlay */}
      {mobileOpen && (
        <div
          ref={mobileMenuRef}
          className="fixed inset-0 z-50 bg-pd-surface lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
          tabIndex={-1}
        >
          <div className="pd-header-row flex items-center justify-between px-4">
            <Link
              href={localeHref("/")}
              className="pd-site-logo-link inline-flex shrink-0 items-center justify-center"
              onClick={() => setMobileOpen(false)}
            >
              <Logo variant="wordmark" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="cursor-pointer rounded-lg p-2 text-pd-muted hover:bg-pd-background"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="h-[calc(100vh-var(--pd-header-height))] overflow-y-auto px-4 py-6">
            <div className="space-y-6">
              {megaMenuCategories.map((category) => (
                <div key={category.title}>
                  <h3 className={cn("mb-2 text-xs font-bold uppercase tracking-wider", category.titleColor)}>
                    {category.title}
                  </h3>
                  <div className="space-y-1">
                    {category.tools.map((tool) => (
                      <Link
                        key={tool.name}
                        href={localeHref(tool.href)}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-pd-foreground transition-colors hover:bg-pd-background"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg shadow-sm",
                            tool.iconBg,
                            tool.iconText
                          )}
                        >
                          {tool.icon}
                        </span>
                        {tool.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3 border-t border-pd-border pt-6">
              <Link
                href={localeHref("/pricing")}
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-medium text-pd-foreground hover:bg-pd-background"
              >
                Pricing
              </Link>
              <div className="flex items-center gap-3">
                <LanguageSwitch />
              </div>
              <div className="flex gap-3 pt-2">
                {isLoggedIn ? (
                  <>
                    <Link
                      href={localeHref("/dashboard")}
                      className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
                      onClick={() => setMobileOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Button
                      variant="gradient"
                      className="flex-1"
                      onClick={() => {
                        void signOut();
                        setMobileOpen(false);
                      }}
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link
                      href={localeHref("/login")}
                      className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
                      onClick={() => setMobileOpen(false)}
                    >
                      Login
                    </Link>
                    <Link
                      href={localeHref("/pricing")}
                      className={cn(buttonVariants(), "flex-1")}
                      onClick={() => setMobileOpen(false)}
                    >
                      {t("nav.getPro")}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
