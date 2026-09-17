"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useToolWorkspaceMessages } from "@/hooks/use-tool-workspace-messages";
import { loadPdfDocumentPreview } from "@/lib/pdf/pdf-thumbnails.client";
import { ToolErrorBanner, ToolHiddenFileInput, ToolWorkspaceReadyPanel } from "@/components/tools/tool-ui";
import { PageZoomModal } from "@/components/tools/split-pdf/page-zoom-modal";
import { PageInsertDivider } from "@/components/tools/split-pdf/page-insert-divider";
import { SplitPageCard } from "@/components/tools/split-pdf/split-page-card";
import { MergeAddPlaceholder } from "@/components/tools/merge-pdf/merge-add-placeholder";
import { MergeFileCard } from "@/components/tools/merge-pdf/merge-file-card";
import { MergeInsertDivider } from "@/components/tools/merge-pdf/merge-insert-divider";
import {
  MergeSelectionBar,
  fileLabelColor,
  type MergeLayoutView,
  type MergeSortOrder,
} from "@/components/tools/merge-pdf/merge-selection-bar";
import { MergeFileListRow } from "@/components/tools/merge-pdf/merge-file-list-row";
import { MergePageListRow } from "@/components/tools/merge-pdf/merge-page-list-row";
import {
  MergeToolbar,
  type MergeViewTab,
} from "@/components/tools/merge-pdf/merge-toolbar";
import {
  buildPageSlotsFromItems,
  createMergeFileItem,
  duplicateMergeFileItem,
  duplicatePageSlot,
  findMainFileItemId,
  mergePageSlotThumb,
  pageSlotsToComposeSlots,
  type MergeFileItem,
  type MergePageSlot,
} from "@/components/tools/merge-pdf/merge-file-types";
import {
  passwordPromptFromError,
  readToolApiFailure,
  ToolApiPasswordError,
} from "@/lib/client/pdf-password-errors";
import { PdfPasswordModal } from "@/components/tools/pdf-password-modal";
import {
  allowMergeFilePreview,
  rejectMergeFilePreview,
  runMergeFilePreview,
  type MergePasswordPromptState,
} from "@/components/tools/merge-pdf/merge-pdf-preview";
import { runClientOrServerPdfExport } from "@/lib/pdf/client-pdf-export";
import {
  buildSessionBufferMap,
  composePdfFromSlotsInBrowser,
  mergePdfFilesInBrowser,
} from "@/lib/pdf/pdf-browser";

