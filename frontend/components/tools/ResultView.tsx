"use client";

import { useEffect, useState } from "react";
import { Download, Share2, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { t, type Locale } from "@/lib/i18n";

/**
 * Result page: primary Download, small Share, Delete Now, auto-delete
 * countdown, try-another, and (optional) upgrade CTA.
 */
export function ResultView({
  locale,
  isServerSide,
  onReset,
  onDelete,
  expiresInSeconds = 3600,
}: {
  locale: Locale;
  isServerSide: boolean;
  onReset: () => void;
  onDelete?: () => void;
  expiresInSeconds?: number;
}) {
  const [remaining, setRemaining] = useState(expiresInSeconds);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (!isServerSide || deleted) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [isServerSide, deleted]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "OnlyMyPDF", url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
  };

  if (deleted) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-card">
        <h2 className="text-lg font-semibold text-navy">{t(locale, "result.deletedTitle")}</h2>
        <p className="mt-1 text-sm text-navy/60">{t(locale, "result.deletedBody")}</p>
        <Button className="mt-4" variant="secondary" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> {t(locale, "tool.tryAnother")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">{t(locale, "result.ready")}</h2>
        {isServerSide ? (
          <Badge kind="privacy">
            {t(locale, "result.autoDeleteIn")} {mm}:{ss}
          </Badge>
        ) : (
          <Badge kind="privacy">{t(locale, "badges.privacyBrowser")}</Badge>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="gradient" size="lg">
          <Download className="h-5 w-5" /> {t(locale, "tool.download")}
        </Button>
        <Button variant="secondary" onClick={share} aria-label={t(locale, "tool.share")}>
          <Share2 className="h-4 w-4" /> {t(locale, "tool.share")}
        </Button>
        {isServerSide && (
          <Button
            variant="ghost"
            onClick={() => {
              onDelete?.();
              setDeleted(true);
            }}
          >
            <Trash2 className="h-4 w-4" /> {t(locale, "tool.deleteNow")}
          </Button>
        )}
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> {t(locale, "tool.tryAnother")}
        </Button>
      </div>
    </div>
  );
}
