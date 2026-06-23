// ============================================================
// OnlyMyPDF — Tool registry (single source of truth for the UI).
// Mirrors the backend `tools` table / seeder. Drives the homepage
// grid, tool pages, SEO, credit estimates, badges, and routing.
// ============================================================

export type ToolCategory =
  | "convert"
  | "compress"
  | "organize"
  | "edit"
  | "sign_security"
  | "ai"
  | "scan";

export type Processing = "client" | "server";

export interface Tool {
  code: string;
  slug: string; // English slug, also used under /hi/
  name: { en: string; hi: string };
  short: { en: string; hi: string };
  category: ToolCategory;
  processing: Processing;
  /** credit cost range (single unified 2100-credit wallet) */
  credits: [number, number];
  highAccuracy?: boolean; // shows "High Accuracy Beta" badge
  ai?: boolean; // shows "AI" badge
  popular?: boolean; // shown in homepage quick cards
  beta?: boolean;
  enabled?: boolean; // false = behind feature flag / phase 2
  legalNote?: { en: string; hi: string };
  accept: string[]; // accepted file extensions
}

export const CATEGORIES: { key: ToolCategory; label: { en: string; hi: string } }[] = [
  { key: "convert", label: { en: "Convert", hi: "कन्वर्ट" } },
  { key: "compress", label: { en: "Compress", hi: "कंप्रेस" } },
  { key: "organize", label: { en: "Organize", hi: "व्यवस्थित करें" } },
  { key: "edit", label: { en: "Edit", hi: "एडिट" } },
  { key: "sign_security", label: { en: "Sign & Security", hi: "साइन व सुरक्षा" } },
  { key: "ai", label: { en: "AI", hi: "एआई" } },
  { key: "scan", label: { en: "Scan", hi: "स्कैन" } },
];

const PDF = ["pdf"];

