"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

/**
 * EN | हिन्दी switch. Keeps the same page, toggling the /hi prefix.
 * English lives at the root; Hindi mirrors under /hi/ with English slugs.
 */
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname() || "/";
  const stripped = pathname.replace(/^\/hi(?=\/|$)/, "") || "/";
  const enHref = stripped;
  const hiHref = stripped === "/" ? "/hi" : `/hi${stripped}`;

  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 text-sm">
      <Link
        href={enHref}
        aria-current={locale === "en"}
        className={cn(
          "rounded-full px-2.5 py-1 transition-colors",
          locale === "en" ? "bg-navy text-white" : "text-navy/70 hover:text-navy"
        )}
      >
        EN
      </Link>
      <Link
        href={hiHref}
        aria-current={locale === "hi"}
        className={cn(
          "rounded-full px-2.5 py-1 transition-colors",
          locale === "hi" ? "bg-navy text-white" : "text-navy/70 hover:text-navy"
        )}
      >
        हिन्दी
      </Link>
    </div>
  );
}
