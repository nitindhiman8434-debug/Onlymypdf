import sharp from "sharp";
import type { ScannerProcessingFilter } from "@/config/pdf-scanner";

/** Scanner-only preprocessing; never modifies the shared image-to-PDF converter. */
export async function prepareScannerImage(input: Buffer, filter: ScannerProcessingFilter): Promise<Buffer> {
  // Apply phone orientation before stripping metadata or embedding PDF pixels.
  let image = sharp(input).autoOrient();
  switch (filter) {
    case "grayscale": image = image.grayscale(); break;
    case "blackwhite": image = image.grayscale().threshold(128); break;
    case "highcontrast": image = image.normalize().sharpen(); break;
    case "brighten": image = image.modulate({ brightness: 1.3 }); break;
  }
  return image.png().toBuffer();
}