interface MergePdfWorkspaceProps {
  initialFiles: File[];
  onEmpty: () => void;
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function sortMergeItems(items: MergeFileItem[], order: MergeSortOrder): MergeFileItem[] {
  return [...items].sort((a, b) => {
    const cmp = a.file.name.localeCompare(b.file.name, undefined, { sensitivity: "base" });
    return order === "asc" ? cmp : -cmp;
  });
}

function sortPageSlots(slots: MergePageSlot[], order: MergeSortOrder): MergePageSlot[] {
  return [...slots].sort((a, b) => {
    const nameA = a.kind === "page" ? a.fileName : "Blank page";
    const nameB = b.kind === "page" ? b.fileName : "Blank page";
    let cmp = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    if (cmp === 0 && a.kind === "page" && b.kind === "page") {
      cmp = a.pageNum - b.pageNum;
    }
    return order === "asc" ? cmp : -cmp;
  });
}

export function MergePdfWorkspace({
  initialFiles,
  onEmpty,
}: MergePdfWorkspaceProps) {
  const ws = useToolWorkspaceMessages();
  const [items, setItems] = useState<MergeFileItem[]>(() =>
    initialFiles.filter(isPdfFile).map(createMergeFileItem)
  );
  const [pageSlots, setPageSlots] = useState<MergePageSlot[]>([]);
  const [pageSlotsCustomized, setPageSlotsCustomized] = useState(false);
  const [viewTab, setViewTab] = useState<MergeViewTab>("files");
  const [layoutView, setLayoutView] = useState<MergeLayoutView>("grid");
  const [sortOrder, setSortOrder] = useState<MergeSortOrder>("asc");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(() => new Set());
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(() => new Set());
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [zoomFileId, setZoomFileId] = useState<string | null>(null);
  const [zoomPageId, setZoomPageId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const insertAfterFileIndexRef = useRef<number | null>(null);
  const insertAfterPageIndexRef = useRef<number | null>(null);
  const insertModeRef = useRef<"files" | "pages">("files");
  const insertFileRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const incorrectPasswordRef = useRef(ws.incorrectPassword);
  incorrectPasswordRef.current = ws.incorrectPassword;
  const [passwordPrompt, setPasswordPrompt] = useState<MergePasswordPromptState>(null);
  const passwordPromptRef = useRef(passwordPrompt);
  passwordPromptRef.current = passwordPrompt;
  const cancelInFlightRef = useRef(false);

  const handleExportPasswordError = useCallback((err: unknown): boolean => {
    const prompt = passwordPromptFromError(err, "");
    const fileName =
      err instanceof ToolApiPasswordError
        ? err.fileName
        : prompt?.fileName;
    if (!fileName && !(err instanceof ToolApiPasswordError) && !prompt) {
      return false;
    }

    const item =
      itemsRef.current.find((entry) => entry.file.name === fileName) ??
      itemsRef.current.find((entry) => !entry.password);
    if (!item) return false;

    setPasswordPrompt({
      itemId: item.id,
      file: item.file,
      fileName: fileName || item.file.name,
      errorMsg:
        err instanceof ToolApiPasswordError && err.code === "wrong_password"
          ? err.message
          : prompt?.errorMsg,
      loading: false,
    });
    setError(null);
    return true;
  }, []);

  const notifyIfEmpty = useCallback(
    (nextItems: MergeFileItem[]) => {
      if (nextItems.length === 0) {
        setPasswordPrompt(null);
        onEmpty();
      }
    },
    [onEmpty]
  );

  const queuePreview = useCallback((itemId: string, file: File, password?: string) => {
    void runMergeFilePreview(
      itemId,
      file,
      {
        incorrectPassword: incorrectPasswordRef.current,
        isItemActive: (id) => itemsRef.current.some((item) => item.id === id),
        onPasswordRequired: (prompt) => {
          if (cancelInFlightRef.current) return;
          setError(null);
          setPasswordPrompt((prev) =>
            prev?.itemId === prompt.itemId ? prev : prompt
          );
        },
        onPasswordWrong: (prompt) => {
          if (cancelInFlightRef.current) return;
          setPasswordPrompt(prompt);
        },
        onPreviewReady: (id, update) => {
          if (update.pageCount && update.pageCount > 0) {
            setPasswordPrompt((prev) => (prev?.itemId === id ? null : prev));
          }
          setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...update } : item))
          );
        },
        onPreviewError: (message) => setError(message),
      },
      password
    );
  }, []);

  const initialFilesRef = useRef(initialFiles);
  useEffect(() => {
    for (const file of initialFilesRef.current.filter(isPdfFile)) {
      allowMergeFilePreview(file);
      const itemId = itemsRef.current.find((item) => item.file === file)?.id;
      if (itemId) queuePreview(itemId, file);
    }
    // Intentionally mount-only: previews must not restart on re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasswordCancel = useCallback(() => {
    const prompt = passwordPromptRef.current;
    if (!prompt) return;
    cancelInFlightRef.current = true;
    rejectMergeFilePreview(prompt.file);
    setPasswordPrompt(null);
    setError(null);
    const next = itemsRef.current.filter((item) => item.id !== prompt.itemId);
    setItems(next);
    if (next.length === 0) {
      onEmpty();
    }
    queueMicrotask(() => {
      cancelInFlightRef.current = false;
    });
  }, [onEmpty]);

  const handlePasswordSubmit = useCallback(
    (password: string) => {
      const prompt = passwordPromptRef.current;
      if (!prompt) return;
      setPasswordPrompt((prev) =>
        prev ? { ...prev, loading: true, errorMsg: undefined } : prev
      );
      queuePreview(prompt.itemId, prompt.file, password);
    },
    [queuePreview]
  );

  const allItemsLoaded =
    items.length > 0 && items.every((i) => !i.loadingThumb && i.pageCount > 0);

  useEffect(() => {
    if (!allItemsLoaded || pageSlotsCustomized) return;
    const built = buildPageSlotsFromItems(items);
    setPageSlots(built);
    setSelectedPageIds(new Set());
  }, [items, allItemsLoaded, pageSlotsCustomized]);

  useEffect(() => {
    setSelectedFileIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (items.some((i) => i.id === id)) next.add(id);
      }
      return next;
    });
  }, [items]);

  const selectedFileCount = items.filter((i) => selectedFileIds.has(i.id)).length;
  const allFilesSelected =
    items.length > 0 && items.every((i) => selectedFileIds.has(i.id));
  const someFilesSelected = selectedFileCount > 0 && !allFilesSelected;

  const selectedPageCount = pageSlots.filter((s) => selectedPageIds.has(s.id)).length;
  const allPagesSelected =
    pageSlots.length > 0 && pageSlots.every((s) => selectedPageIds.has(s.id));
  const somePagesSelected = selectedPageCount > 0 && !allPagesSelected;

  const selectedPagesInFiles = items
    .filter((i) => selectedFileIds.has(i.id))
    .reduce((sum, i) => sum + i.pageCount, 0);

  const toolbarSelectedCount = viewTab === "pages" ? selectedPageCount : selectedFileCount;
  const toolbarTotalCount = viewTab === "pages" ? pageSlots.length : items.length;

  const addFilesAt = (newFiles: File[], afterFileIndex: number | null) => {
    const pdfs = newFiles.filter(isPdfFile);
    if (pdfs.length === 0) {
      setError(ws.pdfOnly);
      return;
    }

    const newItems = pdfs.map(createMergeFileItem);
    setItems((prev) => {
      if (afterFileIndex === null || afterFileIndex < 0) return [...prev, ...newItems];
      const next = [...prev];
      next.splice(afterFileIndex + 1, 0, ...newItems);
      return next;
    });
    for (const item of newItems) {
      allowMergeFilePreview(item.file);
      queuePreview(item.id, item.file);
    }
    setPageSlotsCustomized(false);
    setError(null);
    setCompleted(false);
    setResultUrl(null);
  };

  const insertPagesFromFiles = async (newFiles: File[], afterPageIndex: number | null) => {
    const pdfs = newFiles.filter(isPdfFile);
    if (pdfs.length === 0) {
      setError(ws.pdfOnly);
      return;
    }

    const newItems: MergeFileItem[] = [];
    const newSlots: MergePageSlot[] = [];

    for (const file of pdfs) {
      const preview = await loadPdfDocumentPreview(file);
      if (preview.passwordRequired) {
        continue;
      }
      if (!preview.sessionId || preview.totalPages === 0) {
        setError(preview.error ?? ws.couldNotAddDocument);
        continue;
      }
      const item = createMergeFileItem(file);
      item.loadingThumb = false;
      item.pageCount = preview.totalPages;
      item.sessionId = preview.sessionId;
      item.thumbUrl = preview.thumbUrl;
      newItems.push(item);

      for (let p = 1; p <= preview.totalPages; p++) {
        newSlots.push({
          id: `${item.id}-p${p}`,
          kind: "page",
          fileItemId: item.id,
          pageNum: p,
          fileName: file.name,
          sessionId: preview.sessionId,
          file,
        });
      }
    }

    if (newItems.length === 0) return;

    setItems((prev) => [...prev, ...newItems]);
    setPageSlots((prev) => {
      const next = [...prev];
      const at =
        afterPageIndex === null || afterPageIndex < 0
          ? next.length
          : afterPageIndex + 1;
      next.splice(at, 0, ...newSlots);
      return next;
    });
    setPageSlotsCustomized(true);
  };

  const openFileInsertAt = (index: number | null) => {
    insertModeRef.current = "files";
    insertAfterFileIndexRef.current = index;
    insertAfterPageIndexRef.current = null;
    insertFileRef.current?.click();
  };

  const openPageInsertAt = (index: number | null) => {
    insertModeRef.current = "pages";
    insertAfterPageIndexRef.current = index;
    insertAfterFileIndexRef.current = null;
    insertFileRef.current?.click();
  };

  const handleInsertFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;

    const files = Array.from(list);
    const mode = insertModeRef.current;
    const afterFileIndex = insertAfterFileIndexRef.current;
    const afterPageIndex = insertAfterPageIndexRef.current;

    e.target.value = "";
    insertAfterFileIndexRef.current = null;
    insertAfterPageIndexRef.current = null;

    if (mode === "pages") {
      await insertPagesFromFiles(files, afterPageIndex);
      return;
    }

    addFilesAt(files, afterFileIndex);
  };

  const insertBlankPageAfter = (pageIndex: number) => {
    const blank: MergePageSlot = { id: `blank-${crypto.randomUUID()}`, kind: "blank" };
    setPageSlots((prev) => {
      const next = [...prev];
      next.splice(pageIndex + 1, 0, blank);
      return next;
    });
    setPageSlotsCustomized(true);
    setSelectedPageIds((prev) => new Set(prev).add(blank.id));
  };

  const removeFile = (id: string) => {
    const removed = items.find((i) => i.id === id);
    if (removed) rejectMergeFilePreview(removed.file);
    setPasswordPrompt((prev) => (prev?.itemId === id ? null : prev));
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    notifyIfEmpty(next);
    setPageSlotsCustomized(false);
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const removePageSlot = (id: string) => {
    setPageSlots((prev) => prev.filter((s) => s.id !== id));
    setPageSlotsCustomized(true);
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const duplicateFile = (id: string) => {
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    const copy = duplicateMergeFileItem(items[index]);
    setItems((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setPageSlotsCustomized(false);
    setSelectedFileIds((prev) => new Set(prev).add(copy.id));
  };

  const duplicatePageSlotAfter = (id: string) => {
    const index = pageSlots.findIndex((s) => s.id === id);
    if (index < 0) return;
    const copy = duplicatePageSlot(pageSlots[index]);
    setPageSlots((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setPageSlotsCustomized(true);
    setRotations((prev) => ({ ...prev, [copy.id]: prev[id] ?? 0 }));
    setSelectedPageIds((prev) => new Set(prev).add(copy.id));
  };

  const rotateSelected = (delta: number) => {
    if (viewTab === "pages") {
      setRotations((prev) => {
        const next = { ...prev };
        for (const slot of pageSlots) {
          if (selectedPageIds.has(slot.id)) {
            next[slot.id] = ((next[slot.id] ?? 0) + delta + 360) % 360;
          }
        }
        return next;
      });
      return;
    }
    setRotations((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (selectedFileIds.has(item.id)) {
          next[item.id] = ((next[item.id] ?? 0) + delta + 360) % 360;
        }
      }
      return next;
    });
  };

  const handleSort = () => {
    const nextOrder: MergeSortOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(nextOrder);
    if (viewTab === "files") {
      setItems((prev) => sortMergeItems(prev, nextOrder));
      setPageSlotsCustomized(false);
    } else {
      setPageSlots((prev) => sortPageSlots(prev, nextOrder));
      setPageSlotsCustomized(true);
    }
  };

  const deleteSelected = () => {
    if (viewTab === "pages") {
      const toRemove = new Set(pageSlots.filter((s) => selectedPageIds.has(s.id)).map((s) => s.id));
      setPageSlots((prev) => prev.filter((s) => !toRemove.has(s.id)));
      setPageSlotsCustomized(true);
      setSelectedPageIds(new Set());
      return;
    }
    const toRemove = new Set(items.filter((i) => selectedFileIds.has(i.id)).map((i) => i.id));
    for (const id of toRemove) {
      const removed = items.find((item) => item.id === id);
      if (removed) rejectMergeFilePreview(removed.file);
    }
    setPasswordPrompt((prev) => (prev && toRemove.has(prev.itemId) ? null : prev));
    const next = items.filter((i) => !toRemove.has(i.id));
    setItems(next);
    notifyIfEmpty(next);
    setPageSlotsCustomized(false);
    setSelectedFileIds(new Set());
  };

  const promptNextLockedFile = () => {
    const locked = items.find(
      (item) => item.pageCount === 0 && !item.loadingThumb
    );
    if (!locked) return false;
    setError(ws.enterPasswordBeforeExport);
    return true;
  };

  const handleExport = async () => {
    if (!allItemsLoaded) {
      if (promptNextLockedFile()) return;
      setError(ws.waitForFilesLoading);
      return;
    }

    if (pageSlots.length > 0) {
      const mainId = findMainFileItemId(pageSlots);
      const mainSlot = pageSlots.find(
        (s): s is MergePageSlot & { kind: "page" } => s.kind === "page"
      );
      if (!mainId || !mainSlot) {
        setError(ws.addPageToMerge);
        return;
      }

      const mainItem = items.find((item) => item.id === mainId);

      setProcessing(true);
      setError(null);
      try {
        const composeSlots = pageSlotsToComposeSlots(pageSlots, mainId);
        const importedEntries = pageSlots
          .filter((s): s is MergePageSlot & { kind: "page" } => s.kind === "page")
          .map((s) => ({ sessionId: s.sessionId, file: s.file }));

        const { blob } = await runClientOrServerPdfExport({
          tool: "merge-pdf-compose",
          client: async () =>
            composePdfFromSlotsInBrowser(
              mainSlot.file,
              composeSlots,
              await buildSessionBufferMap(importedEntries)
            ),
          server: async () => {
            const formData = new FormData();
            formData.append("file", mainSlot.file, mainSlot.file.name);
            formData.append("slots", JSON.stringify(composeSlots));
            if (mainItem?.password) formData.append("password", mainItem.password);
            const res = await fetch("/api/tools/compose-pdf", { method: "POST", body: formData });
            if (!res.ok) {
              await readToolApiFailure(res, ws.failedMergePdf);
            }
            return res.blob();
          },
        });
        setResultUrl(URL.createObjectURL(blob));
        setResultSize(blob.size);
        setCompleted(true);
      } catch (err) {
        if (!handleExportPasswordError(err)) {
          setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        }
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (items.length < 2) {
      setError("Add at least 2 PDF files to merge.");
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const { blob } = await runClientOrServerPdfExport({
        tool: "merge-pdf",
        client: async () => mergePdfFilesInBrowser(items.map((item) => item.file)),
        server: async () => {
          const formData = new FormData();
          items.forEach((item) => formData.append("files", item.file, item.file.name));
          formData.append(
            "passwords",
            JSON.stringify(items.map((item) => item.password ?? null))
          );
          formData.append("options", JSON.stringify({}));
          const res = await fetch("/api/tools/merge-pdf", { method: "POST", body: formData });
          if (!res.ok) {
            await readToolApiFailure(res, ws.failedMergePdf);
          }
          return res.blob();
        },
      });
      setResultUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);
      setCompleted(true);
    } catch (err) {
      if (!handleExportPasswordError(err)) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const zoomPage = zoomPageId ? pageSlots.find((s) => s.id === zoomPageId) : null;

  if (completed && resultUrl) {
    return (
      <ToolWorkspaceReadyPanel
        title={ws.pdfsMerged}
        description={ws.mergedDocumentReady}
        downloadUrl={resultUrl}
        downloadFilename="merged.pdf"
        downloadLabel={ws.downloadMergedPdf}
        resultSizeBytes={resultSize}
        resetLabel={ws.mergeMoreFiles}
        onReset={() => {
          setCompleted(false);
          setResultUrl(null);
          setResultSize(0);
          onEmpty();
        }}
      />
    );
  }

  return (
    <>
      <ToolHiddenFileInput
        ref={insertFileRef}
        accept=".pdf,application/pdf"
        multiple
        ariaLabel="Add PDF files"
        onChange={handleInsertFiles}
      />

      {zoomPage && (
        <PageZoomModal
          pageNum={pageSlots.findIndex((s) => s.id === zoomPage.id) + 1}
          totalPages={pageSlots.length}
          imageUrl={mergePageSlotThumb(zoomPage)}
          rotation={rotations[zoomPage.id] ?? 0}
          thumbnails={pageSlots.map((s) => mergePageSlotThumb(s) ?? "")}
          onClose={() => setZoomPageId(null)}
          onNavigate={(n) => {
            const target = pageSlots[n - 1];
            if (target) setZoomPageId(target.id);
          }}
          onRotateLeft={() => {
            if (!zoomPage) return;
            setRotations((prev) => ({
              ...prev,
              [zoomPage.id]: ((prev[zoomPage.id] ?? 0) - 90 + 360) % 360,
            }));
          }}
          onRotateRight={() => {
            if (!zoomPage) return;
            setRotations((prev) => ({
              ...prev,
              [zoomPage.id]: ((prev[zoomPage.id] ?? 0) + 90) % 360,
            }));
          }}
        />
      )}

      {passwordPrompt && (
        <PdfPasswordModal
          fileName={passwordPrompt.fileName}
          errorMessage={passwordPrompt.errorMsg}
          loading={passwordPrompt.loading}
          onSubmit={handlePasswordSubmit}
          onCancel={handlePasswordCancel}
        />
      )}

      {zoomFileId && (() => {
        const item = items.find((i) => i.id === zoomFileId);
        if (!item) return null;
        return (
          <PageZoomModal
            pageNum={1}
            totalPages={1}
            imageUrl={item.thumbUrl}
            rotation={rotations[item.id] ?? 0}
            onClose={() => setZoomFileId(null)}
            onRotateLeft={() => {
              setRotations((prev) => ({
                ...prev,
                [item.id]: ((prev[item.id] ?? 0) - 90 + 360) % 360,
              }));
            }}
            onRotateRight={() => {
              setRotations((prev) => ({
                ...prev,
                [item.id]: ((prev[item.id] ?? 0) + 90) % 360,
              }));
            }}
          />
        );
      })()}

      <div className="overflow-hidden rounded-xl border border-pd-border bg-pd-surface shadow-sm">
        <div className="border-b border-pd-border bg-pd-background px-3 py-2.5 sm:px-4">
          <MergeToolbar
            viewTab={viewTab}
            selectedCount={toolbarSelectedCount}
            totalCount={toolbarTotalCount}
            processing={processing}
            canExport={allItemsLoaded ? pageSlots.length >= 1 : items.length >= 2}
            hideSelectionText
            onViewTabChange={setViewTab}
            onAddDocuments={() =>
              viewTab === "pages" ? openPageInsertAt(null) : openFileInsertAt(null)
            }
            onAddBlankPage={
              viewTab === "pages" ? () => insertBlankPageAfter(pageSlots.length - 1) : undefined
            }
            onRotateLeft={() => rotateSelected(-90)}
            onRotateRight={() => rotateSelected(90)}
            onDeleteSelected={deleteSelected}
            onExport={handleExport}
          />
        </div>

        <MergeSelectionBar
          label={
            viewTab === "pages"
              ? `${selectedPageCount} page${selectedPageCount === 1 ? "" : "s"} selected`
              : `${selectedPagesInFiles} page${selectedPagesInFiles === 1 ? "" : "s"} selected`
          }
          allSelected={viewTab === "pages" ? allPagesSelected : allFilesSelected}
          someSelected={viewTab === "pages" ? somePagesSelected : someFilesSelected}
          layoutView={layoutView}
          sortOrder={sortOrder}
          onSort={handleSort}
          onLayoutChange={setLayoutView}
          onSelectAll={(checked) => {
            if (viewTab === "pages") {
              setSelectedPageIds(
                checked ? new Set(pageSlots.map((s) => s.id)) : new Set()
              );
            } else {
              setSelectedFileIds(
                checked ? new Set(items.map((i) => i.id)) : new Set()
              );
            }
          }}
          trailing={
            <button
              type="button"
              onClick={() => {
                for (const item of items) {
                  rejectMergeFilePreview(item.file);
                }
                setPasswordPrompt(null);
                setItems([]);
                onEmpty();
              }}
              className="text-xs text-pd-muted hover:text-pd-brand sm:mr-2"
            >
              Clear all
            </button>
          }
        />

        {error && (
          <div className="px-3 pt-3 sm:px-4">
            <ToolErrorBanner message={error} />
          </div>
        )}

        <div className="bg-[#e8eef5] px-3 py-4 sm:px-4 sm:py-5">
          {viewTab === "files" && layoutView === "grid" && (
            <div className="flex flex-wrap items-end justify-center gap-y-4 gap-x-0">
              {items.map((item, index) => (
                <div key={item.id} className="flex items-end">
                  <MergeFileCard
                    fileName={item.file.name}
                    pageCount={item.pageCount}
                    thumb={item.thumbUrl}
                    loadingThumb={item.loadingThumb}
                    rotation={rotations[item.id] ?? 0}
                    labelColorClass={fileLabelColor(index)}
                    selected={selectedFileIds.has(item.id)}
                    onSelect={() => {
                      setSelectedFileIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    onZoom={() => setZoomFileId(item.id)}
                    onRotateLeft={() =>
                      setRotations((prev) => ({
                        ...prev,
                        [item.id]: ((prev[item.id] ?? 0) - 90 + 360) % 360,
                      }))
                    }
                    onDuplicate={() => duplicateFile(item.id)}
                    onRemove={() => removeFile(item.id)}
                  />
                  <MergeInsertDivider onAddDocuments={() => openFileInsertAt(index)} />
                </div>
              ))}
              <MergeAddPlaceholder onClick={() => openFileInsertAt(null)} />
            </div>
          )}

          {viewTab === "files" && layoutView === "list" && (
            <div className="mx-auto max-w-2xl space-y-2">
              {items.map((item) => (
                <MergeFileListRow
                  key={item.id}
                  item={item}
                  selected={selectedFileIds.has(item.id)}
                  rotation={rotations[item.id] ?? 0}
                  onSelect={() => {
                    setSelectedFileIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    });
                  }}
                  onRotateLeft={() =>
                    setRotations((prev) => ({
                      ...prev,
                      [item.id]: ((prev[item.id] ?? 0) - 90 + 360) % 360,
                    }))
                  }
                  onDuplicate={() => duplicateFile(item.id)}
                  onRemove={() => removeFile(item.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => openFileInsertAt(null)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-pd-brand/35 bg-white/50 py-3 text-sm font-medium text-pd-muted hover:border-pd-brand hover:text-pd-brand"
              >
                + Add PDF files
              </button>
            </div>
          )}

          {viewTab === "pages" && layoutView === "grid" && (
            <>
              {pageSlots.length === 0 && (
                <p className="py-8 text-center text-sm text-pd-muted">
                  {allItemsLoaded ? "No pages to show." : "Loading page previews…"}
                </p>
              )}

              <div
                className={cn(
                  "flex flex-wrap items-center justify-center gap-y-3",
                  pageSlots.length > 0 && "gap-x-0"
                )}
              >
                {pageSlots.map((slot, index) => (
                  <div key={slot.id} className="flex items-center">
                    <SplitPageCard
                      pageNum={index + 1}
                      fileName={slot.kind === "page" ? slot.fileName : "Blank page"}
                      thumb={mergePageSlotThumb(slot)}
                      loadingThumb={slot.kind === "page" && !mergePageSlotThumb(slot)}
                      isBlank={slot.kind === "blank"}
                      rotation={rotations[slot.id] ?? 0}
                      mode="extract"
                      selected={selectedPageIds.has(slot.id)}
                      onSelect={() => {
                        setSelectedPageIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(slot.id)) next.delete(slot.id);
                          else next.add(slot.id);
                          return next;
                        });
                      }}
                      onZoom={() => setZoomPageId(slot.id)}
                      onRotateLeft={() =>
                        setRotations((prev) => ({
                          ...prev,
                          [slot.id]: ((prev[slot.id] ?? 0) - 90 + 360) % 360,
                        }))
                      }
                      onDuplicate={() => duplicatePageSlotAfter(slot.id)}
                      onRemove={() => removePageSlot(slot.id)}
                    />
                    <PageInsertDivider
                      onAddBlank={() => insertBlankPageAfter(index)}
                      onAddDocuments={() => openPageInsertAt(index)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {viewTab === "pages" && layoutView === "list" && (
            <div className="mx-auto max-w-2xl space-y-2">
              {pageSlots.length === 0 && (
                <p className="py-8 text-center text-sm text-pd-muted">
                  {allItemsLoaded ? "No pages to show." : "Loading page previews…"}
                </p>
              )}
              {pageSlots.map((slot, index) => (
                <MergePageListRow
                  key={slot.id}
                  slot={slot}
                  index={index}
                  selected={selectedPageIds.has(slot.id)}
                  rotation={rotations[slot.id] ?? 0}
                  onSelect={() => {
                    setSelectedPageIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(slot.id)) next.delete(slot.id);
                      else next.add(slot.id);
                      return next;
                    });
                  }}
                  onRotateLeft={() =>
                    setRotations((prev) => ({
                      ...prev,
                      [slot.id]: ((prev[slot.id] ?? 0) - 90 + 360) % 360,
                    }))
                  }
                  onDuplicate={() => duplicatePageSlotAfter(slot.id)}
                  onRemove={() => removePageSlot(slot.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-pd-border px-3 py-2 text-center text-[11px] text-pd-muted sm:px-4">
          Page order follows grid sequence · Rotate is preview-only · Files auto-delete after 2 hours
        </div>
      </div>
    </>
  );
}
