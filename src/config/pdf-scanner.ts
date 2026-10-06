export const SCANNER_MAX_IMAGES = 10;
export const SCANNER_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ScannerFilter = "original" | "bw" | "enhanced";
export type ScannerProcessingFilter = "none" | "grayscale" | "blackwhite" | "highcontrast" | "brighten";

/** Keep existing API values compatible while accepting the workspace controls. */
export function parseScannerFilter(value: unknown): ScannerProcessingFilter | null {
  if (value === null || value === "") return "none";
  switch (value) {
    case "original": case "none": return "none";
    case "bw": case "blackwhite": return "blackwhite";
    case "enhanced": case "highcontrast": return "highcontrast";
    case "grayscale": return "grayscale";
    case "brighten": return "brighten";
    default: return null;
  }
}
