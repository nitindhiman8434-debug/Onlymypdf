"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

export function RouteError({
  error,
  reset,
  title,
  description,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    void import("@/lib/ops/sentry").then(({ captureException }) => {
      captureException(error, { digest: error.digest });
    });
  }, [error]);

  const resolvedTitle = title ?? t("errors.pageTitle");
  const resolvedDescription = description ?? t("errors.pageDescription");

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-pd-foreground">{resolvedTitle}</h1>
      <p className="mt-3 text-sm text-pd-muted">{resolvedDescription}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          {t("common.retry")}
        </Button>
        <Link href="/">
          <Button variant="outline">{t("errors.goHome")}</Button>
        </Link>
      </div>
    </div>
  );
}
