"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addExtractSlot,
  allExtractSlotsSelected,
  countExtractSelected,
  emptyExtractSelection,
  isExtractSlotSelected,
  removeExtractSlot,
  selectAllExtractSlots,
  someExtractSlotsSelected,
  toggleExtractSlot,
  type ExtractSelection,
} from "@/components/tools/split-pdf/split-extract-selection";

export interface SplitExtractSelectionApi {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  isSelected: (slotId: string) => boolean;
  toggleSlot: (slotId: string) => void;
  selectAll: (checked: boolean) => void;
  addSlot: (slotId: string) => void;
  removeSlot: (slotId: string) => void;
}

interface SplitExtractTabProps {
  visibleSlotIds: readonly string[];
  children: (api: SplitExtractSelectionApi) => ReactNode;
}

/**
 * Isolated extract selection — remount this component (via `key`) so pages
 * never start pre-selected.
 */
export function SplitExtractTab({
  visibleSlotIds,
  children,
}: SplitExtractTabProps) {
  const [selection, setSelection] = useState<ExtractSelection>(
    () => emptyExtractSelection()
  );

  useLayoutEffect(() => {
    setSelection(emptyExtractSelection());
  }, []);

  const slotsReadyRef = useRef(false);
  useLayoutEffect(() => {
    if (visibleSlotIds.length === 0) {
      slotsReadyRef.current = false;
      return;
    }
    if (!slotsReadyRef.current) {
      slotsReadyRef.current = true;
      setSelection(emptyExtractSelection());
    }
  }, [visibleSlotIds]);

  const selectedCount = useMemo(
    () => countExtractSelected(selection, visibleSlotIds),
    [selection, visibleSlotIds]
  );

  const allSelected = useMemo(
    () => allExtractSlotsSelected(selection, visibleSlotIds),
    [selection, visibleSlotIds]
  );

  const someSelected = useMemo(
    () => someExtractSlotsSelected(selection, visibleSlotIds),
    [selection, visibleSlotIds]
  );

  const isSelected = useCallback(
    (slotId: string) => isExtractSlotSelected(selection, slotId),
    [selection]
  );

  const toggleSlot = useCallback((slotId: string) => {
    setSelection((prev) => toggleExtractSlot(prev, slotId));
  }, []);

  const selectAll = useCallback(
    (checked: boolean) => {
      setSelection(
        checked ? selectAllExtractSlots(visibleSlotIds) : emptyExtractSelection()
      );
    },
    [visibleSlotIds]
  );

  const addSlot = useCallback((slotId: string) => {
    setSelection((prev) => addExtractSlot(prev, slotId));
  }, []);

  const removeSlot = useCallback((slotId: string) => {
    setSelection((prev) => removeExtractSlot(prev, slotId));
  }, []);

  const api = useMemo(
    () => ({
      selectedCount,
      allSelected,
      someSelected,
      isSelected,
      toggleSlot,
      selectAll,
      addSlot,
      removeSlot,
    }),
    [
      selectedCount,
      allSelected,
      someSelected,
      isSelected,
      toggleSlot,
      selectAll,
      addSlot,
      removeSlot,
    ]
  );

  return <>{children(api)}</>;
}
