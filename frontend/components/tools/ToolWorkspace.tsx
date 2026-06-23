"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { UploadBox } from "@/components/tools/UploadBox";
import { ProcessingView, PROCESSING_STEPS } from "@/components/tools/ProcessingView";
import { ResultView } from "@/components/tools/ResultView";
import { t, type Locale } from "@/lib/i18n";
import type { Tool } from "@/lib/tools";

type Phase = "idle" | "processing" | "done";

/**
 * Orchestrates the upload → processing → result flow on a tool page.
 *
 * NOTE: progress here is a front-end simulation so the prototype is fully
 * navigable. In Phase 2/3 this is wired to:
 *   - client-side tools  → pdf-lib / PDF.js in the browser (no upload), or
 *   - server-side tools  → POST /jobs/initiate + poll /jobs/{uuid}/status.
 */
export function ToolWorkspace({ tool, locale }: { tool: Tool; locale: Locale }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [quality, setQuality] = useState(40);

  const isServerSide = tool.processing === "server";
  // Guest default limit (25 MB). Real limits come from the user's plan via the API.
  const maxBytes = 25 * 1024 * 1024;

  const start = () => {
    setPhase("processing");
    setStepIndex(0);
    setQuality(40);
  };

  // Simulated progression through the 7 states (replaced by real status polling later).
  useEffect(() => {
    if (phase !== "processing") return;
    if (stepIndex >= PROCESSING_STEPS.length - 1) {
      const done = setTimeout(() => setPhase("done"), 700);
      return () => clearTimeout(done);
    }
    const id = setTimeout(() => {
      setStepIndex((s) => s + 1);
      setQuality((q) => Math.min(92, q + 9));
    }, 650);
    return () => clearTimeout(id);
  }, [phase, stepIndex]);

  const messages = [
    tool.highAccuracy ? "High Accuracy Mode is being used for better layout preservation." : null,
    tool.code === "pdf-to-excel" ? "Complex table detected." : null,
    tool.code === "pdf-ocr" ? "Scanned PDF detected; OCR may be required." : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {/* privacy banner */}
      <Badge kind="privacy">
        {isServerSide ? t(locale, "badges.privacyServer") : t(locale, "badges.privacyBrowser")}
      </Badge>

      {phase === "idle" && (
        <UploadBox
          locale={locale}
          validation={{ accept: tool.accept, maxBytes }}
          multiple={["merge-pdf", "jpg-to-pdf", "pdf-scanner"].includes(tool.code)}
          onFiles={start}
        />
      )}

      {phase === "processing" && (
        <ProcessingView
          locale={locale}
          stepIndex={stepIndex}
          qualityEstimate={quality}
          messages={messages}
        />
      )}

      {phase === "done" && (
        <ResultView
          locale={locale}
          isServerSide={isServerSide}
          onReset={() => setPhase("idle")}
        />
      )}
    </div>
  );
}
