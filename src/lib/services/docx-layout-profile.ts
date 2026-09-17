import JSZip from "jszip";

/** Metrics used to detect Smallpdf-class vs raster page-export DOCX. */
export type DocxLayoutProfile = {
  chars: number;
  tables: number;
  drawings: number;
  anchors: number;
  inlines: number;
  textBoxes: number;
  media: number;
  bytes: number;
  pageWidthPt: number | null;
  pageHeightPt: number | null;
};

function parsePageSizePt(xml: string): { width: number | null; height: number | null } {
  const match = xml.match(/w:pgSz w:w="(\d+)" w:h="(\d+)"/);
  if (!match) return { width: null, height: null };
  return { width: Number(match[1]) / 20, height: Number(match[2]) / 20 };
}

function extractProfileFromXml(xml: string, bytes: number, media: number): DocxLayoutProfile {
  const chars = (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).reduce(
    (sum, node) => sum + node.replace(/<[^>]+>/g, "").length,
    0
  );
  const { width, height } = parsePageSizePt(xml);

  return {
    chars,
    tables: (xml.match(/<w:tbl/g) ?? []).length,
    drawings: (xml.match(/<w:drawing/g) ?? []).length,
    anchors: (xml.match(/wp:anchor/g) ?? []).length,
    inlines: (xml.match(/wp:inline/g) ?? []).length,
    textBoxes: (xml.match(/w:txbxContent/g) ?? []).length,
    media,
    bytes,
    pageWidthPt: width,
    pageHeightPt: height,
  };
}

export async function analyzeDocxLayout(buffer: Buffer): Promise<DocxLayoutProfile> {
  if (buffer.length < 1500) {
    return {
      chars: 0,
      tables: 0,
      drawings: 0,
      anchors: 0,
      inlines: 0,
      textBoxes: 0,
      media: 0,
      bytes: buffer.length,
      pageWidthPt: null,
      pageHeightPt: null,
    };
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    const doc = zip.file("word/document.xml");
    if (!doc) {
      return extractProfileFromXml("", buffer.length, 0);
    }
    const xml = await doc.async("string");
    const media = Object.keys(zip.files).filter((name) => name.startsWith("word/media/")).length;
    const profile = extractProfileFromXml(xml, buffer.length, media);

    let allChars = 0;
    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith(".xml") || !name.startsWith("word/")) continue;
      const part = await zip.file(name)!.async("string");
      allChars += (part.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).reduce(
        (sum, node) => sum + node.replace(/<[^>]+>/g, "").length,
        0
      );
    }
    if (allChars > profile.chars) {
      profile.chars = allChars;
    }
    return profile;
  } catch {
    const text = buffer.toString("latin1");
    return extractProfileFromXml(text, buffer.length, 0);
  }
}

/** All visible text from word/*.xml parts (body, headers, text boxes). */
export async function extractDocxPlainText(buffer: Buffer): Promise<string> {
  if (buffer.length < 1500) return "";

  try {
    const zip = await JSZip.loadAsync(buffer);
    const chunks: string[] = [];
    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith(".xml") || !name.startsWith("word/")) continue;
      const xml = await zip.file(name)!.async("string");
      for (const match of xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
        chunks.push(match[1]);
      }
    }
    return chunks.join("");
  } catch {
    const text = buffer.toString("latin1");
    return (text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
      .map((node) => node.replace(/<[^>]+>/g, ""))
      .join("");
  }
}

/** One large PNG per page — old broken OnlyMyPDF raster export pattern. */
export function isRasterPageExport(profile: DocxLayoutProfile, pageCount: number): boolean {
  const pages = Math.max(1, pageCount);
  return profile.anchors === 0 && profile.media >= pages && profile.chars < 40;
}

/** Absolute layout with positioned content (Word COM / Smallpdf / ConvertAPI class). */
export function isAbsoluteLayoutExport(profile: DocxLayoutProfile): boolean {
  return profile.anchors > 0 || profile.textBoxes > 0;
}

/** Golden CI profile: poster-style page size with layout artifacts, not a letter-size raster. */
export function matchesSmallPdfClassLayout(
  profile: DocxLayoutProfile,
  pageCount: number
): boolean {
  if (isRasterPageExport(profile, pageCount)) return false;

  const hasLayout =
    isAbsoluteLayoutExport(profile) ||
    profile.drawings >= pageCount ||
    profile.chars >= 40;

  if (!hasLayout) return false;

  // Reject US Letter raster exports (612×792) when expecting design poster layouts.
  if (
    profile.pageWidthPt &&
    profile.pageHeightPt &&
    Math.abs(profile.pageWidthPt - 612) < 12 &&
    Math.abs(profile.pageHeightPt - 792) < 12 &&
    profile.anchors === 0 &&
    profile.chars < 40
  ) {
    return false;
  }

  return true;
}
