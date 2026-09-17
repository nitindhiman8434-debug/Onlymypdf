import { describe, expect, it } from "vitest";
import {
  allExtractSlotsSelected,
  countExtractSelected,
  emptyExtractSelection,
  selectAllExtractSlots,
  toggleExtractSlot,
} from "./split-extract-selection";

describe("split-extract-selection", () => {
  const ids = ["a", "b", "c"];

  it("starts empty", () => {
    const sel = emptyExtractSelection();
    expect(countExtractSelected(sel, ids)).toBe(0);
    expect(allExtractSlotsSelected(sel, ids)).toBe(false);
  });

  it("toggles individual slots", () => {
    let sel = emptyExtractSelection();
    sel = toggleExtractSlot(sel, "b");
    expect(countExtractSelected(sel, ids)).toBe(1);
    sel = toggleExtractSlot(sel, "b");
    expect(countExtractSelected(sel, ids)).toBe(0);
  });

  it("select all then clear via toggle", () => {
    const sel = selectAllExtractSlots(ids);
    expect(allExtractSlotsSelected(sel, ids)).toBe(true);
  });
});
