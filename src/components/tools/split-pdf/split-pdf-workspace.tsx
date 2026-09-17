"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  Scissors,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/file";
import { Button } from "@/components/ui/button";
import {
  loadPdfThumbnailsBatched,
  rangesFromSplitAfter,
  rangesToFormString,
  splitAfterFromEachPage,
  splitAfterFromEveryN,
} from "@/lib/pdf/pdf-thumbnails.client";
import { ToolErrorBanner, ToolHiddenFileInput, ToolWorkspaceReadyPanel } from "@/components/tools/tool-ui";
import { useToolWorkspaceMessages } from "@/hooks/use-tool-workspace-messages";
import { PdfPasswordModal } from "@/components/tools/pdf-password-modal";
import {
  passwordPromptFromError,
  readToolApiFailure,
} from "@/lib/client/pdf-password-errors";
import { SplitDivider } from "@/components/tools/split-pdf/split-divider";
import { SplitPageCard } from "@/components/tools/split-pdf/split-page-card";
import {
  SplitExtractSurface,
  SplitExtractToolbarRow,
} from "@/components/tools/split-pdf/split-extract-surface";
import {
  SplitExtractTab,
  type SplitExtractSelectionApi,
} from "@/components/tools/split-pdf/split-extract-tab";
import { PageZoomModal } from "@/components/tools/split-pdf/page-zoom-modal";
import {
  createOriginalSlots,
  duplicateSlot,
  slotLabel,
  slotThumbUrl,
  type WorkspacePageSlot,
} from "@/components/tools/split-pdf/split-page-types";

type WorkspaceTab = "split" | "extract";

interface SplitPdfWorkspaceProps {
  file: File;
  onChangeFile: () => void;
  onReset: () => void;
}

