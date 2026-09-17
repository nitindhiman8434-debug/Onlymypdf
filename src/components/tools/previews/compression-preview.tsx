import { ToolPreviewShell } from "@/components/tools/previews/tool-preview-shell";
import { formatFileSize } from "@/lib/utils/file";
import { cn } from "@/lib/utils/cn";

/** Strong-mode estimate only; Basic may safely return the original unchanged. */
function estimateRatio(level: "basic" | "strong", originalSize: number): number {
  if (level === "basic") return 1;
  // Tiny files rarely shrink much.
  if (originalSize > 0 && originalSize < 400_000) {
    return 0.8;
  }
  // Large textbooks / image-heavy PDFs: Strong re-encodes pages.
  if (originalSize >= 5_000_000) {
    return 0.55;
  }
  return 0.6;
}

export function CompressionLevelPreview({
  level,
  originalSize,
}: {
  level: "basic" | "strong";
  originalSize: number;
}) {
  const ratio = estimateRatio(level, originalSize);
  const estimatedSize = originalSize > 0 ? Math.round(originalSize * ratio) : 0;
  const savedPct = Math.round((1 - ratio) * 100);

  const strongPct = Math.round((1 - estimateRatio("strong", originalSize || 8_900_000)) * 100);

  return (
    <ToolPreviewShell
      stretch={false}
      hint="Basic is lossless and may return an already-optimized file. Strong can flatten text, links, forms and bookmarks."
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div
            className={cn(
              "rounded-lg border px-2 py-2",
              level === "basic"
                ? "border-pd-brand bg-pd-brand-muted"
                : "border-pd-border bg-pd-surface"
            )}
          >
            <p className="font-semibold text-pd-foreground">Basic</p>
            <p className="text-pd-muted">Lossless</p>
          </div>
          <div
            className={cn(
              "rounded-lg border px-2 py-2",
              level === "strong"
                ? "border-pd-brand bg-pd-brand-muted"
                : "border-pd-border bg-pd-surface"
            )}
          >
            <p className="font-semibold text-pd-foreground">Strong</p>
            <p className="text-pd-muted">~{strongPct}% smaller</p>
          </div>
        </div>

        {originalSize > 0 && (
          <div className="rounded-lg border border-pd-border bg-pd-surface px-3 py-2.5 text-center">
            <p className="text-xs text-pd-muted">Estimated output</p>
            <p className="mt-1 text-sm font-semibold text-pd-foreground">
              {formatFileSize(originalSize)} → {formatFileSize(estimatedSize)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-pd-brand">
              {level === "basic" ? "Lossless; actual saving measured after processing" : `~${savedPct}% smaller`}
            </p>
          </div>
        )}
      </div>
    </ToolPreviewShell>
  );
}
