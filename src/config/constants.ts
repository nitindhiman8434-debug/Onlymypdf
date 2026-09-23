import type { Tool, MegaMenuCategory, PricingPlan } from "@/types";

export const PRO_PRICING = {
  monthlyInr: 299,
  yearlyInr: 2399,
  monthlyPaise: 29900,
  yearlyPaise: 239900,
} as const;

/** Team / Business plan defaults (per-seat billing via contact sales in live mode). */
export const TEAM_PRICING = {
  monthlyInrPerSeat: 249,
  yearlyInrPerSeat: 1999,
  defaultSeatLimit: 5,
  defaultDailyToolLimit: 500,
} as const;

export const APP_NAME = "OnlyMyPDF";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@onlymypdf.in";
export const APP_DESCRIPTION =
  "Free online PDF tools to merge, split, compress, convert, edit, sign, and protect your PDFs. No signup required for basic tools.";

/** Internal bypass only — default UI uses FILE_LIMITS.maxFreeFileSizeMB. */
export const UNLIMITED_FILE_SIZE_MB = 0;

function parseFileSizeLimitMb(
  value: string | undefined,
  fallback: number
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isUnlimitedFileSizeMB(maxSizeMB: number): boolean {
  return maxSizeMB <= 0;
}

/** Client-safe marketing copy — must match on server and browser (use NEXT_PUBLIC_*). */
export function formatFileSizeMarketingLabel(maxSizeMB: number): string {
  if (isUnlimitedFileSizeMB(maxSizeMB)) {
    return "Generous file size limits";
  }
  return `Up to ${maxSizeMB} MB per file`;
}

function marketingFileSizeMb(
  publicEnv: string | undefined,
  fallback: number
): number {
  return parseFileSizeLimitMb(publicEnv, fallback);
}

export function getMaxFileSizeMB(isPro: boolean): number {
  return isPro ? FILE_LIMITS.maxProFileSizeMB : FILE_LIMITS.maxFreeFileSizeMB;
}

/** Pricing / compare tables — reads live limits from env (matches upload enforcement). */
export function planFileSizeMarketingLabel(isPro: boolean): string {
  return isPro ? FILE_SIZE_MARKETING.proLabel : FILE_SIZE_MARKETING.freeLabel;
}

export const FILE_LIMITS = {
  maxFreeFileSizeMB: parseFileSizeLimitMb(
    process.env.MAX_FREE_FILE_SIZE_MB,
    25
  ),
  maxProFileSizeMB: parseFileSizeLimitMb(
    process.env.MAX_PRO_FILE_SIZE_MB,
    200
  ),
  fileRetentionHours: Number(process.env.FILE_RETENTION_HOURS) || 2,
  maxFreeUsesPerDay: 5,
  maxProUsesPerDay: 100,
  maxFilesPerMerge: 20,
  maxFilesPerMergePro: 50,
} as const;

export const FILE_SIZE_MARKETING = {
  freeLabel: formatFileSizeMarketingLabel(
    marketingFileSizeMb(process.env.NEXT_PUBLIC_MAX_FREE_FILE_SIZE_MB, 25)
  ),
  proLabel: formatFileSizeMarketingLabel(
    marketingFileSizeMb(process.env.NEXT_PUBLIC_MAX_PRO_FILE_SIZE_MB, 200)
  ),
} as const;

export const SUPPORTED_FILE_TYPES = {
  pdf: {
    mimeTypes: ["application/pdf"],
    extensions: [".pdf"],
    label: "PDF",
  },
  word: {
    mimeTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    extensions: [".doc", ".docx"],
    label: "Word",
  },
  image: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    label: "Image",
  },
  excel: {
    mimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    extensions: [".xls", ".xlsx"],
    label: "Excel",
  },
  powerpoint: {
    mimeTypes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    extensions: [".ppt", ".pptx"],
    label: "PowerPoint",
  },
} as const;

