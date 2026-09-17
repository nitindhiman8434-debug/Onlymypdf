"use client";

import { ExtractToolbar } from "@/components/tools/split-pdf/extract-toolbar";
import { PageInsertDivider } from "@/components/tools/split-pdf/page-insert-divider";
import { SplitPageCard } from "@/components/tools/split-pdf/split-page-card";
import type { SplitExtractSelectionApi } from "@/components/tools/split-pdf/split-extract-tab";
import {
  slotLabel,
  slotThumbUrl,
  type WorkspacePageSlot,
} from "@/components/tools/split-pdf/split-page-types";

export function SplitExtractToolbarRow({
  api,
  totalCount,
  processing,
  loadingThumbs,
  separatePdfs,
  onSeparatePdfsChange,
  onFinish,
  onRotateLeft,
  onDuplicateSelected,
  onDeleteSelected,
}: {
  api: SplitExtractSelectionApi;
  totalCount: number;
  processing: boolean;
  loadingThumbs: boolean;
  separatePdfs: boolean;
  onSeparatePdfsChange: (value: boolean) => void;
  onFinish: () => void;
  onRotateLeft: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
}) {
  return (
    <ExtractToolbar
      selectedCount={api.selectedCount}
      totalCount={totalCount}
      allSelected={api.allSelected}
      someSelected={api.someSelected}
      separatePdfs={separatePdfs}
      processing={processing}
      disabled={loadingThumbs}
      onSelectAll={api.selectAll}
      onRotateLeft={onRotateLeft}
      onDuplicateSelected={onDuplicateSelected}
      onDeleteSelected={onDeleteSelected}
      onSeparatePdfsChange={onSeparatePdfsChange}
      onFinish={onFinish}
    />
  );
}

export function SplitExtractSurface({
  api,
  fileName,
  visibleSlots,
  thumbnails,
  loadingThumbs,
  rotations,
  onZoom,
  onRotateLeft,
  onDuplicateAfter,
  onRemove,
  onInsertBlankAfter,
  onInsertDocumentsAfter,
}: {
  api: SplitExtractSelectionApi;
  fileName: string;
  visibleSlots: WorkspacePageSlot[];
  thumbnails: string[];
  loadingThumbs: boolean;
  rotations: Record<string, number>;
  onZoom: (slotId: string) => void;
  onRotateLeft: (slotId: string) => void;
  onDuplicateAfter: (slotId: string) => void;
  onRemove: (slotId: string) => void;
  onInsertBlankAfter: (visibleIndex: number) => void;
  onInsertDocumentsAfter: (visibleIndex: number) => void;
}) {
  return (
    <>
      <p className="mb-3 text-center text-xs text-pd-muted">
        Click pages to select · Use checkboxes · <strong>Finish</strong> to download
      </p>
      <div className="flex flex-wrap items-start justify-center gap-x-0 gap-y-3 sm:gap-x-0">
        {visibleSlots.map((slot, index) => (
          <div key={slot.id} className="flex items-center">
            <SplitPageCard
              pageNum={index + 1}
              fileName={slotLabel(slot, fileName)}
              thumb={slotThumbUrl(slot, thumbnails)}
              loadingThumb={loadingThumbs && !slotThumbUrl(slot, thumbnails)}
              isBlank={slot.kind === "blank"}
              rotation={rotations[slot.id] ?? 0}
              mode="extract"
              selected={api.isSelected(slot.id)}
              onSelect={() => api.toggleSlot(slot.id)}
              onZoom={() => onZoom(slot.id)}
              onRotateLeft={() => onRotateLeft(slot.id)}
              onDuplicate={() => onDuplicateAfter(slot.id)}
              onRemove={() => onRemove(slot.id)}
            />
            <PageInsertDivider
              onAddBlank={() => onInsertBlankAfter(index)}
              onAddDocuments={() => onInsertDocumentsAfter(index)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
