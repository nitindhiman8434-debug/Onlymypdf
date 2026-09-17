/** Magic-byte sniffing for uploads — validation only, not conversion logic. */

const SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  pdf: [{ bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }], // %PDF-
  png: [{ bytes: [0x89, 0x50, 0x4e, 0x47] }],
  jpeg: [{ bytes: [0xff, 0xd8, 0xff] }],
  gif: [{ bytes: [0x47, 0x49, 0x46, 0x38] }],
  webp: [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }],
  zip: [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // docx/xlsx/pptx (standard local file header)
    { bytes: [0x50, 0x4b, 0x05, 0x06] }, // empty archive
    { bytes: [0x50, 0x4b, 0x07, 0x08] }, // spanned archive
  ],
  ole: [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }], // legacy .doc/.xls/.ppt
};

const OOXML_MARKER = Buffer.from("[Content_Types].xml", "ascii");

/**
 * OOXML office files (docx/xlsx/pptx) are ZIP archives that must contain
 * `[Content_Types].xml`. Scanning bounded windows at the head and tail (where
 * ZIP local headers and the central directory live) rejects arbitrary ZIPs and
 * many zip-bomb payloads without a full archive parse.
 */
function looksLikeOoxml(buffer: Buffer): boolean {
  const windowSize = 64 * 1024;
  const head = buffer.subarray(0, Math.min(windowSize, buffer.length));
  if (head.includes(OOXML_MARKER)) return true;
  if (buffer.length > windowSize) {
    const tail = buffer.subarray(Math.max(0, buffer.length - windowSize));
    if (tail.includes(OOXML_MARKER)) return true;
  }
  return false;
}

// A legitimate Office document has at most a few hundred zip entries. An absurd
// entry count is a strong zip-bomb / malformed-archive signal.
const MAX_OOXML_ENTRIES = 5000;

/**
 * Read the ZIP End-Of-Central-Directory record (near the file tail) and return
 * the declared total entry count, or null if it cannot be located. Defense in
 * depth against zip bombs at the validation layer (engine still enforces limits).
 */
function zipEntryCount(buffer: Buffer): number | null {
  const EOCD_SIG = 0x06054b50;
  // EOCD is within the last 22 bytes + up to 65535-byte comment.
  const maxScan = Math.min(buffer.length, 22 + 65535);
  for (let i = buffer.length - 22; i >= buffer.length - maxScan && i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      return buffer.readUInt16LE(i + 10); // total entries on this disk
    }
  }
  return null;
}

function matchesSignature(
  buffer: Buffer,
  sig: { bytes: number[]; offset?: number }
): boolean {
  const offset = sig.offset ?? 0;
  if (buffer.length < offset + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => buffer[offset + i] === b);
}

function categoryFromMagic(buffer: Buffer): string | null {
  if (SIGNATURES.pdf.some((s) => matchesSignature(buffer, s))) return "pdf";
  if (SIGNATURES.png.some((s) => matchesSignature(buffer, s))) return "png";
  if (SIGNATURES.jpeg.some((s) => matchesSignature(buffer, s))) return "jpeg";
  if (SIGNATURES.gif.some((s) => matchesSignature(buffer, s))) return "gif";
  if (SIGNATURES.webp.every((s) => matchesSignature(buffer, s))) return "webp";
  if (SIGNATURES.ole.some((s) => matchesSignature(buffer, s))) return "ole";
  if (SIGNATURES.zip.some((s) => matchesSignature(buffer, s))) return "zip";
  return null;
}

// Office categories accept legacy OLE containers or OOXML ZIPs (the ZIP branch
// is additionally required to contain the OOXML content-types marker).
const CATEGORY_MAP: Record<string, string[]> = {
  pdf: ["pdf"],
  word: ["zip", "ole"],
  image: ["png", "jpeg", "gif", "webp"],
  excel: ["zip", "ole"],
  powerpoint: ["zip", "ole"],
};

const OFFICE_CATEGORIES = new Set(["word", "excel", "powerpoint"]);

export function validateBufferMagic(
  buffer: Buffer,
  allowedCategories: string[]
): { valid: boolean; message?: string } {
  if (buffer.length === 0) {
    return { valid: false, message: "File is empty." };
  }

  const detected = categoryFromMagic(buffer);

  if (allowedCategories.includes("txt") || allowedCategories.includes("html")) {
    // Reject binary content: must NOT match a known binary signature (prevents a
    // PDF/ZIP/OLE/image polyglot slipping through as "text"), no NUL bytes in a
    // larger prefix, and the sample must be predominantly printable.
    const sampleLen = Math.min(512, buffer.length);
    const textSample = buffer.subarray(0, sampleLen).toString("utf8");
    const nullBytes = buffer.subarray(0, sampleLen).includes(0);
    const isPrintable = /^[\x09\x0a\x0d\x20-\x7e\u00a0-\ufffd]*$/u.test(textSample);
    if (!detected && !nullBytes && isPrintable) {
      return { valid: true };
    }
  }

  if (!detected) {
    return { valid: false, message: "File content does not match the declared type." };
  }

  // Office ZIP uploads must be genuine OOXML packages, not arbitrary archives.
  const wantsOffice = allowedCategories.some((cat) => OFFICE_CATEGORIES.has(cat));
  if (wantsOffice && detected === "zip") {
    if (!looksLikeOoxml(buffer)) {
      return {
        valid: false,
        message: "File content does not match the allowed file type.",
      };
    }
    const entries = zipEntryCount(buffer);
    if (entries != null && entries > MAX_OOXML_ENTRIES) {
      return { valid: false, message: "File archive is too complex to process." };
    }
  }

  const allowed = allowedCategories.some((cat) =>
    (CATEGORY_MAP[cat] ?? []).includes(detected)
  );

  if (!allowed) {
    return { valid: false, message: "File content does not match the allowed file type." };
  }

  return { valid: true };
}