export function SplitPdfWorkspace({ file, onChangeFile, onReset }: SplitPdfWorkspaceProps) {
  const ws = useToolWorkspaceMessages();
  const [tab, setTab] = useState<WorkspaceTab>("split");
  const [extractEpoch, setExtractEpoch] = useState(0);
  const [separatePdfs, setSeparatePdfs] = useState(false);
  const [autoEvery, setAutoEvery] = useState(false);
  const [everyN, setEveryN] = useState(1);
  const [splitAfter, setSplitAfter] = useState<Set<number>>(() => new Set());
  const [manualSplits, setManualSplits] = useState(false);
  const [pageSlots, setPageSlots] = useState<WorkspacePageSlot[]>([]);
  const [hiddenSlotIds, setHiddenSlotIds] = useState<Set<string>>(() => new Set());
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
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
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
  const extractApiRef = useRef<SplitExtractSelectionApi | null>(null);

  const fileKey = `${file.name}:${file.size}:${file.lastModified}`;

  const visibleSlots = useMemo(
    () => pageSlots.filter((s) => !hiddenSlotIds.has(s.id)),
    [pageSlots, hiddenSlotIds]
  );

  const visibleSlotIds = useMemo(
    () => visibleSlots.map((s) => s.id),
    [visibleSlots]
  );

  const splitVisibleSlots = useMemo(
    () =>
      visibleSlots.filter(
        (s): s is WorkspacePageSlot & { kind: "original" } => s.kind === "original"
      ),
    [visibleSlots]
  );

  const originalVisiblePages = useMemo(
    () => splitVisibleSlots.map((s) => s.page),
    [splitVisibleSlots]
  );

  const isDefaultSplitLayout = useMemo(
    () =>
      hiddenSlotIds.size === 0 &&
      splitVisibleSlots.length === totalPages &&
      splitVisibleSlots.every((s, i) => s.page === i + 1),
    [hiddenSlotIds.size, splitVisibleSlots, totalPages]
  );

  const splitCutPositions = useMemo(
    () => new Set([...splitAfter].map((i) => i + 1)),
    [splitAfter]
  );

  const applyAutoSplits = useCallback(
    (pages: number, every: number, useEach: boolean) => {
      const oneBased =
        useEach && every <= 1
          ? splitAfterFromEachPage(pages)
          : splitAfterFromEveryN(pages, every);
      setSplitAfter(new Set([...oneBased].map((p) => p - 1)));
    },
    []
  );

  useEffect(() => {
    setTab("split");
    setExtractEpoch((epoch) => epoch + 1);
    extractApiRef.current = null;
  }, [fileKey]);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    setLoadingThumbs(true);
    setError(null);
    setThumbnails([]);
    setTotalPages(0);
    setHiddenSlotIds(new Set());
    setPageSlots([]);
    setRotations({});
    setPdfPassword(null);

    loadPdfThumbnailsBatched(file, (thumbs, total, trunc) => {
        if (requestId !== loadRequestRef.current) return;
        setThumbnails([...thumbs]);
        setTotalPages(total);
        setTruncated(trunc);
        if (total > 0) {
          const slots = createOriginalSlots(total, fileKey);
          setPageSlots(slots);
          setSplitAfter(new Set());
          setManualSplits(false);
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
          setError(ws.resolveApiError(result.error, "errors.corruptedPdf") || ws.couldNotReadPdf);
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
          err instanceof Error ? err.message : ws.couldNotReadPdf
        );
      })
      .finally(() => {
        if (requestId === loadRequestRef.current) setLoadingThumbs(false);
      });
  }, [fileKey, file]);

  const retryWithPassword = useCallback((pw: string) => {
    if (!passwordPrompt) return;
    const { file } = passwordPrompt;
    setPasswordPrompt((prev) => prev ? { ...prev, loading: true, errorMsg: undefined } : prev);

    loadPdfThumbnailsBatched(file, (thumbs, total, trunc) => {
      setThumbnails([...thumbs]);
      setTotalPages(total);
      setTruncated(trunc);
      if (total > 0) {
        const slots = createOriginalSlots(total, fileKey);
        setPageSlots(slots);
        setSplitAfter(new Set());
        setManualSplits(false);
        setError(null);
      }
    }, pw).then((result) => {
      if (result.wrongPassword) {
        setPasswordPrompt((prev) => prev ? { ...prev, errorMsg: result.error ?? ws.incorrectPassword, loading: false } : prev);
        return;
      }
      setPdfPassword(pw);
      setPasswordPrompt(null);
      if (result.error) setError(ws.resolveApiError(result.error));
    });
  }, [passwordPrompt, ws, fileKey]);

  useEffect(() => {
    if (manualSplits || tab !== "split" || splitVisibleSlots.length === 0) return;
    if (autoEvery) {
      applyAutoSplits(splitVisibleSlots.length, everyN, everyN <= 1);
    } else {
      setSplitAfter(new Set());
    }
  }, [autoEvery, everyN, splitVisibleSlots.length, manualSplits, tab, applyAutoSplits]);

  const outputPdfCount = useMemo(() => {
    return rangesFromSplitAfter(splitVisibleSlots.length, splitCutPositions).length;
  }, [splitVisibleSlots.length, splitCutPositions]);

  const toggleSplitAfter = (afterSlotIndex: number) => {
    setManualSplits(true);
    setSplitAfter((prev) => {
      const next = new Set(prev);
      if (next.has(afterSlotIndex)) next.delete(afterSlotIndex);
      else next.add(afterSlotIndex);
      return next;
    });
  };

  const rotateSlot = (slotId: string, delta: number) => {
    setRotations((prev) => ({
      ...prev,
      [slotId]: ((prev[slotId] ?? 0) + delta + 360) % 360,
    }));
  };

  const removeSlot = (slotId: string) => {
    const visible = pageSlots.filter((s) => !hiddenSlotIds.has(s.id));
    const removedIndex = visible.findIndex((s) => s.id === slotId);

    setHiddenSlotIds((prev) => new Set(prev).add(slotId));
    extractApiRef.current?.removeSlot(slotId);

    if (removedIndex >= 0) {
      setSplitAfter((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx < removedIndex) next.add(idx);
          else if (idx > removedIndex) next.add(idx - 1);
        }
        return next;
      });
    }
  };

  const rotateSelected = (delta: number) => {
    const actions = extractApiRef.current;
    if (!actions) return;
    setRotations((prev) => {
      const next = { ...prev };
      for (const slot of visibleSlots) {
        if (actions.isSelected(slot.id)) {
          next[slot.id] = ((next[slot.id] ?? 0) + delta + 360) % 360;
        }
      }
      return next;
    });
  };

  const removeSelectedPages = () => {
    const actions = extractApiRef.current;
    if (!actions) return;
    const toRemove = visibleSlots.filter((s) => actions.isSelected(s.id));
    for (const slot of toRemove) removeSlot(slot.id);
  };

  const duplicateSlotAfter = (slotId: string) => {
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
    setRotations((prev) => ({ ...prev, [copy.id]: prev[slotId] ?? 0 }));
    extractApiRef.current?.addSlot(copy.id);
  };

  const duplicateSelected = () => {
    const actions = extractApiRef.current;
    if (!actions) return;
    const pairs: { index: number; sourceId: string; copy: WorkspacePageSlot }[] = [];
    visibleSlots.forEach((s, i) => {
      if (actions.isSelected(s.id)) {
        pairs.push({ index: i, sourceId: s.id, copy: duplicateSlot(s) });
      }
    });
    if (pairs.length === 0) return;
    pairs.sort((a, b) => b.index - a.index);

    setPageSlots((prev) => {
      const vis = prev.filter((s) => !hiddenSlotIds.has(s.id));
      const hidden = prev.filter((s) => hiddenSlotIds.has(s.id));
      const nextVisible = [...vis];
      for (const { index, copy } of pairs) {
        nextVisible.splice(index + 1, 0, copy);
      }
      return [...nextVisible, ...hidden];
    });
    setRotations((prev) => {
      const next = { ...prev };
      for (const { sourceId, copy } of pairs) {
        next[copy.id] = prev[sourceId] ?? 0;
      }
      return next;
    });
    for (const { copy } of pairs) {
      actions.addSlot(copy.id);
    }
  };

  const insertBlankAfter = (visibleIndex: number) => {
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
    extractApiRef.current?.addSlot(newSlot.id);
  };

  const openInsertDocuments = (visibleIndex: number) => {
    insertAfterIndexRef.current = visibleIndex;
    insertFileRef.current?.click();
  };

  const handleInsertDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    const formData = new FormData();
    formData.append("file", picked, picked.name || "document.pdf");

    try {
      const res = await fetch("/api/tools/pdf-session", { method: "POST", body: formData });
      const data = (await res.json()) as { sessionId?: string; totalPages?: number; error?: string };
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
        nextVisible.splice(insertAfterIndexRef.current + 1, 0, ...newSlots);
        return [...nextVisible, ...hidden];
      });
      for (const slot of newSlots) {
        extractApiRef.current?.addSlot(slot.id);
      }
    } catch {
      setError(ws.couldNotAddDocument);
    }
  };

  const handleFinish = async () => {
    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name || "document.pdf");
      if (pdfPassword) {
        formData.append("password", pdfPassword);
      }

      if (tab === "extract") {
        const actions = extractApiRef.current;
        const selected = visibleSlots.filter((s) => actions?.isSelected(s.id));
        if (selected.length === 0) {
          setResultUrl(URL.createObjectURL(file));
          setResultFilename(file.name || "document.pdf");
          setResultSize(file.size);
          setCompleted(true);
          return;
        }

        const composeSlots = selected.map((slot) => {
          if (slot.kind === "original") return { kind: "original" as const, page: slot.page };
          if (slot.kind === "blank") return { kind: "blank" as const };
          return {
            kind: "imported" as const,
            sessionId: slot.sessionId,
            page: slot.page,
          };
        });

        formData.append("slots", JSON.stringify(composeSlots));
        formData.append("separate", String(separatePdfs));

        const res = await fetch("/api/tools/compose-pdf", { method: "POST", body: formData });
        if (!res.ok) {
          await readToolApiFailure(res, ws.failedExtractPdf);
        }

        const contentType = res.headers.get("content-type") || "";
        const isZip = contentType.includes("application/zip");
        const blob = await res.blob();
        setResultUrl(URL.createObjectURL(blob));
        setResultFilename(isZip ? "extracted-pages.zip" : "extracted.pdf");
        setResultSize(blob.size);
        setCompleted(true);
        return;
      }

      const splitSlots = splitVisibleSlots;
      const ranges = rangesFromSplitAfter(splitSlots.length, splitCutPositions);

      if (!isDefaultSplitLayout) {
        if (splitSlots.length === 0) throw new Error(ws.noPagesLeftExport);
        const composeSlots = splitSlots.map((s) => ({
          kind: "original" as const,
          page: s.page,
        }));
        formData.append("slots", JSON.stringify(composeSlots));
        formData.append("splitRanges", rangesToFormString(ranges));

        const res = await fetch("/api/tools/compose-pdf", { method: "POST", body: formData });
        if (!res.ok) {
          await readToolApiFailure(res, ws.failedSplitPdf);
        }
        const contentType = res.headers.get("content-type") || "";
        const isZip = contentType.includes("application/zip");
        const blob = await res.blob();
        setResultUrl(URL.createObjectURL(blob));
        setResultFilename(isZip ? "split-pages.zip" : "split.pdf");
        setResultSize(blob.size);
        setCompleted(true);
        return;
      }

      const includedPages = originalVisiblePages;

      if (hiddenSlotIds.size > 0) {
        if (includedPages.length === 0) throw new Error(ws.noPagesLeftExport);
        formData.append("mode", "extract");
        formData.append("pages", includedPages.join(","));
      } else if (ranges.length === 1 && ranges[0].start === 1 && ranges[0].end === totalPages) {
        formData.append("mode", "extract");
        formData.append("pages", `1-${totalPages}`);
      } else if (
        splitAfter.size === totalPages - 1 &&
        everyN <= 1 &&
        autoEvery
      ) {
        formData.append("mode", "all");
      } else {
        formData.append("mode", "range");
        formData.append("ranges", rangesToFormString(ranges));
      }

      const res = await fetch("/api/tools/split-pdf", { method: "POST", body: formData });
      if (!res.ok) {
        await readToolApiFailure(res, ws.failedSplitPdf);
      }

      const contentType = res.headers.get("content-type") || "";
      const isZip = contentType.includes("application/zip");
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      setResultFilename(isZip ? "split-pages.zip" : "split.pdf");
      setResultSize(blob.size);
      setCompleted(true);
    } catch (err) {
      const prompt = passwordPromptFromError(err, file.name);
      if (prompt) {
        setPasswordPrompt({ file, ...prompt });
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : ws.unexpectedError);
    } finally {
      setProcessing(false);
    }
  };

  const finishLabel =
    outputPdfCount > 1 ? `Split (${outputPdfCount} PDFs)` : ws.splitPdf;

  if (completed && resultUrl) {
    return (
      <ToolWorkspaceReadyPanel
        description={
          resultFilename?.endsWith(".zip")
            ? ws.zipPartsReady
            : ws.documentReadyDownload
        }
        downloadUrl={resultUrl}
        downloadFilename={resultFilename || "split.pdf"}
        resultSizeBytes={resultSize}
        resetLabel={ws.splitAnotherFile}
        onReset={() => {
          setCompleted(false);
          setResultUrl(null);
          setResultSize(0);
          onReset();
        }}
      />
    );
  }

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

      {zoomSlotId !== null && (() => {
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
            onRotateLeft={() => rotateSlot(zoomSlotId, -90)}
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

      {tab === "split" ? (
        <div className="overflow-hidden rounded-xl border border-pd-border bg-pd-surface shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-pd-border bg-pd-background px-3 py-2.5 sm:px-4">
            <div className="flex rounded-lg border border-pd-border bg-pd-surface p-0.5">
              <button
                type="button"
                onClick={() => setTab("split")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                  "bg-pd-brand text-white"
                )}
              >
                <Scissors className="h-3.5 w-3.5" />
                Split
              </button>
              <button
                type="button"
                onClick={() => {
                  setExtractEpoch((epoch) => epoch + 1);
                  setTab("extract");
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                  "text-pd-muted hover:text-pd-foreground"
                )}
              >
                Extract
              </button>
            </div>

            <div className="hidden h-6 w-px bg-pd-border sm:block" />

            <label className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm">
              <input
                type="checkbox"
                checked={autoEvery}
                onChange={(e) => {
                  setManualSplits(false);
                  setAutoEvery(e.target.checked);
                }}
                className="accent-pd-brand"
              />
              <span className="text-pd-foreground">Split after every</span>
              <div className="flex items-center rounded-md border border-pd-border bg-pd-surface">
                <button
                  type="button"
                  onClick={() => {
                    setManualSplits(false);
                    setEveryN((n) => Math.max(1, n - 1));
                  }}
                  className="px-2 py-1 text-pd-muted hover:text-pd-foreground"
                  aria-label={ws.decrease}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[1.5rem] text-center text-sm font-semibold">{everyN}</span>
                <button
                  type="button"
                  onClick={() => {
                    setManualSplits(false);
                    setEveryN((n) => Math.min(totalPages || 1, n + 1));
                  }}
                  className="px-2 py-1 text-pd-muted hover:text-pd-foreground"
                  aria-label={ws.increase}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-pd-muted">pages</span>
            </label>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onChangeFile}
                className="hidden text-xs text-pd-muted hover:text-pd-brand sm:inline"
              >
                Change file
              </button>
              <Button
                size="sm"
                onClick={handleFinish}
                disabled={processing || loadingThumbs || totalPages === 0}
                className="gap-1.5"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    {finishLabel}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-pd-border bg-pd-brand-muted/40 px-3 py-2 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Scissors className="h-4 w-4 shrink-0 text-pd-brand" />
              <p className="truncate text-sm font-medium text-pd-foreground">{file.name}</p>
              <span className="shrink-0 text-xs text-pd-muted">
                {totalPages} pages · {formatFileSize(file.size)}
              </span>
            </div>
            <button
              type="button"
              onClick={onChangeFile}
              className="shrink-0 text-pd-muted hover:text-pd-foreground sm:hidden"
              aria-label={ws.changeFile}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="px-3 pt-3 sm:px-4">
              <ToolErrorBanner message={error} />
            </div>
          )}

          <div className="bg-[#e8eef5] px-3 py-4 sm:px-4 sm:py-5">
            {loadingThumbs && !thumbnails.some(Boolean) && (
              <div className="mb-3 flex items-center justify-center gap-2 text-sm text-pd-muted">
                <Loader2 className="h-4 w-4 animate-spin text-pd-brand" />
                Generating page previews…
              </div>
            )}
            {totalPages > 0 && (
              <>
                {truncated && (
                  <p className="mb-3 text-center text-xs text-pd-muted">
                    Showing first {thumbnails.length} of {totalPages} page previews.
                  </p>
                )}
                <p className="mb-3 text-center text-xs text-pd-muted">
                  Click scissors between pages — <strong>Split here</strong> / <strong>Remove split</strong>
                </p>
                <div className="flex flex-wrap items-start justify-center gap-y-3">
                  {splitVisibleSlots.map((slot, index) => {
                    const thumb = thumbnails[slot.page - 1];
                    const splitBetween = index < splitVisibleSlots.length - 1;
                    const splitActive = splitAfter.has(index);

                    return (
                      <div key={slot.id} className="flex items-start">
                        <SplitPageCard
                          pageNum={index + 1}
                          fileName={file.name}
                          thumb={thumb}
                          loadingThumb={loadingThumbs && !thumb}
                          rotation={rotations[slot.id] ?? 0}
                          mode="split"
                          onZoom={() => setZoomSlotId(slot.id)}
                          onRotateLeft={() => rotateSlot(slot.id, -90)}
                          onDuplicate={() => duplicateSlotAfter(slot.id)}
                          onRemove={() => removeSlot(slot.id)}
                        />
                        {splitBetween && (
                          <SplitDivider
                            active={splitActive}
                            onToggle={() => toggleSplitAfter(index)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="border-t border-pd-border px-3 py-2 text-center text-[11px] text-pd-muted sm:px-4">
            Rotate is preview-only · Files auto-delete after 2 hours
          </div>
        </div>
      ) : (
        <SplitExtractTab
          key={`${fileKey}:${extractEpoch}`}
          visibleSlotIds={visibleSlotIds}
        >
          {(api) => {
            extractApiRef.current = api;
            return (
              <div className="overflow-hidden rounded-xl border border-pd-border bg-pd-surface shadow-sm">
                <div className="flex flex-wrap items-center gap-3 border-b border-pd-border bg-pd-background px-3 py-2.5 sm:px-4">
                  <div className="flex rounded-lg border border-pd-border bg-pd-surface p-0.5">
                    <button
                      type="button"
                      onClick={() => setTab("split")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                        "text-pd-muted hover:text-pd-foreground"
                      )}
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      Split
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExtractEpoch((epoch) => epoch + 1);
                        setTab("extract");
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                        "bg-pd-brand text-white"
                      )}
                    >
                      Extract
                    </button>
                  </div>

                  <div className="hidden h-6 w-px bg-pd-border sm:block" />

                  <SplitExtractToolbarRow
                    api={api}
                    totalCount={visibleSlots.length}
                    separatePdfs={separatePdfs}
                    processing={processing}
                    loadingThumbs={loadingThumbs}
                    onSeparatePdfsChange={setSeparatePdfs}
                    onFinish={handleFinish}
                    onRotateLeft={() => rotateSelected(-90)}
                    onDuplicateSelected={duplicateSelected}
                    onDeleteSelected={removeSelectedPages}
                  />

                  <button
                    type="button"
                    onClick={onChangeFile}
                    className="ml-auto hidden text-xs text-pd-muted hover:text-pd-brand sm:ml-0 lg:inline"
                  >
                    Change file
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 border-b border-pd-border bg-pd-brand-muted/40 px-3 py-2 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <Scissors className="h-4 w-4 shrink-0 text-pd-brand" />
                    <p className="truncate text-sm font-medium text-pd-foreground">{file.name}</p>
                    <span className="shrink-0 text-xs text-pd-muted">
                      {totalPages} pages · {formatFileSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onChangeFile}
                    className="shrink-0 text-pd-muted hover:text-pd-foreground sm:hidden"
                    aria-label={ws.changeFile}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {error && (
                  <div className="px-3 pt-3 sm:px-4">
                    <ToolErrorBanner message={error} />
                  </div>
                )}

                <div className="bg-[#e8eef5] px-3 py-4 sm:px-4 sm:py-5">
                  {loadingThumbs && !thumbnails.some(Boolean) && (
                    <div className="mb-3 flex items-center justify-center gap-2 text-sm text-pd-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-pd-brand" />
                      Generating page previews…
                    </div>
                  )}
                  {totalPages > 0 && (
                    <>
                      {truncated && (
                        <p className="mb-3 text-center text-xs text-pd-muted">
                          Showing first {thumbnails.length} of {totalPages} page previews.
                        </p>
                      )}
                      <SplitExtractSurface
                        api={api}
                        fileName={file.name}
                        visibleSlots={visibleSlots}
                        thumbnails={thumbnails}
                        loadingThumbs={loadingThumbs}
                        rotations={rotations}
                        onZoom={setZoomSlotId}
                        onRotateLeft={(slotId) => rotateSlot(slotId, -90)}
                        onDuplicateAfter={duplicateSlotAfter}
                        onRemove={removeSlot}
                        onInsertBlankAfter={insertBlankAfter}
                        onInsertDocumentsAfter={openInsertDocuments}
                      />
                    </>
                  )}
                </div>

                <div className="border-t border-pd-border px-3 py-2 text-center text-[11px] text-pd-muted sm:px-4">
                  Rotate is preview-only · Files auto-delete after 2 hours
                </div>
              </div>
            );
          }}
        </SplitExtractTab>
      )}
    </>
  );
}
