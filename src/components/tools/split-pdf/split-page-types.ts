export type WorkspacePageSlot =
  | { id: string; kind: "original"; page: number }
  | { id: string; kind: "blank" }
  | {
      id: string;
      kind: "imported";
      page: number;
      fileName: string;
      sessionId: string;
    };

export function createOriginalSlots(
  pageCount: number,
  scopeKey?: string
): WorkspacePageSlot[] {
  const scope = scopeKey ? `${scopeKey}:` : "";
  return Array.from({ length: pageCount }, (_, i) => ({
    id: `${scope}orig-${i + 1}`,
    kind: "original" as const,
    page: i + 1,
  }));
}

export function slotThumbUrl(slot: WorkspacePageSlot, mainThumbs: string[]): string | undefined {
  if (slot.kind === "original") return mainThumbs[slot.page - 1];
  if (slot.kind === "imported") {
    return `/api/tools/pdf-thumb?session=${encodeURIComponent(slot.sessionId)}&page=${slot.page}`;
  }
  return undefined;
}

export function slotLabel(slot: WorkspacePageSlot, mainFileName: string): string {
  if (slot.kind === "imported") return slot.fileName;
  return mainFileName;
}

export function duplicateSlot(slot: WorkspacePageSlot): WorkspacePageSlot {
  const id = `${slot.kind}-${crypto.randomUUID()}`;
  if (slot.kind === "original") {
    return { id, kind: "original", page: slot.page };
  }
  if (slot.kind === "blank") {
    return { id, kind: "blank" };
  }
  return {
    id,
    kind: "imported",
    page: slot.page,
    fileName: slot.fileName,
    sessionId: slot.sessionId,
  };
}
