import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("English-only site language", () => {
  it("ignores persisted Hindi preferences and does not offer Hindi as a UI choice", async () => {
    const getItem = vi.fn(() => JSON.stringify({ state: { language: "hi" }, version: 0 }));
    vi.stubGlobal("localStorage", { getItem });
    const { AVAILABLE_LANGUAGES, useLanguageStore } = await import("@/i18n");

    expect(AVAILABLE_LANGUAGES.map(({ code }) => code)).toEqual(["en"]);
    expect(useLanguageStore.getState().language).toBe("en");
    useLanguageStore.getState().setLanguage("hi");
    expect(useLanguageStore.getState().language).toBe("en");
    expect(getItem).not.toHaveBeenCalled();
  });

  it("keeps the legacy UI store in English too", async () => {
    const { useAppStore } = await import("@/stores/app-store");
    useAppStore.getState().setLanguage("hi");
    expect(useAppStore.getState().language).toBe("en");
  });
});
