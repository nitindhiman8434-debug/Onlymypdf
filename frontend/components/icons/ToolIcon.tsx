import {
  FileDown,
  Combine,
  Scissors,
  RotateCw,
  Trash2,
  FileOutput,
  LayoutGrid,
  BookOpen,
  Hash,
  Crop,
  Stamp,
  FormInput,
  Layers,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  FileType,
  PenTool,
  LockOpen,
  Lock,
  ScanLine,
  ScanText,
  Table,
  Sparkles,
  Languages,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Colorful 3D-style tool tile: gradient background + soft top-left light + glyph.
// (Small nav/UI icons elsewhere use flat lucide icons directly.)
const GLYPHS: Record<string, LucideIcon> = {
  "compress-pdf": FileDown,
  "merge-pdf": Combine,
  "split-pdf": Scissors,
  "rotate-pdf": RotateCw,
  "delete-pdf-pages": Trash2,
  "extract-pdf-pages": FileOutput,
  "organize-pdf": LayoutGrid,
  "pdf-reader": BookOpen,
  "number-pages": Hash,
  "crop-pdf": Crop,
  "watermark-pdf": Stamp,
  "pdf-form-filler": FormInput,
  "flatten-pdf": Layers,
  "pdf-to-word": FileText,
  "pdf-to-excel": FileSpreadsheet,
  "pdf-to-ppt": Presentation,
  "pdf-to-jpg": Image,
  "word-to-pdf": FileText,
  "excel-to-pdf": FileSpreadsheet,
  "ppt-to-pdf": Presentation,
  "jpg-to-pdf": Image,
  "html-to-pdf": FileType,
  "txt-to-pdf": FileType,
  "rtf-to-pdf": FileType,
  "sign-pdf": PenTool,
  "unlock-pdf": LockOpen,
  "protect-pdf": Lock,
  "pdf-scanner": ScanLine,
  "pdf-ocr": ScanText,
  "extract-tables": Table,
  "ai-summary": Sparkles,
  "translate-pdf": Languages,
  "ask-pdf": MessageSquare,
};

// Each category gets a distinct gradient so the grid feels colorful but consistent.
const CATEGORY_GRADIENT: Record<string, string> = {
  convert: "from-brand to-teal",
  compress: "from-healing to-teal",
  organize: "from-brand to-violet",
  edit: "from-violet to-brand",
  sign_security: "from-navy to-brand",
  ai: "from-violet to-coral",
  scan: "from-teal to-healing",
};

export function ToolIcon({
  code,
  category,
  className,
}: {
  code: string;
  category: string;
  className?: string;
}) {
  const Glyph = GLYPHS[code] ?? FileText;
  const gradient = CATEGORY_GRADIENT[category] ?? "from-brand to-teal";
  return (
    <span
      className={cn(
        "relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-card",
        gradient,
        className
      )}
      aria-hidden
    >
      {/* soft 3D top-left highlight */}
      <span className="pointer-events-none absolute inset-0 rounded-xl bg-white/20 [mask-image:radial-gradient(120%_80%_at_20%_10%,black,transparent)]" />
      <Glyph className="relative h-6 w-6" strokeWidth={2} />
    </span>
  );
}
