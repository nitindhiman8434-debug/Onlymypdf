"use client";

import { RouteError } from "@/components/common/route-error";
import { LanguageProvider } from "@/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pd-background font-sans text-pd-foreground">
        <LanguageProvider>
          <RouteError error={error} reset={reset} />
        </LanguageProvider>
      </body>
    </html>
  );
}