export const TOOLS: Tool[] = [
  // ---------- Compress ----------
  {
    code: "compress-pdf", slug: "compress-pdf", category: "compress", processing: "server",
    credits: [1, 3], popular: true, accept: PDF,
    name: { en: "Compress PDF", hi: "PDF कंप्रेस करें" },
    short: { en: "Shrink PDF size while keeping quality.", hi: "गुणवत्ता बनाए रखते हुए PDF का आकार घटाएँ।" },
  },
  // ---------- Organize (mostly client-side) ----------
  {
    code: "merge-pdf", slug: "merge-pdf", category: "organize", processing: "client",
    credits: [1, 1], popular: true, accept: PDF,
    name: { en: "Merge PDF", hi: "PDF मर्ज करें" },
    short: { en: "Combine multiple PDFs into one.", hi: "कई PDF को एक में मिलाएँ।" },
  },
  {
    code: "split-pdf", slug: "split-pdf", category: "organize", processing: "client",
    credits: [1, 1], accept: PDF,
    name: { en: "Split PDF", hi: "PDF विभाजित करें" },
    short: { en: "Split a PDF into separate files.", hi: "PDF को अलग फाइलों में बाँटें।" },
  },
  {
    code: "rotate-pdf", slug: "rotate-pdf", category: "organize", processing: "client",
    credits: [1, 1], accept: PDF,
    name: { en: "Rotate PDF", hi: "PDF घुमाएँ" },
    short: { en: "Rotate pages and save.", hi: "पेज घुमाएँ और सेव करें।" },
  },
  {
    code: "delete-pdf-pages", slug: "delete-pdf-pages", category: "organize", processing: "client",
    credits: [1, 1], accept: PDF,
    name: { en: "Delete PDF Pages", hi: "PDF पेज हटाएँ" },
    short: { en: "Remove unwanted pages.", hi: "अनचाहे पेज हटाएँ।" },
  },
  {
    code: "extract-pdf-pages", slug: "extract-pdf-pages", category: "organize", processing: "client",
    credits: [1, 1], accept: PDF,
    name: { en: "Extract PDF Pages", hi: "PDF पेज निकालें" },
    short: { en: "Keep only the pages you need.", hi: "केवल ज़रूरी पेज रखें।" },
  },
  {
    code: "organize-pdf", slug: "organize-pdf", category: "organize", processing: "client",
    credits: [1, 1], accept: PDF,
    name: { en: "Organize PDF", hi: "PDF व्यवस्थित करें" },
    short: { en: "Reorder, rotate, and delete pages.", hi: "पेज क्रमबद्ध, घुमाएँ व हटाएँ।" },
  },
  {
    code: "pdf-reader", slug: "pdf-reader", category: "organize", processing: "client",
    credits: [0, 0], accept: PDF,
    name: { en: "PDF Reader", hi: "PDF रीडर" },
    short: { en: "Open and read PDFs privately in your browser.", hi: "PDF को ब्राउज़र में निजी रूप से खोलें।" },
  },
  // ---------- Edit ----------
  {
    code: "number-pages", slug: "number-pages", category: "edit", processing: "client",
    credits: [1, 2], accept: PDF,
    name: { en: "Number Pages", hi: "पेज नंबर लगाएँ" },
    short: { en: "Add page numbers to a PDF.", hi: "PDF में पेज नंबर जोड़ें।" },
  },
  {
    code: "crop-pdf", slug: "crop-pdf", category: "edit", processing: "client",
    credits: [1, 2], accept: PDF,
    name: { en: "Crop PDF", hi: "PDF क्रॉप करें" },
    short: { en: "Trim page margins.", hi: "पेज के हाशिये काटें।" },
  },
  {
    code: "watermark-pdf", slug: "watermark-pdf", category: "edit", processing: "client",
    credits: [1, 2], accept: PDF,
    name: { en: "Watermark PDF", hi: "PDF वॉटरमार्क" },
    short: { en: "Add text or image watermark.", hi: "टेक्स्ट या इमेज वॉटरमार्क जोड़ें।" },
  },
  {
    code: "pdf-form-filler", slug: "pdf-form-filler", category: "edit", processing: "client",
    credits: [1, 2], accept: PDF,
    name: { en: "PDF Form Filler", hi: "PDF फॉर्म फिलर" },
    short: { en: "Fill form fields or place text.", hi: "फॉर्म फील्ड भरें या टेक्स्ट रखें।" },
  },
  {
    code: "flatten-pdf", slug: "flatten-pdf", category: "edit", processing: "server",
    credits: [2, 2], accept: PDF,
    name: { en: "Flatten PDF", hi: "PDF फ्लैटन करें" },
    short: { en: "Flatten forms and layers.", hi: "फॉर्म व लेयर फ्लैटन करें।" },
  },
  // ---------- Convert: PDF -> X ----------
  {
    code: "pdf-to-word", slug: "pdf-to-word", category: "convert", processing: "server",
    credits: [5, 30], highAccuracy: true, popular: true, accept: PDF,
    name: { en: "PDF to Word", hi: "PDF से Word" },
    short: { en: "Convert PDF to editable DOCX.", hi: "PDF को एडिटेबल DOCX में बदलें।" },
  },
  {
    code: "pdf-to-excel", slug: "pdf-to-excel", category: "convert", processing: "server",
    credits: [8, 40], highAccuracy: true, popular: true, accept: PDF,
    name: { en: "PDF to Excel", hi: "PDF से Excel" },
    short: { en: "Extract tables to XLSX/CSV.", hi: "टेबल को XLSX/CSV में निकालें।" },
  },
  {
    code: "pdf-to-ppt", slug: "pdf-to-ppt", category: "convert", processing: "server",
    credits: [5, 20], accept: PDF,
    name: { en: "PDF to PPT", hi: "PDF से PPT" },
    short: { en: "Convert PDF to PowerPoint.", hi: "PDF को PowerPoint में बदलें।" },
  },
  {
    code: "pdf-to-jpg", slug: "pdf-to-jpg", category: "convert", processing: "server",
    credits: [1, 3], accept: PDF,
    name: { en: "PDF to JPG", hi: "PDF से JPG" },
    short: { en: "Export PDF pages as images.", hi: "PDF पेज को इमेज में निर्यात करें।" },
  },
  // ---------- Convert: X -> PDF ----------
  {
    code: "word-to-pdf", slug: "word-to-pdf", category: "convert", processing: "server",
    credits: [1, 3], accept: ["doc", "docx"],
    name: { en: "Word to PDF", hi: "Word से PDF" },
    short: { en: "Convert DOC/DOCX to PDF.", hi: "DOC/DOCX को PDF में बदलें।" },
  },
  {
    code: "excel-to-pdf", slug: "excel-to-pdf", category: "convert", processing: "server",
    credits: [1, 3], accept: ["xls", "xlsx"],
    name: { en: "Excel to PDF", hi: "Excel से PDF" },
    short: { en: "Convert XLS/XLSX to PDF.", hi: "XLS/XLSX को PDF में बदलें।" },
  },
  {
    code: "ppt-to-pdf", slug: "ppt-to-pdf", category: "convert", processing: "server",
    credits: [1, 3], accept: ["ppt", "pptx"],
    name: { en: "PPT to PDF", hi: "PPT से PDF" },
    short: { en: "Convert PowerPoint to PDF.", hi: "PowerPoint को PDF में बदलें।" },
  },
  {
    code: "jpg-to-pdf", slug: "jpg-to-pdf", category: "convert", processing: "client",
    credits: [1, 3], popular: true, accept: ["jpg", "jpeg", "png"],
    name: { en: "JPG to PDF", hi: "JPG से PDF" },
    short: { en: "Turn images into a PDF.", hi: "इमेज को PDF में बदलें।" },
  },
  {
    code: "html-to-pdf", slug: "html-to-pdf", category: "convert", processing: "server",
    credits: [1, 3], accept: ["html", "htm"],
    name: { en: "HTML to PDF", hi: "HTML से PDF" },
    short: { en: "Convert a web page/HTML to PDF.", hi: "वेब पेज/HTML को PDF में बदलें।" },
  },
  {
    code: "txt-to-pdf", slug: "txt-to-pdf", category: "convert", processing: "server",
    credits: [1, 2], accept: ["txt"],
    name: { en: "TXT to PDF", hi: "TXT से PDF" },
    short: { en: "Convert plain text to PDF.", hi: "सादे टेक्स्ट को PDF में बदलें।" },
  },
  {
    code: "rtf-to-pdf", slug: "rtf-to-pdf", category: "convert", processing: "server",
    credits: [1, 2], accept: ["rtf"],
    name: { en: "RTF to PDF", hi: "RTF से PDF" },
    short: { en: "Convert RTF documents to PDF.", hi: "RTF दस्तावेज़ को PDF में बदलें।" },
  },
  {
    code: "odt-to-pdf", slug: "odt-to-pdf", category: "convert", processing: "server",
    credits: [1, 2], accept: ["odt"],
    name: { en: "ODT to PDF", hi: "ODT से PDF" },
    short: { en: "Convert OpenDocument to PDF.", hi: "OpenDocument को PDF में बदलें।" },
  },
  // ---------- Sign & Security ----------
  {
    code: "sign-pdf", slug: "sign-pdf", category: "sign_security", processing: "client",
    credits: [1, 2], popular: true, accept: PDF,
    name: { en: "Sign PDF", hi: "PDF साइन करें" },
    short: { en: "Draw, type, or upload a signature.", hi: "हस्ताक्षर बनाएँ, टाइप करें या अपलोड करें।" },
  },
  {
    code: "unlock-pdf", slug: "unlock-pdf", category: "sign_security", processing: "client",
    credits: [1, 2], popular: true, accept: PDF,
    name: { en: "Unlock PDF", hi: "PDF अनलॉक करें" },
    short: { en: "Remove a known password.", hi: "ज्ञात पासवर्ड हटाएँ।" },
    legalNote: {
      en: "Only unlock files you own or have permission to modify.",
      hi: "केवल वही फाइलें अनलॉक करें जिनके आप मालिक हैं या जिन्हें बदलने की अनुमति है।",
    },
  },
  {
    code: "protect-pdf", slug: "protect-pdf", category: "sign_security", processing: "client",
    credits: [1, 2], accept: PDF,
    name: { en: "Protect PDF", hi: "PDF सुरक्षित करें" },
    short: { en: "Add a password to your PDF.", hi: "अपनी PDF में पासवर्ड जोड़ें।" },
  },
  // ---------- Scan ----------
  {
    code: "pdf-scanner", slug: "pdf-scanner", category: "scan", processing: "client",
    credits: [1, 2], accept: ["jpg", "jpeg", "png"],
    name: { en: "PDF Scanner", hi: "PDF स्कैनर" },
    short: { en: "Scan with your camera into a PDF.", hi: "कैमरे से स्कैन कर PDF बनाएँ।" },
  },
  {
    code: "pdf-ocr", slug: "pdf-ocr", category: "scan", processing: "server",
    credits: [10, 30], highAccuracy: true, accept: PDF,
    name: { en: "PDF OCR", hi: "PDF OCR" },
    short: { en: "Make scanned PDFs searchable.", hi: "स्कैन की गई PDF को खोजने योग्य बनाएँ।" },
  },
  {
    code: "extract-tables", slug: "extract-tables-from-pdf", category: "scan", processing: "server",
    credits: [8, 40], highAccuracy: true, accept: PDF,
    name: { en: "Extract Tables from PDF", hi: "PDF से टेबल निकालें" },
    short: { en: "Export tables to CSV/XLSX.", hi: "टेबल को CSV/XLSX में निर्यात करें।" },
  },
  // ---------- AI ----------
  {
    code: "ai-summary", slug: "ai-pdf-summarizer", category: "ai", processing: "server",
    credits: [5, 15], ai: true, popular: true, accept: PDF,
    name: { en: "AI PDF Summarizer", hi: "AI PDF सारांश" },
    short: { en: "Summarize long PDFs instantly.", hi: "लंबी PDF का तुरंत सारांश बनाएँ।" },
  },
  {
    code: "translate-pdf", slug: "translate-pdf", category: "ai", processing: "server",
    credits: [10, 60], ai: true, highAccuracy: true, accept: PDF,
    name: { en: "Translate PDF", hi: "PDF अनुवाद करें" },
    short: { en: "Translate PDFs across 10 languages.", hi: "10 भाषाओं में PDF अनुवाद करें।" },
  },
  // ---------- Phase 2 (disabled by feature flag) ----------
  {
    code: "ask-pdf", slug: "ask-pdf", category: "ai", processing: "server",
    credits: [1, 5], ai: true, enabled: false, accept: PDF,
    name: { en: "Ask PDF", hi: "PDF से पूछें" },
    short: { en: "Chat with your PDF (coming soon).", hi: "अपनी PDF से बात करें (जल्द आ रहा है)।" },
  },
];

export const POPULAR_TOOLS = TOOLS.filter((t) => t.popular);

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug && t.enabled !== false);
}

export function toolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category && t.enabled !== false);
}

export function relatedTools(tool: Tool, limit = 4): Tool[] {
  return TOOLS.filter(
    (t) => t.category === tool.category && t.code !== tool.code && t.enabled !== false
  ).slice(0, limit);
}
