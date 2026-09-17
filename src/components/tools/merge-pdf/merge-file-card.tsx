"use client";

import { useEffect, useState } from "react";
import { Copy, Lock, RotateCcw, Trash2, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { MergeSelectionCheckbox } from "@/components/tools/merge-pdf/merge-selection-checkbox";

interface MergeFileCardProps {
  fileName: string;
  pageCount: number;
  thumb?: string;
  loadingThumb?: boolean;
  rotation: number;
  selected?: boolean;
  labelColorClass?: string;
  showCheckbox?: boolean;
  footerLabel?: string;
  showActions?: boolean;
  passwordSkipped?: boolean;
  unlockLabel?: string;
  onUnlock?: () => void;
  onSelect?: () => void;
  onZoom: () => void;
  onRotateLeft: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function MergeFileCard({
  fileName,
  pageCount,
  thumb,
  loadingThumb,
  rotation,
  selected,
  labelColorClass = "bg-violet-100 text-violet-900",
  showCheckbox = true,
  footerLabel,
  showActions = true,
  passwordSkipped = false,
  unlockLabel = "Unlock",
  onUnlock,
  onSelect,
  onZoom,
  onRotateLeft,
  onDuplicate,
  onRemove,
}: MergeFileCardProps) {
  const shortName =
    fileName.length > 20 ? `${fileName.slice(0, 17)}…` : fileName;
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const multiPage = pageCount > 1;

  useEffect(() => {
    setImageReady(false);
    setImageFailed(false);
  }, [thumb]);

  const showLoading = Boolean(thumb) && !imageReady && !imageFailed;
  const showImage = Boolean(thumb) && imageReady;
  const pageLabel = passwordSkipped
    ? "Password required"
    : footerLabel ??
      (pageCount === 1 ? "1 page" : pageCount > 0 ? `${pageCount} pages` : "…");

  return (
    <div className="group/card relative w-[136px] sm:w-[156px]">
      <div
        className={cn(
          "relative rounded-2xl px-3 pb-3 pt-3.5 transition-all",
          showCheckbox && selected
            ? "bg-[#c5daf5] shadow-sm"
            : "bg-[#eef3f9]"
        )}
      >
        {showCheckbox && onSelect && (
          <MergeSelectionCheckbox selected={Boolean(selected)} onToggle={onSelect} />
        )}

        {/* Thumbnail stack for multi-page files */}
        <div
          className={cn(
            "relative mx-auto flex justify-center",
            multiPage ? "mb-1 mt-2 h-[148px] w-[88%] sm:h-[162px]" : "mb-1 mt-1 w-full"
          )}
        >
          {multiPage && (
            <>
              <div
                className="pointer-events-none absolute bottom-1 left-2 right-4 top-3 rounded-sm border border-slate-200/80 bg-white shadow-sm"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute bottom-0.5 left-1 right-2 top-1.5 rounded-sm border border-slate-200 bg-white shadow"
                aria-hidden
              />
            </>
          )}

          <div
            className={cn(
              "relative z-10 overflow-hidden rounded-sm border bg-white shadow-md",
              multiPage
                ? "absolute bottom-0 left-0 right-0 top-4 border-slate-200"
                : "w-full rounded-lg border-slate-200"
            )}
          >
            {showActions && (
              <div className="absolute inset-x-0 top-0 z-20 flex justify-center gap-0.5 bg-pd-foreground/85 px-1 py-1 opacity-0 transition-opacity group-hover/card:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoom();
                  }}
                  className="rounded p-1 text-white hover:bg-white/20"
                  title="Zoom"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotateLeft();
                  }}
                  className="rounded p-1 text-white hover:bg-white/20"
                  title="Rotate"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  className="rounded p-1 text-white hover:bg-white/20"
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="rounded p-1 text-white hover:bg-red-400/80"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={showCheckbox ? onSelect : undefined}
              className={cn("block w-full text-left", showCheckbox && "cursor-pointer")}
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-white">
                {thumb && !imageFailed ? (
                  <>
                    {showLoading && (
                      <div className="absolute inset-0 z-0 animate-pulse bg-gradient-to-b from-slate-50 to-slate-100" />
                    )}
                    <img
                      src={thumb}
                      alt={fileName}
                      className={cn(
                        "relative z-10 h-full w-full object-contain transition-all duration-200",
                        showImage ? "opacity-100" : "opacity-0"
                      )}
                      style={{
                        transform: `rotate(${rotation}deg)${rotation % 180 !== 0 ? " scale(1.414)" : ""}`,
                        transformOrigin: "center center",
                      }}
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                      onLoad={() => setImageReady(true)}
                      onError={() => setImageFailed(true)}
                    />
                  </>
                ) : loadingThumb ? (
                  <div className="h-full w-full animate-pulse bg-gradient-to-b from-slate-50 to-slate-100" />
                ) : passwordSkipped ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-50 px-2 text-center">
                    <Lock className="h-5 w-5 text-pd-brand" aria-hidden />
                    {onUnlock && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnlock();
                        }}
                        className="rounded-md bg-pd-brand px-2 py-1 text-[10px] font-semibold text-white hover:bg-pd-brand/90"
                      >
                        {unlockLabel}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-pd-muted">…</div>
                )}
              </div>
            </button>
          </div>
        </div>

        <p
          className={cn(
            "mx-auto mt-1 max-w-full truncate rounded-md px-2 py-1 text-center text-[11px] font-medium leading-tight",
            labelColorClass
          )}
          title={fileName}
        >
          {shortName}
        </p>
        <p className="mt-1 text-center text-xs text-pd-muted">{pageLabel}</p>
      </div>
    </div>
  );
}
