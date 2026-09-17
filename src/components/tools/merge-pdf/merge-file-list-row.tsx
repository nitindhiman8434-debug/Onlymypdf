"use client";

import { formatFileSize } from "@/lib/utils/file";
import { MergeSelectionCheckbox } from "@/components/tools/merge-pdf/merge-selection-checkbox";
import { Copy, Lock, RotateCcw, Trash2 } from "lucide-react";
import type { MergeFileItem } from "@/components/tools/merge-pdf/merge-file-types";

interface MergeFileListRowProps {
  item: MergeFileItem;
  selected: boolean;
  rotation: number;
  unlockLabel?: string;
  onSelect: () => void;
  onRotateLeft: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUnlock?: () => void;
}

export function MergeFileListRow({
  item,
  selected,
  rotation,
  onSelect,
  onRotateLeft,
  onDuplicate,
  onRemove,
  onUnlock,
  unlockLabel = "Unlock",
}: MergeFileListRowProps) {
  const pageLabel = item.passwordSkipped
    ? "Password required"
    : item.pageCount === 1
      ? "1 page"
      : item.pageCount > 0
        ? `${item.pageCount} pages`
        : "…";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-sm ${
        selected ? "border-pd-brand/50 bg-[#eef4fc]" : "border-pd-border/80"
      }`}
    >
      <MergeSelectionCheckbox selected={selected} onToggle={onSelect} inline />

      <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-slate-200 bg-white">
        {item.thumbUrl ? (
          <img
            src={item.thumbUrl}
            alt={item.file.name}
            className="h-full w-full object-contain"
            style={{ transform: `rotate(${rotation}deg)` }}
            draggable={false}
          />
        ) : item.passwordSkipped ? (
          <div className="flex h-full flex-col items-center justify-center bg-slate-50 text-pd-brand">
            <Lock className="h-3.5 w-3.5" aria-hidden />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-pd-muted">…</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-pd-foreground">{item.file.name}</p>
        <p className="text-xs text-pd-muted">
          {pageLabel} · {formatFileSize(item.file.size)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {item.passwordSkipped && onUnlock && (
          <button
            type="button"
            onClick={onUnlock}
            className="rounded-md bg-pd-brand px-2 py-1 text-xs font-semibold text-white hover:bg-pd-brand/90"
          >
            {unlockLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onRotateLeft}
          className="rounded p-1.5 text-pd-muted hover:bg-pd-background hover:text-pd-foreground"
          title="Rotate"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded p-1.5 text-pd-muted hover:bg-pd-background hover:text-pd-foreground"
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1.5 text-pd-muted hover:bg-red-50 hover:text-red-600"
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
