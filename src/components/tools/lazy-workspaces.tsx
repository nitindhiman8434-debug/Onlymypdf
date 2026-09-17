"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

function WorkspaceLoading() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-pd-border bg-pd-surface">
      <div className="flex flex-col items-center gap-3 text-pd-muted">
        <Loader2 className="h-8 w-8 animate-spin text-pd-brand" />
        <p className="text-sm">Loading workspace…</p>
      </div>
    </div>
  );
}

const loading = { loading: () => <WorkspaceLoading /> };

export const MergePdfWorkspace = dynamic(
  () =>
    import("@/components/tools/merge-pdf/merge-pdf-workspace").then((m) => ({
      default: m.MergePdfWorkspace,
    })),
  { ...loading, ssr: false }
);

export const SignPdfWorkspace = dynamic(
  () =>
    import("@/components/tools/sign-pdf/sign-pdf-workspace").then((m) => ({
      default: m.SignPdfWorkspace,
    })),
  { ...loading, ssr: false }
);

export const EditPdfWorkspace = dynamic(
  () =>
    import("@/components/tools/edit-pdf/edit-pdf-workspace").then((m) => ({
      default: m.EditPdfWorkspace,
    })),
  { ...loading, ssr: false }
);

export const ExtractPdfWorkspace = dynamic(
  () =>
    import("@/components/tools/extract-pdf/extract-pdf-workspace").then((m) => ({
      default: m.ExtractPdfWorkspace,
    })),
  { ...loading, ssr: false }
);

export const RotatePdfWorkspace = dynamic(
  () =>
    import("@/components/tools/rotate-pdf/rotate-pdf-workspace").then((m) => ({
      default: m.RotatePdfWorkspace,
    })),
  { ...loading, ssr: false }
);

export const DeletePdfWorkspace = dynamic(
  () =>
    import("@/components/tools/delete-pdf/delete-pdf-workspace").then((m) => ({
      default: m.DeletePdfWorkspace,
    })),
  { ...loading, ssr: false }
);

export const PdfScannerWorkspace = dynamic(
  () =>
    import("@/components/tools/pdf-scanner/pdf-scanner-workspace").then((m) => ({
      default: m.PdfScannerWorkspace,
    })),
  { ...loading, ssr: false }
);
