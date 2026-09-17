/** Extract-mode page selection — plain object so React state updates stay reliable. */

export type ExtractSelection = Record<string, true>;

export function emptyExtractSelection(): ExtractSelection {
  return {};
}

export function isExtractSlotSelected(
  selection: ExtractSelection,
  slotId: string
): boolean {
  return selection[slotId] === true;
}

export function countExtractSelected(
  selection: ExtractSelection,
  slotIds: readonly string[]
): number {
  let count = 0;
  for (const id of slotIds) {
    if (selection[id]) count += 1;
  }
  return count;
}

export function allExtractSlotsSelected(
  selection: ExtractSelection,
  slotIds: readonly string[]
): boolean {
  return slotIds.length > 0 && slotIds.every((id) => selection[id] === true);
}

export function someExtractSlotsSelected(
  selection: ExtractSelection,
  slotIds: readonly string[]
): boolean {
  const count = countExtractSelected(selection, slotIds);
  return count > 0 && count < slotIds.length;
}

export function toggleExtractSlot(
  selection: ExtractSelection,
  slotId: string
): ExtractSelection {
  if (selection[slotId]) {
    const next = { ...selection };
    delete next[slotId];
    return next;
  }
  return { ...selection, [slotId]: true };
}

export function selectAllExtractSlots(slotIds: readonly string[]): ExtractSelection {
  const next: ExtractSelection = {};
  for (const id of slotIds) {
    next[id] = true;
  }
  return next;
}

export function removeExtractSlot(
  selection: ExtractSelection,
  slotId: string
): ExtractSelection {
  if (!selection[slotId]) return selection;
  const next = { ...selection };
  delete next[slotId];
  return next;
}

export function addExtractSlot(
  selection: ExtractSelection,
  slotId: string
): ExtractSelection {
  return { ...selection, [slotId]: true };
}
