import { SCANNER_IMAGE_MIME_TYPES, SCANNER_MAX_IMAGES } from "@/config/pdf-scanner";

/** Validate the whole batch before creating previews or changing selected pages. */
export function scannerSelectionError(
  currentCount: number,
  files: readonly Pick<File, "type">[],
): string | null {
  if (currentCount + files.length > SCANNER_MAX_IMAGES) {
    return `You can add up to ${SCANNER_MAX_IMAGES} images. No pages from this batch were added. Remove a page or choose a smaller batch.`;
  }
  if (files.some((file) => !(SCANNER_IMAGE_MIME_TYPES as readonly string[]).includes(file.type))) {
    return "Choose JPG, PNG or WebP images. No pages from this batch were added.";
  }
  return null;
}
