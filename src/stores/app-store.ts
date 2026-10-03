import { create } from "zustand";

interface AppState {
  language: "en" | "hi";
  setLanguage: (lang: "en" | "hi") => void;
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;
  showMegaMenu: boolean;
  setShowMegaMenu: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  language: "en",
  setLanguage: () => set({ language: "en" }),

  showUpgradeModal: false,
  setShowUpgradeModal: (show) => set({ showUpgradeModal: show }),

  showMobileMenu: false,
  setShowMobileMenu: (show) => set({ showMobileMenu: show }),

  showMegaMenu: false,
  setShowMegaMenu: (show) => set({ showMegaMenu: show }),
}));
