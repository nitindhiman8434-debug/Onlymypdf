"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Wrench,
  CreditCard,
  HelpCircle,
  Shield,
  LogOut,
  Crown,
  Settings,
  Building2,
  MessageSquareHeart,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuthContext } from "@/components/providers/auth-provider";
import { useTranslation } from "@/i18n";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard.overview" },
  { href: "/dashboard/files", icon: FolderOpen, labelKey: "dashboard.myFiles" },
  { href: "/dashboard/feedback", icon: MessageSquareHeart, labelKey: "dashboard.feedback" },
  { href: "/dashboard/settings", icon: Settings, labelKey: "dashboard.privacySettings" },
  { href: "/dashboard/security", icon: Shield, labelKey: "dashboard.security" },
  { href: "/#tools", icon: Wrench, labelKey: "dashboard.browseTools" },
  { href: "/dashboard/pricing", icon: CreditCard, labelKey: "nav.pricing" },
  { href: "/dashboard/enterprise", icon: Building2, labelKey: "dashboard.enterprise" },
  { href: "/contact", icon: HelpCircle, labelKey: "dashboard.helpSupport" },
] as const;

function UserInitials({ name, email }: { name?: string | null; email?: string | null }) {
  const source = name?.trim() || email || "U";
  const parts = source.split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : source.slice(0, 2).toUpperCase();

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pd-brand to-violet-600 text-sm font-bold text-white shadow-sm">
      {initials}
    </span>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user, profile, isPro, proSource, organizationName, signOut } = useAuthContext();

  const displayName =
    profile?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <div className="pd-dashboard min-h-[calc(100vh-var(--pd-header-height))] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)]">
      <div className="pd-container flex gap-6 py-6 lg:gap-8 lg:py-8">
        {/* Sidebar — desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-[calc(var(--pd-header-height)+1.5rem)] space-y-4">
            <nav className="rounded-2xl border border-pd-border/80 bg-pd-surface/90 p-2 shadow-sm backdrop-blur-sm" aria-label="Dashboard navigation">
              <ul className="space-y-0.5">
                {navItems.map(({ href, icon: Icon, labelKey }) => {
                  const active =
                    href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(href) && href !== "/#tools";

                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                          active
                            ? "bg-pd-brand text-white shadow-sm shadow-pd-brand/25"
                            : "text-slate-700 hover:bg-pd-brand-muted hover:text-pd-brand"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {t(labelKey)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4">
              <div className="flex items-start gap-2.5">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold text-emerald-900">
                    {t("dashboard.secureProcessing")}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-700/90">
                    {t("dashboard.autoDelete")}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-pd-border/80 bg-pd-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <UserInitials name={profile?.full_name} email={user?.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-pd-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-pd-muted">{user?.email}</p>
                  <span
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      isPro
                        ? "bg-amber-100 text-amber-800"
                        : "bg-pd-brand-muted text-pd-brand"
                    )}
                  >
                    {isPro ? (
                      <>
                        <Crown className="h-3 w-3" />{" "}
                        {proSource === "organization" && organizationName
                          ? `Pro · ${organizationName}`
                          : "Pro"}
                      </>
                    ) : (
                      t("dashboard.freePlan")
                    )}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-pd-border px-3 py-2 text-xs font-semibold text-pd-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t("nav.logout")}
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1" role="region" aria-label="Dashboard content">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Mobile nav pills shown below hero on small screens */
export function DashboardMobileNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const items = navItems.slice(0, 5);

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden scrollbar-hide">
      {items.map(({ href, icon: Icon, labelKey }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href) && href !== "/#tools";

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
              active
                ? "bg-pd-brand text-white shadow-sm"
                : "border border-pd-border bg-pd-surface text-slate-700"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