export const TOOLS: Tool[] = [
  {
    name: "Merge PDF",
    slug: "merge-pdf",
    description: "Combine multiple PDFs into one",
    icon: "Layers",
    category: "organize",
    color: "#4CAF50",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 20,
  },
  {
    name: "Split PDF",
    slug: "split-pdf",
    description: "Split PDF into separate pages",
    icon: "Scissors",
    category: "organize",
    color: "#2196F3",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Rotate PDF",
    slug: "rotate-pdf",
    description: "Rotate PDF pages visually",
    icon: "RotateCw",
    category: "organize",
    color: "#9C27B0",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Delete PDF Pages",
    slug: "delete-pdf",
    description: "Remove pages from your PDF",
    icon: "Trash2",
    category: "organize",
    color: "#F44336",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Extract PDF Pages",
    slug: "extract-pdf",
    description: "Extract specific pages from your PDF",
    icon: "FileDown",
    category: "organize",
    color: "#2196F3",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Compress PDF",
    slug: "compress-pdf",
    description: "Reduce PDF file size",
    icon: "Minimize2",
    category: "optimize",
    color: "#FF9800",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "PDF to Word",
    slug: "pdf-to-word",
    description: "Convert PDF to editable Word",
    icon: "FileText",
    category: "convert-from",
    color: "#1565C0",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "PDF to Excel",
    slug: "pdf-to-excel",
    description: "Convert PDF to Excel spreadsheet",
    icon: "Table",
    category: "convert-from",
    color: "#217346",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "PDF to PowerPoint",
    slug: "pdf-to-ppt",
    description: "Convert PDF to PowerPoint slides",
    icon: "Presentation",
    category: "convert-from",
    color: "#D24726",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Word to PDF",
    slug: "word-to-pdf",
    description: "Convert Word documents to PDF",
    icon: "FileUp",
    category: "convert-to",
    color: "#C62828",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["word"],
    maxFiles: 1,
  },
  {
    name: "Excel to PDF",
    slug: "excel-to-pdf",
    description: "Convert Excel spreadsheets to PDF",
    icon: "FileSpreadsheet",
    category: "convert-to",
    color: "#217346",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["excel"],
    maxFiles: 1,
  },
  {
    name: "PowerPoint to PDF",
    slug: "ppt-to-pdf",
    description: "Convert PowerPoint presentations to PDF",
    icon: "Presentation",
    category: "convert-to",
    color: "#D24726",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["powerpoint"],
    maxFiles: 1,
  },
  {
    name: "JPG to PDF",
    slug: "jpg-to-pdf",
    description: "Convert images to PDF",
    icon: "Image",
    category: "convert-to",
    color: "#7B1FA2",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["image"],
    maxFiles: 20,
  },
  {
    name: "HTML to PDF",
    slug: "html-to-pdf",
    description: "Convert HTML pages to PDF",
    icon: "Code2",
    category: "convert-to",
    color: "#E65100",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["html"],
    maxFiles: 1,
  },
  {
    name: "TXT to PDF",
    slug: "txt-to-pdf",
    description: "Convert text files to PDF",
    icon: "Type",
    category: "convert-to",
    color: "#5C6BC0",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["txt"],
    maxFiles: 1,
  },
  {
    name: "Edit PDF",
    slug: "edit-pdf",
    description: "Add text and whiteout edits to PDF pages",
    icon: "PenLine",
    category: "edit",
    color: "#06B6D4",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Sign PDF",
    slug: "sign-pdf",
    description: "Add signature to PDF",
    icon: "PenTool",
    category: "edit",
    color: "#F57C00",
    requiresLogin: false,
    isPro: true,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Add Watermark",
    slug: "add-watermark",
    description: "Add text or image watermark to PDF",
    icon: "Stamp",
    category: "edit",
    color: "#0891B2",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "AI PDF Summarizer",
    slug: "ai-pdf-summarizer",
    description: "Get AI summary of PDF",
    icon: "Sparkles",
    category: "ai",
    color: "#6A1B9A",
    requiresLogin: true,
    isPro: true,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "PDF Scanner",
    slug: "pdf-scanner",
    description: "Scan documents to PDF",
    icon: "ScanLine",
    category: "scan",
    color: "#455A64",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["image"],
    maxFiles: 10,
  },
  {
    name: "Unlock PDF",
    slug: "unlock-pdf",
    description: "Remove password from your PDF",
    icon: "Unlock",
    category: "security",
    color: "#D32F2F",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Protect PDF",
    slug: "protect-pdf",
    description: "Add password to PDF",
    icon: "Lock",
    category: "security",
    color: "#1976D2",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Repair PDF",
    slug: "repair-pdf",
    description: "Rebuild damaged PDF structure",
    icon: "Wrench",
    category: "optimize",
    color: "#0F766E",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "OCR PDF",
    slug: "ocr-pdf",
    description: "Make scanned PDF text searchable",
    icon: "ScanText",
    category: "optimize",
    color: "#0369A1",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "PDF to PDF/A",
    slug: "pdf-a",
    description: "Convert PDF for long-term archiving",
    icon: "Archive",
    category: "optimize",
    color: "#7C3AED",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Redact PDF",
    slug: "redact-pdf",
    description: "Permanently remove exact text",
    icon: "ShieldX",
    category: "security",
    color: "#BE123C",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Crop PDF",
    slug: "crop-pdf",
    description: "Adjust visible PDF page margins",
    icon: "Crop",
    category: "organize",
    color: "#B45309",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 1,
  },
  {
    name: "Compare PDF",
    slug: "compare-pdf",
    description: "Create a visual page difference report",
    icon: "FileSearch",
    category: "organize",
    color: "#4338CA",
    requiresLogin: false,
    isPro: false,
    acceptedFileTypes: ["pdf"],
    maxFiles: 2,
  },
];

