"use client";

import { useState } from "react";
import { ConvertToolPage } from "@/components/tools/convert-tool-page";

const MARGINS = ["top", "right", "bottom", "left"] as const;

export default function CropPdfPage() {
  const [margins, setMargins] = useState({ top: 5, right: 5, bottom: 5, left: 5 });
  return (
    <ConvertToolPage
      title="Crop PDF"
      description="Apply consistent percentage margins to every page while keeping text searchable"
      accept=".pdf,application/pdf"
      uploadHint="PDF only. CropBox is visual cropping, not secure content removal."
      processLabel="Crop PDF"
      processingLabel="Cropping pages..."
      successTitle="Cropped PDF ready"
      successDescription="The selected margins were applied to every page."
      downloadLabel="Download Cropped PDF"
      outputExtension="pdf"
      apiPath="/api/tools/crop-pdf"
      supportsPdfPassword
      fetchTimeoutMs={300_000}
      buildResultFilename={(name) => name.replace(/\.pdf$/i, "-cropped.pdf")}
      extraFields={
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-pd-foreground">Crop margins (%)</legend>
          <div className="grid grid-cols-2 gap-3">
            {MARGINS.map((name) => (
              <label key={name} className="text-xs font-medium capitalize text-pd-muted">
                {name}
                <input
                  type="number"
                  min={0}
                  max={45}
                  step={1}
                  value={margins[name]}
                  onChange={(event) =>
                    setMargins((current) => ({
                      ...current,
                      [name]: Math.max(0, Math.min(45, Number(event.target.value) || 0)),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-pd-border bg-pd-surface px-3 py-2 text-sm text-pd-foreground focus:border-pd-brand focus:outline-none focus:ring-2 focus:ring-pd-brand/20"
                />
              </label>
            ))}
          </div>
        </fieldset>
      }
      buildFormData={(_file, formData) => {
        for (const name of MARGINS) formData.set(name, String(margins[name]));
        return formData;
      }}
      relatedTools={[
        { name: "Redact PDF", href: "/redact-pdf" },
        { name: "Rotate PDF", href: "/rotate-pdf" },
        { name: "Delete PDF Pages", href: "/delete-pdf" },
        { name: "Compress PDF", href: "/compress-pdf" },
      ]}
    />
  );
}
