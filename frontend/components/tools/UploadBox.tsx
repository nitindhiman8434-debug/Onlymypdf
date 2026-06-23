"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface UploadValidation {
  accept: string[]; // extensions, e.g. ["pdf"]
  maxBytes: number; // plan limit
}

/**
 * Drag & drop upload box with client-side validation
 * (extension + size; MIME is double-checked on the server too).
 */
export function UploadBox({
  locale,
  validation,
  multiple = false,
  onFiles,
}: {
  locale: Locale;
  validation: UploadValidation;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (files: File[]): string | null => {
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!validation.accept.includes(ext)) return t(locale, "errors.unsupported");
      if (f.size > validation.maxBytes) return t(locale, "errors.fileTooLarge");
    }
    return null;
  };

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const err = validate(files);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onFiles(files);
  };

  const acceptAttr = validation.accept.map((e) => `.${e}`).join(",");
  const maxMb = Math.round(validation.maxBytes / (1024 * 1024));

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={t(locale, "tool.dropHere")}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-10 text-center transition-colors",
          dragging ? "border-brand bg-brand/5" : "border-slate-200 hover:border-brand/50"
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
          <UploadCloud className="h-7 w-7" />
        </div>
        <p className="mt-4 font-medium text-navy">{t(locale, "tool.dropHere")}</p>
        <Button className="mt-3" variant="gradient" type="button">
          {t(locale, "tool.chooseFiles")}
        </Button>
        <p className="mt-3 text-xs text-navy/50">
          {t(locale, "tool.supported")}: {validation.accept.join(", ").toUpperCase()} ·{" "}
          {t(locale, "tool.planLimit")}: {maxMb} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
