export interface MergeFileItem {
  id: string;
  file: File;
  thumbUrl?: string;
  sessionId?: string;
  pageCount: number;
  loadingThumb: boolean;
  /** Password used to unlock this file for preview/export. */
  password?: string;
  /** User closed the password dialog — show unlock affordance instead of auto-prompting. */
  passwordSkipped?: boolean;
}

export type MergePageSlot =
  | {
      id: string;
      kind: "page";
      fileItemId: string;
      pageNum: number;
      fileName: string;
      sessionId: string;
      file: File;
    }
  | { id: string; kind: "blank" };

import { mergeItemIdForFile } from "@/components/tools/merge-pdf/merge-pdf-preview";

export function createMergeFileItem(file: File): MergeFileItem {
  return {
    id: mergeItemIdForFile(file),
    file,
    pageCount: 0,
    loadingThumb: true,
  };
}

export function duplicateMergeFileItem(item: MergeFileItem): MergeFileItem {
  return {
    id: `merge-${crypto.randomUUID()}`,
    file: item.file,
    thumbUrl: item.thumbUrl,
    sessionId: item.sessionId,
    pageCount: item.pageCount,
    loadingThumb: false,
    password: item.password,
    passwordSkipped: item.passwordSkipped,
  };
}

export function buildPageSlotsFromItems(items: MergeFileItem[]): MergePageSlot[] {
  const slots: MergePageSlot[] = [];
  for (const item of items) {
    if (!item.sessionId || item.pageCount <= 0) continue;
    for (let p = 1; p <= item.pageCount; p++) {
      slots.push({
        id: `${item.id}-p${p}`,
        kind: "page",
        fileItemId: item.id,
        pageNum: p,
        fileName: item.file.name,
        sessionId: item.sessionId,
        file: item.file,
      });
    }
  }
  return slots;
}

export function mergePageSlotThumb(slot: MergePageSlot): string | undefined {
  if (slot.kind === "blank") return undefined;
  return `/api/tools/pdf-thumb?session=${encodeURIComponent(slot.sessionId)}&page=${slot.pageNum}`;
}

export function duplicatePageSlot(slot: MergePageSlot): MergePageSlot {
  if (slot.kind === "blank") {
    return { id: `blank-${crypto.randomUUID()}`, kind: "blank" };
  }
  return {
    ...slot,
    id: `${slot.fileItemId}-p${slot.pageNum}-dup-${crypto.randomUUID().slice(0, 8)}`,
  };
}

export function pageSlotsToComposeSlots(
  slots: MergePageSlot[],
  mainFileItemId: string
): Array<
  | { kind: "original"; page: number }
  | { kind: "blank" }
  | { kind: "imported"; sessionId: string; page: number }
> {
  return slots.map((slot) => {
    if (slot.kind === "blank") return { kind: "blank" as const };
    if (slot.fileItemId === mainFileItemId) {
      return { kind: "original" as const, page: slot.pageNum };
    }
    return {
      kind: "imported" as const,
      sessionId: slot.sessionId,
      page: slot.pageNum,
    };
  });
}

export function findMainFileItemId(slots: MergePageSlot[]): string | null {
  const page = slots.find((s): s is MergePageSlot & { kind: "page" } => s.kind === "page");
  return page?.fileItemId ?? null;
}