export const MEGA_MENU_CATEGORIES: MegaMenuCategory[] = [
  {
    label: "Organize PDF",
    tools: [
      { name: "Merge PDF", slug: "merge-pdf", icon: "Layers", color: "#4CAF50" },
      { name: "Split PDF", slug: "split-pdf", icon: "Scissors", color: "#2196F3" },
      { name: "Rotate PDF", slug: "rotate-pdf", icon: "RotateCw", color: "#9C27B0" },
      { name: "Delete PDF Pages", slug: "delete-pdf", icon: "Trash2", color: "#F44336" },
      { name: "Extract PDF Pages", slug: "extract-pdf", icon: "FileDown", color: "#2196F3" },
      { name: "Crop PDF", slug: "crop-pdf", icon: "Crop", color: "#B45309" },
      { name: "Compare PDF", slug: "compare-pdf", icon: "FileSearch", color: "#4338CA" },
    ],
  },
  {
    label: "Optimize PDF",
    tools: [
      { name: "Compress PDF", slug: "compress-pdf", icon: "Minimize2", color: "#FF9800" },
      { name: "Repair PDF", slug: "repair-pdf", icon: "Wrench", color: "#0F766E" },
      { name: "OCR PDF", slug: "ocr-pdf", icon: "ScanText", color: "#0369A1" },
      { name: "PDF to PDF/A", slug: "pdf-a", icon: "Archive", color: "#7C3AED" },
    ],
  },
  {
    label: "Convert from PDF",
    tools: [
      { name: "PDF to Word", slug: "pdf-to-word", icon: "FileText", color: "#1565C0" },
      { name: "PDF to Excel", slug: "pdf-to-excel", icon: "Table", color: "#217346" },
      { name: "PDF to PowerPoint", slug: "pdf-to-ppt", icon: "Presentation", color: "#D24726" },
    ],
  },
  {
    label: "Convert to PDF",
    tools: [
      { name: "Word to PDF", slug: "word-to-pdf", icon: "FileUp", color: "#C62828" },
      { name: "Excel to PDF", slug: "excel-to-pdf", icon: "FileSpreadsheet", color: "#217346" },
      { name: "PowerPoint to PDF", slug: "ppt-to-pdf", icon: "Presentation", color: "#D24726" },
      { name: "JPG to PDF", slug: "jpg-to-pdf", icon: "Image", color: "#7B1FA2" },
      { name: "HTML to PDF", slug: "html-to-pdf", icon: "Code2", color: "#E65100" },
      { name: "TXT to PDF", slug: "txt-to-pdf", icon: "Type", color: "#5C6BC0" },
    ],
  },
  {
    label: "Edit & Sign",
    tools: [
      { name: "Edit PDF", slug: "edit-pdf", icon: "PenLine", color: "#06B6D4" },
      { name: "Sign PDF", slug: "sign-pdf", icon: "PenTool", color: "#F57C00" },
      { name: "Add Watermark", slug: "add-watermark", icon: "Stamp", color: "#0891B2" },
    ],
  },
  {
    label: "Security",
    tools: [
      { name: "Protect PDF", slug: "protect-pdf", icon: "Lock", color: "#1976D2" },
      { name: "Unlock PDF", slug: "unlock-pdf", icon: "Unlock", color: "#D32F2F" },
      { name: "Redact PDF", slug: "redact-pdf", icon: "ShieldX", color: "#BE123C" },
    ],
  },
  {
    label: "AI Tools",
    tools: [
      { name: "AI PDF Summarizer", slug: "ai-pdf-summarizer", icon: "Sparkles", color: "#6A1B9A" },
    ],
  },
  {
    label: "Scan",
    tools: [
      { name: "PDF Scanner", slug: "pdf-scanner", icon: "ScanLine", color: "#455A64" },
    ],
  },
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Free",
    tier: "free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "INR",
    features: [
      "5 tool uses per day",
      FILE_SIZE_MARKETING.freeLabel,
      "Basic PDF tools",
      "Standard processing speed",
      "Files deleted after 2 hours",
      "Community support",
    ],
    highlighted: false,
    ctaText: "Get Started Free",
  },
  {
    name: "Pro",
    tier: "pro",
    monthlyPrice: 299,
    yearlyPrice: PRO_PRICING.yearlyInr,
    currency: "INR",
    features: [
      "100 tool uses per day",
      FILE_SIZE_MARKETING.proLabel,
      "All PDF tools including Edit & Sign",
      "AI PDF Summarizer",
      "Priority processing speed",
      "Files deleted after 24 hours",
      "No ads",
      "Priority email support",
      "Batch processing",
    ],
    highlighted: true,
    ctaText: "Upgrade to Pro",
  },
];

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getToolsByCategory(category: string): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export const PROTECTED_ROUTES = ["/dashboard", "/admin"];
export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@onlymypdf.in";
