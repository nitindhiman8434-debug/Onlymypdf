"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  RotateCw,
  Trash2,
  ArrowRight,
  FileDown,
} from "lucide-react";
import { formatFileSize } from "@/lib/utils/file";
import { Button } from "@/components/ui/button";
import { loadPdfThumbnailsBatched } from "@/lib/pdf/pdf-thumbnails.client";
import { ToolErrorBanner, ToolHiddenFileInput } from "@/components/tools/tool-ui";
import { useToolWorkspaceMessages } from "@/hooks/use-tool-workspace-messages";
import { PdfPasswordModal } from "@/components/tools/pdf-password-modal";
import {
  passwordPromptFromError,
  readToolApiFailure,
} from "@/lib/client/pdf-password-errors";
import { runClientOrServerPdfExport } from "@/lib/pdf/client-pdf-export";
import { extractPagesInBrowser } from "@/lib/pdf/pdf-browser";
import { ExtractResultView } from "@/components/tools/extract-pdf/extract-result-view";
import { ExtractPageCard } from "@/components/tools/extract-pdf/extract-page-card";
import { PageInsertDivider } from "@/components/tools/split-pdf/page-insert-divider";
import { PageZoomModal } from "@/components/tools/split-pdf/page-zoom-modal";
import {
  createOriginalSlots,
  duplicateSlot,
  slotLabel,
  slotThumbUrl,
  type WorkspacePageSlot,
} from "@/components/tools/split-pdf/split-page-types";

interface ExtractPdfWorkspaceProps {
  file: File;
  onChangeFile: () => void;
  onReset: () => void;
}

export function ExtractPdfWorkspace({
  file,
  onChangeFile,
  onReset,
}: ExtractPdfWorkspaceProps) {
  const ws = useToolWorkspaceMessages();
  const [pageSlots, setPageSlots] = useState<WorkspacePageSlot[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(
    () => new Set()
  );
  const [hiddenSlotIds, setHiddenSlotIds] = useState<Set<string>>(
    () => new Set()
  );
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [zoomSlotId, setZoomSlotId] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loadingThumbs, setLoadingThumbs] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [pdfPassword, setPdfPassword] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    file: File;
    fileName: string;
    errorMsg?: string;
    loading?: boolean;
  } | null>(null);
  const loadRequestRef = useRef(0);
  const insertFileRef = useRef<HTMLInputElement>(null);
  const insertAfterIndexRef = useRef(0);

  const fileKey = `${file.name}:${file.size}:${file.lastModified}`;

  const visibleSlots = useMemo(
    () => pageSlots.filter((s) => !hiddenSlotIds.has(s.id)),
    [pageSlots, hiddenSlotIds]
  );

  const selectedVisibleCount = useMemo(
    () => visibleSlots.filter((s) => selectedSlotIds.has(s.id)).length,
    [visibleSlots, selectedSlotIds]
  );

  const allPagesSelected =
    visibleSlots.length > 0 &&
    visibleSlots.every((s) => selectedSlotIds.has(s.id));

  const someSelected =
    selectedVisibleCount > 0 && !allPagesSelected;

  /* ─── load thumbnails ─── */

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    setLoadingThumbs(true);
    setError(null);
    setPdfPassword(null);
    setThumbnails([]);
    setTotalPages(0);
    setHiddenSlotIds(new Set());
    setPageSlots([]);

    loadPdfThumbnailsBatched(file, (thumbs, total, trunc) => {
      if (requestId !== loadRequestRef.current) return;
      setThumbnails([...thumbs]);
      setTotalPages(total);
      setTruncated(trunc);
      if (total > 0) {
        const slots = createOriginalSlots(total);
        setPageSlots(slots);
        setSelectedSlotIds(new Set());
        setError(null);
      }
    })
      .then((result) => {
        if (requestId !== loadRequestRef.current) return;
        if (result.passwordRequired) {
          setPasswordPrompt({ file, fileName: file.name });
          return;
        }
        if (result.wrongPassword) {
          setPasswordPrompt((prev) => prev ? { ...prev, errorMsg: result.error ?? ws.incorrectPassword, loading: false } : prev);
          return;
        }
        if (result.totalPages === 0) {
          setError(
            result.error ?? ws.couldNotReadPdf
          );
        } else if (result.error) {
          setError(ws.resolveApiError(result.error));
        } else {
          setError(null);
        }
      })
      .catch((err) => {
        if (requestId !== loadRequestRef.current) return;
        setThumbnails([]);
        setTotalPages(0);
        setError(
          err instanceof Error
            ? err.message
            : ws.couldNotReadPdf
        );
      })
      .finally(() => {
        if (requestId === loadRequestRef.current) setLoadingThumbs(false);
      });
  }, [fileKey, file, ws]);

  const retryWithPassword = useCallback((pw: string) => {
    if (!passwordPrompt) return;
    const { file } = passwordPrompt;
    setPasswordPrompt((prev) => prev ? { ...prev, loading: true, errorMsg: undefined } : prev);

    loadPdfThumbnailsBatched(file, (thumbs, total, trunc) => {
      setThumbnails([...thumbs]);
      setTotalPages(total);
      setTruncated(trunc);
      if (total > 0) {
        const slots = createOriginalSlots(total);
        setPageSlots(slots);
        setSelectedSlotIds(new Set());
        setError(null);
      }
    }, pw).then((result) => {
      if (result.wrongPassword) {
        setPasswordPrompt((prev) => prev ? { ...prev, errorMsg: result.error ?? ws.incorrectPassword, loading: false } : prev);
        return;
      }
      setPasswordPrompt(null);
      setPdfPassword(pw);
      if (result.error) setError(ws.resolveApiError(result.error));
    });
  }, [passwordPrompt, ws]);

  /* ─── slot actions ─── */

  const rotateSlot = useCallback((slotId: string, delta: number) => {
    setRotations((prev) => ({
      ...prev,
      [slotId]: ((prev[slotId] ?? 0) + delta + 360) % 360,
    }));
  }, []);

  const removeSlot = useCallback(
    (slotId: string) => {
      setHiddenSlotIds((prev) => new Set(prev).add(slotId));
      setSelectedSlotIds((prev) => {
        const next = new Set(prev);
        next.delete(slotId);
        return next;
      });
    },
    []
  );

  const removeSelected = useCallback(() => {
    const toRemove = visibleSlots.filter((s) => selectedSlotIds.has(s.id));
    for (const slot of toRemove) removeSlot(slot.id);
  }, [visibleSlots, selectedSlotIds, removeSlot]);

  const toggleSlot = useCallback((slotId: string) => {
    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedSlotIds(
        checked ? new Set(visibleSlots.map((s) => s.id)) : new Set()
      );
    },
    [visibleSlots]
  );

  const duplicateSlotAfter = useCallback(
    (slotId: string) => {
      const visible = pageSlots.filter((s) => !hiddenSlotIds.has(s.id));
      const slot = visible.find((s) => s.id === slotId);
      if (!slot) return;

      const copy = duplicateSlot(slot);
      const index = visible.findIndex((s) => s.id === slotId);
      if (index < 0) return;

      setPageSlots((prev) => {
        const vis = prev.filter((s) => !hiddenSlotIds.has(s.id));
        const hidden = prev.filter((s) => hiddenSlotIds.has(s.id));
        const nextVisible = [...vis];
        nextVisible.splice(index + 1, 0, copy);
        return [...nextVisible, ...hidden];
      });
    },
    [pageSlots, hiddenSlotIds]
  );

  /* ─── insert pages ─── */

  const insertBlankAfter = useCallback(
    (visibleIndex: number) => {
      const newSlot: WorkspacePageSlot = {
        id: `blank-${crypto.randomUUID()}`,
        kind: "blank",
      };
      setPageSlots((prev) => {
        const visible = prev.filter((s) => !hiddenSlotIds.has(s.id));
        const hidden = prev.filter((s) => hiddenSlotIds.has(s.id));
        const nextVisible = [...visible];
        nextVisible.splice(visibleIndex + 1, 0, newSlot);
        return [...nextVisible, ...hidden];
      });
    },
    [hiddenSlotIds]
  );

  const openInsertDocuments = useCallback((visibleIndex: number) => {
    insertAfterIndexRef.current = visibleIndex;
    insertFileRef.current?.click();
  }, []);

  const handleInsertDocuments = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      e.target.value = "";
      if (!picked) return;

      const formData = new FormData();
      formData.append("file", picked, picked.name || "document.pdf");

      try {
        const res = await fetch("/api/tools/pdf-session", {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as {
          sessionId?: string;
          totalPages?: number;
          error?: string;
        };
        if (!res.ok || !data.sessionId || !data.totalPages) {
          setError(ws.resolveApiError(data.error) || ws.couldNotAddDocument);
          return;
        }

        const sessionId = data.sessionId;
        const newSlots: WorkspacePageSlot[] = Array.from(
          { length: data.totalPages },
          (_, i) => ({
            id: `imp-${crypto.randomUUID()}`,
            kind: "imported" as const,
            page: i + 1,
            fileName: picked.name,
            sessionId,
          })
        );

        setPageSlots((prev) => {
          const visible = prev.filter((s) => !hiddenSlotIds.has(s.id));
          const hidden = prev.filter((s) => hiddenSlotIds.has(s.id));
          const nextVisible = [...visible];
          nextVisible.splice(
            insertAfterIndexRef.current + 1,
            0,
            ...newSlots
          );
          return [...nextVisible, ...hidden];
        });
      } catch {
        setError(ws.couldNotAddDocument);
      }
    },
    [hiddenSlotIds, ws]
  );

  /* ─── export ─── */

  const handleExport = async () => {
    if (selectedVisibleCount === 0) {
      setResultUrl(URL.createObjectURL(file));
      setCompleted(true);
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name || "document.pdf");
      if (pdfPassword) {
        formData.append("password", pdfPassword);
      }

      const hasExtraSlots = visibleSlots.some(
        (s) =>
          selectedSlotIds.has(s.id) &&
          (s.kind === "blank" || s.kind === "imported")
      );

      if (hasExtraSlots) {
        const composeSlots = visibleSlots
          .filter((s) => selectedSlotIds.has(s.id))
          .map((slot) => {
            if (slot.kind === "original")
              return { kind: "original" as const, page: slot.page };
            if (slot.kind === "blank") return { kind: "blank" as const };
            return {
              kind: "imported" as const,
              sessionId: (slot as { sessionId: string }).sessionId,
              page: slot.page,
            };
          });

        formData.append("slots", JSON.stringify(composeSlots));

        const res = await fetch("/api/tools/compose-pdf", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          await readToolApiFailure(res, ws.failedExportPdf);
        }

        const blob = await res.blob();
        setResultUrl(URL.createObjectURL(blob));
        setCompleted(true);
        return;
      }

      const pagesToExtract = visibleSlots
        .filter(
          (s): s is WorkspacePageSlot & { kind: "original" } =>
            selectedSlotIds.has(s.id) && s.kind === "original"
        )
        .map((s) => s.page);

      formData.append("pagesToExtract", JSON.stringify(pagesToExtract));

      const { blob } = await runClientOrServerPdfExport({
        tool: "extract-pdf",
        client: async () => extractPagesInBrowser(file, pagesToExtract),
        server: async () => {
          const res = await fetch("/api/tools/extract-pdf", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            await readToolApiFailure(res, ws.failedExtractPages);
          }
          return res.blob();
        },
      });

      setResultUrl(URL.createObjectURL(blob));
      setCompleted(true);
    } catch (err) {
      const prompt = passwordPromptFromError(err, file.name);
      if (prompt) {
        setPasswordPrompt({ file, ...prompt });
        setError(null);
        return;
      }
      setError(
        err instanceof Error ? err.message : ws.unexpectedError
      );
    } finally {
      setProcessing(false);
    }
  };

  /* ─── completed view ─── */

  if (completed && resultUrl) {
    return (
      <ExtractResultView
        originalFile={file}
        resultUrl={resultUrl}
        extractedCount={selectedVisibleCount}
        onStartOver={() => {
          setCompleted(false);
          setResultUrl(null);
          onReset();
        }}
      />
    );
  }

  /* ─── main UI ─── */

  return (
    <>
      {passwordPrompt && (
        <PdfPasswordModal
          fileName={passwordPrompt.fileName}
          errorMessage={passwordPrompt.errorMsg}
          loading={passwordPrompt.loading}
          onSubmit={retryWithPassword}
          onCancel={() => {
            setPasswordPrompt(null);
            onReset();
          }}
        />
      )}

      <ToolHiddenFileInput
        ref={insertFileRef}
        accept=".pdf,application/pdf"
        ariaLabel={ws.insertPdfDocuments}
        onChange={handleInsertDocuments}
      />

      {zoomSlotId !== null &&
        (() => {
          const slot = visibleSlots.find((s) => s.id === zoomSlotId);
          if (!slot) return null;
          const idx = visibleSlots.indexOf(slot);
          return (
            <PageZoomModal
              pageNum={idx + 1}
              totalPages={visibleSlots.length}
              imageUrl={slotThumbUrl(slot, thumbnails)}
              rotation={rotations[slot.id] ?? 0}
              thumbnails={visibleSlots.map((s) => slotThumbUrl(s, thumbnails) ?? "")}
              onClose={() => setZoomSlotId(null)}
              onNavigate={(n) => {
                const target = visibleSlots[n - 1];
                if (target) setZoomSlotId(target.id);
              }}
              onRotateRight={() => rotateSlot(zoomSlotId, 90)}
              onDelete={() => {
                removeSlot(zoomSlotId);
                const remaining = visibleSlots.filter((s) => s.id !== zoomSlotId);
                if (remaining.length === 0) {
                  setZoomSlotId(null);
                  return;
                }
                const nextIdx = Math.min(idx, remaining.length - 1);
                setZoomSlotId(remaining[nextIdx].id);
              }}
            />
          );
        })()}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-5">
          {/* Extract tab indicator */}
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5">
            <FileDown className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Extract</span>
          </div>

          <div className="hidden h-6 w-px bg-gray-200 sm:block" />

          {/* Select all */}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={allPagesSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => toggleSelectAll(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-blue-600"
            />
            <span className="font-medium text-gray-700">Select all</span>
          </label>

          <div className="hidden h-6 w-px bg-gray-200 sm:block" />

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-pd-muted transition-colors hover:bg-gray-100 disabled:opacity-40"
              title={ws.rotateRight}
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={removeSelected}
              disabled={selectedVisibleCount === 0}
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-35"
              title={ws.removeSelected}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Selection counter */}
          <div className="flex items-center gap-1.5">
            {selectedVisibleCount > 0 ? (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                {selectedVisibleCount} page{selectedVisibleCount !== 1 ? "s" : ""} selected
              </span>
            ) : (
              <span className="text-sm text-pd-muted">
                Click pages to select for extraction
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-pd-muted lg:inline">
              {file.name}
              <span className="ml-1.5 text-pd-muted">
                {totalPages} pages · {formatFileSize(file.size)}
              </span>
            </span>

            <button
              type="button"
              onClick={onChangeFile}
              className="hidden rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:inline"
            >
              Change file
            </button>

            <Button
              size="sm"
              onClick={handleExport}
              disabled={processing || loadingThumbs || totalPages === 0}
              className="gap-2 rounded-lg px-5 py-2 text-sm font-semibold"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  Finish
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-4 pt-3 sm:px-5">
            <ToolErrorBanner message={error} />
          </div>
        )}

        {/* ── Page grid ── */}
        <div className="bg-gray-100 px-4 py-5 sm:px-6 sm:py-6">
          {loadingThumbs && !thumbnails.some(Boolean) && (
            <div className="mb-4 flex items-center justify-center gap-2 text-sm text-pd-muted">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              Generating page previews…
            </div>
          )}

          {totalPages > 0 && (
            <>
              {truncated && (
                <p className="mb-3 text-center text-xs text-pd-muted">
                  Showing first {thumbnails.length} of {totalPages} page
                  previews.
                </p>
              )}
              <p className="mb-4 text-center text-sm text-pd-muted">
                Click pages to <strong className="text-blue-600">select</strong>{" "}
                them for extraction · Click{" "}
                <strong className="text-blue-600">+</strong> between pages to
                add documents
              </p>

              <div className="flex flex-wrap items-start justify-center gap-x-0 gap-y-4 sm:gap-x-0">
                {visibleSlots.map((slot, index) => (
                  <div key={slot.id} className="flex items-center">
                    <ExtractPageCard
                      pageNum={index + 1}
                      fileName={slotLabel(slot, file.name)}
                      thumb={slotThumbUrl(slot, thumbnails)}
                      loadingThumb={
                        loadingThumbs && !slotThumbUrl(slot, thumbnails)
                      }
                      isBlank={slot.kind === "blank"}
                      selected={selectedSlotIds.has(slot.id)}
                      rotation={rotations[slot.id] ?? 0}
                      onSelect={() => toggleSlot(slot.id)}
                      onZoom={() => setZoomSlotId(slot.id)}
                      onRotateRight={() => rotateSlot(slot.id, 90)}
                      onDuplicate={() => duplicateSlotAfter(slot.id)}
                      onRemove={() => removeSlot(slot.id)}
                    />
                    {index < visibleSlots.length - 1 && (
                      <PageInsertDivider
                        onAddBlank={() => insertBlankAfter(index)}
                        onAddDocuments={() => openInsertDocuments(index)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 bg-white px-4 py-2.5 text-center text-xs text-pd-muted sm:px-5">
          Selected pages will be extracted into a new PDF · Files auto-delete after 2 hours
        </div>
      </div>
    </>
  );
}
