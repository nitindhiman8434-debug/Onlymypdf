"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/file";
import { Button } from "@/components/ui/button";
import {
  loadPdfDocumentPreview,
  loadPdfThumbnailsBatched,
  pageThumbFromSession,
} from "@/lib/pdf/pdf-thumbnails.client";
import { PdfPasswordModal } from "@/components/tools/pdf-password-modal";
import {
  passwordPromptFromError,
  readToolApiFailure,
} from "@/lib/client/pdf-password-errors";
import { clickToNorm } from "@/lib/pdf/pdf-coordinates";
import { ToolErrorBanner, ToolHiddenFileInput } from "@/components/tools/tool-ui";
import { useToolWorkspaceMessages } from "@/hooks/use-tool-workspace-messages";
import { SignatureCreateModal } from "@/components/tools/sign-pdf/signature-create-modal";
import { SignPageInsertDivider } from "@/components/tools/sign-pdf/sign-page-insert-divider";
import { SignPageThumb } from "@/components/tools/sign-pdf/sign-page-thumb";
import {
  SignImageAnnotation,
  type ResizeHandle,
} from "@/components/tools/sign-pdf/sign-image-annotation";
import { SignSignaturesDropdown } from "@/components/tools/sign-pdf/sign-signatures-dropdown";
import { SignThumbScrollPanel } from "@/components/tools/sign-pdf/sign-thumb-scroll-panel";
import {
  createOriginalSlots,
  duplicateSlot,
  slotThumbUrl,
  type WorkspacePageSlot,
} from "@/components/tools/split-pdf/split-page-types";
import type { ComposeSlot } from "@/lib/services/pdf-compose.service";
import type {
  PlacedAnnotation,
  SavedSignature,
  SignAnnotationPayload,
  SignTool,
} from "@/components/tools/sign-pdf/sign-pdf-types";

function workspaceSlotsToCompose(slots: WorkspacePageSlot[]): ComposeSlot[] {
  return slots.map((slot) => {
    if (slot.kind === "blank") return { kind: "blank" as const };
    if (slot.kind === "original") return { kind: "original" as const, page: slot.page };
    return { kind: "imported" as const, sessionId: slot.sessionId, page: slot.page };
  });
}

function isDefaultSlotOrder(slots: WorkspacePageSlot[], totalPages: number): boolean {
  if (slots.length !== totalPages) return false;
  return slots.every((s, i) => s.kind === "original" && s.page === i + 1);
}

const CANVAS_RENDER_WIDTH = 880;
const DEFAULT_SIG_WIDTH_NORM = 0.22;
const DEFAULT_SIG_HEIGHT_NORM = 0.08;
const DEFAULT_TEXT_HEIGHT_NORM = 0.035;
const DEFAULT_CHECK_SIZE_NORM = 0.035;
const MIN_ANNOTATION_WIDTH_NORM = 0.04;
const MIN_ANNOTATION_HEIGHT_NORM = 0.025;

interface SignPdfWorkspaceProps {
  file: File;
  onReset: () => void;
  onComplete: (result: { url: string; filename: string; size: number }) => void;
}

function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function SignPdfWorkspace({ file, onReset, onComplete }: SignPdfWorkspaceProps) {
  const ws = useToolWorkspaceMessages();
  const [sessionId, setSessionId] = useState("");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageSlots, setPageSlots] = useState<WorkspacePageSlot[]>([]);
  const [slotRotations, setSlotRotations] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tool, setTool] = useState<SignTool>("select");
  const [annotations, setAnnotations] = useState<PlacedAnnotation[]>([]);
  const [history, setHistory] = useState<PlacedAnnotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [pendingSignature, setPendingSignature] = useState<SavedSignature | null>(null);
  const [signaturesOpen, setSignaturesOpen] = useState(false);
  const [modalKind, setModalKind] = useState<"signature" | "initials" | null>(null);
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10));
  const selectedDate = useMemo(() => formatDate(new Date(dateIso + "T12:00:00")), [dateIso]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfPassword, setPdfPassword] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    file: File;
    fileName: string;
    errorMsg?: string;
    loading?: boolean;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const insertFileRef = useRef<HTMLInputElement>(null);
  const insertAfterIndexRef = useRef(0);
  const loadRef = useRef(0);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    id: string;
    handle: ResizeHandle;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const fileKey = `${file.name}:${file.size}:${file.lastModified}`;

  const visibleSlots = useMemo(() => pageSlots, [pageSlots]);

  const currentSlot = useMemo(() => {
    const idx = currentPage - 1;
    return visibleSlots[idx] ?? null;
  }, [visibleSlots, currentPage]);

  const canvasUrl = useMemo(() => {
    if (!currentSlot) return "";
    if (currentSlot.kind === "blank") return "";
    if (currentSlot.kind === "original" && sessionId) {
      return pageThumbFromSession(sessionId, currentSlot.page, CANVAS_RENDER_WIDTH);
    }
    if (currentSlot.kind === "imported") {
      return `/api/tools/pdf-thumb?session=${encodeURIComponent(currentSlot.sessionId)}&page=${currentSlot.page}&width=${CANVAS_RENDER_WIDTH}`;
    }
    return slotThumbUrl(currentSlot, thumbnails) ?? "";
  }, [currentSlot, sessionId, thumbnails]);

  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === currentPage),
    [annotations, currentPage]
  );

  const bumpAnnotationPagesAfter = useCallback((afterIndex: number, delta: number) => {
    if (delta === 0) return;
    setAnnotations((prev) =>
      prev.map((a) => (a.page > afterIndex + 1 ? { ...a, page: a.page + delta } : a))
    );
    setHistory((prev) =>
      prev.map((snap) =>
        snap.map((a) => (a.page > afterIndex + 1 ? { ...a, page: a.page + delta } : a))
      )
    );
  }, []);

  const remapAnnotationsOnDelete = useCallback((deletedPage: number) => {
    setAnnotations((prev) =>
      prev
        .filter((a) => a.page !== deletedPage)
        .map((a) => (a.page > deletedPage ? { ...a, page: a.page - 1 } : a))
    );
    setHistory((prev) =>
      prev.map((snap) =>
        snap
          .filter((a) => a.page !== deletedPage)
          .map((a) => (a.page > deletedPage ? { ...a, page: a.page - 1 } : a))
      )
    );
  }, []);

  const pushAnnotations = useCallback((next: PlacedAnnotation[]) => {
    setAnnotations(next);
    setHistoryIndex((i) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, i + 1);
        trimmed.push(next);
        return trimmed;
      });
      return i + 1;
    });
  }, []);

  const undo = () => {
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    setAnnotations(history[idx]);
    setSelectedId(null);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    setAnnotations(history[idx]);
    setSelectedId(null);
  };

  useEffect(() => {
    const requestId = ++loadRef.current;
    setLoading(true);
    setError(null);
    setPdfPassword(null);
    setSessionId("");
    setThumbnails([]);
    setTotalPages(0);
    setPageSlots([]);
    setCurrentPage(1);
    setAnnotations([]);
    setHistory([[]]);
    setHistoryIndex(0);

    loadPdfDocumentPreview(file).then((preview) => {
      if (requestId !== loadRef.current) return;
      if (preview.passwordRequired) {
        setPasswordPrompt({ file, fileName: preview.fileName ?? file.name });
        setLoading(false);
        return;
      }
      if (!preview.sessionId || preview.totalPages === 0) {
        setError(preview.error ?? ws.couldNotReadPdfShort);
        return;
      }
      setSessionId(preview.sessionId);
      setTotalPages(preview.totalPages);
    });

    loadPdfThumbnailsBatched(file, (thumbs, total) => {
      if (requestId !== loadRef.current) return;
      setThumbnails(thumbs);
      if (total > 0) {
        setTotalPages(total);
        setPageSlots(createOriginalSlots(total));
      }
      setLoading(false);
    }).then((result) => {
      if (requestId !== loadRef.current) return;
      if (result.passwordRequired) return;
      if (result.totalPages === 0) setError(ws.resolveApiError(result.error, "errors.corruptedPdf") || ws.couldNotReadPdfShort);
      setLoading(false);
    });
  }, [fileKey, file, ws.couldNotReadPdfShort]);

  const placeAnnotation = useCallback(
    (partial: Omit<PlacedAnnotation, "id">) => {
      const id = crypto.randomUUID();
      const next = [...annotationsRef.current, { ...partial, id }];
      pushAnnotations(next);
      setSelectedId(id);
      setTool("select");
    },
    [pushAnnotations]
  );

  const handleCanvasClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (tool === "select") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { xNorm, yNorm } = clickToNorm(e.clientX, e.clientY, rect);

    if (tool === "signature" && pendingSignature) {
      const w = pendingSignature.kind === "initials" ? DEFAULT_SIG_WIDTH_NORM * 0.5 : DEFAULT_SIG_WIDTH_NORM;
      const h = pendingSignature.kind === "initials" ? DEFAULT_SIG_HEIGHT_NORM * 0.7 : DEFAULT_SIG_HEIGHT_NORM;
      placeAnnotation({
        page: currentPage,
        xNorm: Math.min(xNorm, 1 - w),
        yNorm: Math.min(yNorm, 1 - h),
        widthNorm: w,
        heightNorm: h,
        type: "image",
        dataUrl: pendingSignature.dataUrl,
      });
      return;
    }

    if (tool === "date") {
      placeAnnotation({
        page: currentPage,
        xNorm,
        yNorm,
        widthNorm: 0.18,
        heightNorm: DEFAULT_TEXT_HEIGHT_NORM,
        type: "date",
        text: selectedDate,
        fontSize: 16,
      });
      return;
    }

    if (tool === "text") {
      const text = window.prompt(ws.enterTextPrompt, ws.defaultSignText)?.trim();
      if (!text) return;
      placeAnnotation({
        page: currentPage,
        xNorm,
        yNorm,
        widthNorm: Math.min(0.4, text.length * 0.012),
        heightNorm: DEFAULT_TEXT_HEIGHT_NORM,
        type: "text",
        text,
        fontSize: 14,
      });
      return;
    }

    if (tool === "check") {
      placeAnnotation({
        page: currentPage,
        xNorm,
        yNorm,
        widthNorm: DEFAULT_CHECK_SIZE_NORM,
        heightNorm: DEFAULT_CHECK_SIZE_NORM,
        type: "check",
      });
    }
  };

  const handleOverlayMouseDown = (
    e: ReactMouseEvent,
    id: string,
    xNorm: number,
    yNorm: number
  ) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: xNorm, origY: yNorm };
  };

  const handleResizeStart = (
    e: ReactMouseEvent,
    id: string,
    handle: ResizeHandle,
    ann: PlacedAnnotation
  ) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(id);
    resizeRef.current = {
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: ann.xNorm,
      origY: ann.yNorm,
      origW: ann.widthNorm,
      origH: ann.heightNorm,
    };
  };

  const clampAnnotationBounds = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const width = Math.max(MIN_ANNOTATION_WIDTH_NORM, Math.min(w, 1));
      const height = Math.max(MIN_ANNOTATION_HEIGHT_NORM, Math.min(h, 1));
      const xNorm = Math.min(Math.max(x, 0), 1 - width);
      const yNorm = Math.min(Math.max(y, 0), 1 - height);
      return {
        xNorm,
        yNorm,
        widthNorm: Math.min(width, 1 - xNorm),
        heightNorm: Math.min(height, 1 - yNorm),
      };
    },
    []
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      const resize = resizeRef.current;
      if (resize) {
        const dx = (e.clientX - resize.startX) / rect.width;
        const dy = (e.clientY - resize.startY) / rect.height;
        const { handle, origX, origY, origW, origH, id } = resize;

        let x = origX;
        let y = origY;
        let w = origW;
        let h = origH;

        if (handle === "se") {
          w = origW + dx;
          h = origH + dy;
        } else if (handle === "sw") {
          w = origW - dx;
          h = origH + dy;
          x = origX + dx;
        } else if (handle === "ne") {
          w = origW + dx;
          h = origH - dy;
          y = origY + dy;
        } else if (handle === "nw") {
          w = origW - dx;
          h = origH - dy;
          x = origX + dx;
          y = origY + dy;
        }

        if (w < MIN_ANNOTATION_WIDTH_NORM) {
          if (handle === "sw" || handle === "nw") x = origX + origW - MIN_ANNOTATION_WIDTH_NORM;
          w = MIN_ANNOTATION_WIDTH_NORM;
        }
        if (h < MIN_ANNOTATION_HEIGHT_NORM) {
          if (handle === "ne" || handle === "nw") y = origY + origH - MIN_ANNOTATION_HEIGHT_NORM;
          h = MIN_ANNOTATION_HEIGHT_NORM;
        }

        const bounds = clampAnnotationBounds(x, y, w, h);
        setAnnotations((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  xNorm: bounds.xNorm,
                  yNorm: bounds.yNorm,
                  widthNorm: bounds.widthNorm,
                  heightNorm: bounds.heightNorm,
                }
              : item
          )
        );
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      const ann = annotationsRef.current.find((item) => item.id === drag.id);
      const maxX = ann ? 1 - ann.widthNorm : 0.95;
      const maxY = ann ? 1 - ann.heightNorm : 0.95;
      const xNorm = Math.min(Math.max(drag.origX + dx, 0), maxX);
      const yNorm = Math.min(Math.max(drag.origY + dy, 0), maxY);
      setAnnotations((prev) =>
        prev.map((item) => (item.id === drag.id ? { ...item, xNorm, yNorm } : item))
      );
    };
    const onUp = () => {
      if (dragRef.current || resizeRef.current) {
        dragRef.current = null;
        resizeRef.current = null;
        pushAnnotations([...annotationsRef.current]);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pushAnnotations, clampAnnotationBounds]);

  const deleteSelected = () => {
    if (!selectedId) return;
    pushAnnotations(annotationsRef.current.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  };

  const insertBlankAfter = useCallback(
    (afterIndex: number) => {
      const newSlot: WorkspacePageSlot = { id: `blank-${crypto.randomUUID()}`, kind: "blank" };
      setPageSlots((prev) => {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, newSlot);
        return next;
      });
      bumpAnnotationPagesAfter(afterIndex, 1);
      setCurrentPage(afterIndex + 2);
      setError(null);
    },
    [bumpAnnotationPagesAfter]
  );

  const duplicateSlotAt = useCallback(
    (index: number) => {
      const slot = visibleSlots[index];
      if (!slot) return;
      const copy = duplicateSlot(slot);
      setPageSlots((prev) => {
        const next = [...prev];
        next.splice(index + 1, 0, copy);
        return next;
      });
      bumpAnnotationPagesAfter(index, 1);
      setCurrentPage(index + 2);
    },
    [visibleSlots, bumpAnnotationPagesAfter]
  );

  const removeSlotAt = useCallback(
    (index: number) => {
      if (visibleSlots.length <= 1) {
        setError(ws.cannotDeleteOnlyPage);
        return;
      }
      const deletedPage = index + 1;
      const slotId = visibleSlots[index]?.id;
      setPageSlots((prev) => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
      if (slotId) {
        setSlotRotations((prev) => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
      }
      remapAnnotationsOnDelete(deletedPage);
      setCurrentPage((p) => {
        if (p === deletedPage) return Math.max(1, p - 1);
        if (p > deletedPage) return p - 1;
        return p;
      });
      setError(null);
    },
    [visibleSlots, remapAnnotationsOnDelete, ws.cannotDeleteOnlyPage]
  );

  const rotateSlotAt = useCallback((index: number) => {
    const slot = visibleSlots[index];
    if (!slot) return;
    setSlotRotations((prev) => ({
      ...prev,
      [slot.id]: ((prev[slot.id] ?? 0) - 90 + 360) % 360,
    }));
  }, [visibleSlots]);

  const openInsertDocuments = useCallback((afterIndex: number) => {
    insertAfterIndexRef.current = afterIndex;
    insertFileRef.current?.click();
  }, []);

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
      const afterIndex = insertAfterIndexRef.current;
      const newSlots: WorkspacePageSlot[] = Array.from({ length: data.totalPages }, (_, i) => ({
        id: `imp-${crypto.randomUUID()}`,
        kind: "imported" as const,
        page: i + 1,
        fileName: picked.name,
        sessionId: data.sessionId!,
      }));
      setPageSlots((prev) => {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, ...newSlots);
        return next;
      });
      bumpAnnotationPagesAfter(afterIndex, data.totalPages);
      setCurrentPage(afterIndex + 2);
      setError(null);
    } catch {
      setError(ws.couldNotAddDocument);
    }
  };

  const canvasWidth = `${CANVAS_RENDER_WIDTH * zoom}px`;
  const currentRotation = currentSlot ? (slotRotations[currentSlot.id] ?? 0) : 0;

  const handleCreateSignature = (dataUrl: string, label: string) => {
    const entry: SavedSignature = {
      id: crypto.randomUUID(),
      label,
      dataUrl,
      kind: modalKind ?? "signature",
    };
    setSavedSignatures((prev) => [...prev, entry]);
    setPendingSignature(entry);
    setTool("signature");
    setModalKind(null);
  };

  const handleExport = async () => {
    if (annotations.length === 0) {
      setProcessing(true);
      setError(null);
      try {
        let pdfToExport: File = file;
        if (!isDefaultSlotOrder(visibleSlots, totalPages)) {
          const composeForm = new FormData();
          composeForm.append("file", file, file.name);
          composeForm.append("slots", JSON.stringify(workspaceSlotsToCompose(visibleSlots)));
          if (pdfPassword) composeForm.append("password", pdfPassword);
          const composeRes = await fetch("/api/tools/compose-pdf", { method: "POST", body: composeForm });
          if (!composeRes.ok) {
            await readToolApiFailure(composeRes, ws.failedPreparePages);
          }
          const composedBlob = await composeRes.blob();
          pdfToExport = new File([composedBlob], file.name, { type: "application/pdf" });
        }
        const url = URL.createObjectURL(pdfToExport);
        onComplete({ url, filename: file.name, size: pdfToExport.size });
      } catch (err) {
        const prompt = passwordPromptFromError(err, file.name);
        if (prompt) {
          setPasswordPrompt({ file, ...prompt });
          setError(null);
          return;
        }
        setError(err instanceof Error ? err.message : ws.exportFailed);
      } finally {
        setProcessing(false);
      }
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const imageDataUrls: string[] = [];
      const urlToIndex = new Map<string, number>();

      const payloads: SignAnnotationPayload[] = annotations.map((ann) => {
        if (ann.type === "image" && ann.dataUrl) {
          let idx = urlToIndex.get(ann.dataUrl);
          if (idx === undefined) {
            idx = imageDataUrls.length;
            imageDataUrls.push(ann.dataUrl);
            urlToIndex.set(ann.dataUrl, idx);
          }
          return {
            type: "image" as const,
            page: ann.page,
            xNorm: ann.xNorm,
            yNorm: ann.yNorm,
            widthNorm: ann.widthNorm,
            heightNorm: ann.heightNorm,
            imageIndex: idx,
          };
        }
        return {
          type: ann.type,
          page: ann.page,
          xNorm: ann.xNorm,
          yNorm: ann.yNorm,
          widthNorm: ann.widthNorm,
          heightNorm: ann.heightNorm,
          text: ann.text,
          fontSize: ann.fontSize,
        };
      });

      let pdfToSign: File = file;
      if (!isDefaultSlotOrder(visibleSlots, totalPages)) {
        const composeForm = new FormData();
        composeForm.append("file", file, file.name);
        composeForm.append("slots", JSON.stringify(workspaceSlotsToCompose(visibleSlots)));
        if (pdfPassword) composeForm.append("password", pdfPassword);
        const composeRes = await fetch("/api/tools/compose-pdf", { method: "POST", body: composeForm });
        if (!composeRes.ok) {
          await readToolApiFailure(composeRes, ws.failedPreparePages);
        }
        const composedBlob = await composeRes.blob();
        pdfToSign = new File([composedBlob], file.name, { type: "application/pdf" });
      }

      const formData = new FormData();
      formData.append("file", pdfToSign, pdfToSign.name);
      formData.append("annotations", JSON.stringify(payloads));
      for (const dataUrl of imageDataUrls) {
        const blob = await dataUrlToBlob(dataUrl);
        formData.append("images", blob, "signature.png");
      }

      const res = await fetch("/api/tools/sign-pdf", { method: "POST", body: formData });
      if (!res.ok) {
        await readToolApiFailure(res, ws.failedExportSignedPdf);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = file.name.replace(/\.pdf$/i, "") + "-signed.pdf";
      onComplete({ url, filename, size: blob.size });
    } catch (err) {
      const prompt = passwordPromptFromError(err, file.name);
      if (prompt) {
        setPasswordPrompt({ file, ...prompt });
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : ws.exportFailed);
    } finally {
      setProcessing(false);
    }
  };

  const retryWithPassword = useCallback(
    (pw: string) => {
      if (!passwordPrompt) return;
      const { file: pFile } = passwordPrompt;
      setPasswordPrompt((prev) => (prev ? { ...prev, loading: true, errorMsg: undefined } : prev));

      loadPdfDocumentPreview(pFile, pw).then((preview) => {
        if (preview.wrongPassword) {
          setPasswordPrompt((prev) =>
            prev ? { ...prev, errorMsg: preview.error ?? ws.incorrectPassword, loading: false } : prev
          );
          return;
        }
        if (preview.passwordRequired) return;
        setPasswordPrompt(null);
        setPdfPassword(pw);
        if (!preview.sessionId || preview.totalPages === 0) {
          setError(preview.error ?? ws.couldNotReadPdfShort);
          return;
        }
        setSessionId(preview.sessionId);
        setTotalPages(preview.totalPages);
        loadPdfThumbnailsBatched(pFile, (thumbs, total) => {
          setThumbnails(thumbs);
          if (total > 0) {
            setTotalPages(total);
            setPageSlots(createOriginalSlots(total));
          }
          setLoading(false);
        }, pw);
      });
    },
    [passwordPrompt, ws.incorrectPassword, ws.couldNotReadPdfShort]
  );

  if (passwordPrompt) {
    return (
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
    );
  }

  const cursorClass =
    tool === "signature" || tool === "date" || tool === "text" || tool === "check"
      ? "cursor-crosshair"
      : "";

  const signatureItems = savedSignatures.filter((s) => s.kind === "signature");
  const initialsItems = savedSignatures.filter((s) => s.kind === "initials");

  return (
    <>
      <ToolHiddenFileInput
        ref={insertFileRef}
        accept=".pdf,application/pdf"
        ariaLabel={ws.insertPdfDocuments}
        onChange={handleInsertDocuments}
      />

      {modalKind && (
        <SignatureCreateModal
          kind={modalKind}
          onClose={() => setModalKind(null)}
          onCreate={handleCreateSignature}
        />
      )}

      <div className="flex h-[calc(100vh-10.5rem)] min-h-[480px] max-h-[calc(100vh-8rem)] flex-col rounded-xl border border-pd-border bg-[#f3f4f6] shadow-sm">
        <div className="relative z-40 flex shrink-0 items-center gap-2 border-b border-pd-border bg-white px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg p-2 text-pd-muted hover:bg-pd-background lg:hidden"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-pd-muted">{formatFileSize(file.size)}</p>
            </div>
          </div>

          {!loading && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
              <div className="pointer-events-auto inline-flex w-fit flex-nowrap items-center gap-0.5 rounded-xl border border-pd-border bg-white px-1.5 py-1 shadow-sm">
                <button
                  type="button"
                  title={ws.toolSelect}
                  onClick={() => setTool("select")}
                  className={cn(
                    "rounded-lg p-2",
                    tool === "select" ? "bg-pd-brand-muted text-pd-brand" : "text-pd-muted hover:bg-pd-background"
                  )}
                >
                  <MousePointer2 className="h-4 w-4" />
                </button>

                <SignSignaturesDropdown
                  open={signaturesOpen}
                  onOpenChange={setSignaturesOpen}
                  active={tool === "signature"}
                  signatureItems={signatureItems}
                  initialsItems={initialsItems}
                  onPick={(sig) => {
                    setPendingSignature(sig);
                    setTool("signature");
                  }}
                  onNewSignature={() => setModalKind("signature")}
                  onNewInitials={() => setModalKind("initials")}
                />

                <div className="relative">
                  <button
                    type="button"
                    title={ws.toolDate}
                    onClick={() => {
                      setTool("date");
                      setShowDatePicker((v) => !v);
                    }}
                    className={cn(
                      "rounded-lg p-2",
                      tool === "date" ? "bg-pd-brand-muted text-pd-brand" : "text-pd-muted hover:bg-pd-background"
                    )}
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                  {showDatePicker && (
                    <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-xl border border-pd-border bg-white p-3 shadow-xl">
                      <input
                        type="date"
                        value={dateIso}
                        onChange={(e) => e.target.value && setDateIso(e.target.value)}
                        className="rounded-lg border border-pd-border px-2 py-1 text-sm"
                      />
                      <p className="mt-2 text-xs text-pd-muted">{ws.clickToPlaceDate(selectedDate)}</p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  title={ws.toolText}
                  onClick={() => setTool("text")}
                  className={cn(
                    "rounded-lg p-2",
                    tool === "text" ? "bg-pd-brand-muted text-pd-brand" : "text-pd-muted hover:bg-pd-background"
                  )}
                >
                  <Type className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  title={ws.toolCheckmark}
                  onClick={() => setTool("check")}
                  className={cn(
                    "rounded-lg p-2",
                    tool === "check" ? "bg-pd-brand-muted text-pd-brand" : "text-pd-muted hover:bg-pd-background"
                  )}
                >
                  <Check className="h-4 w-4" />
                </button>

                <div className="mx-1 h-5 w-px bg-pd-border" />

                <button
                  type="button"
                  title={ws.toolUndo}
                  disabled={historyIndex <= 0}
                  onClick={undo}
                  className="rounded-lg p-2 text-pd-muted hover:bg-pd-background disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title={ws.toolRedo}
                  disabled={historyIndex >= history.length - 1}
                  onClick={redo}
                  className="rounded-lg p-2 text-pd-muted hover:bg-pd-background disabled:opacity-30"
                >
                  <Redo2 className="h-4 w-4" />
                </button>

                {selectedId && (
                  <>
                    <div className="mx-1 h-5 w-px bg-pd-border" />
                    <button
                      type="button"
                      title={ws.toolDelete}
                      onClick={deleteSelected}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-pd-muted hover:text-pd-foreground"
            >
              {ws.changeFile}
            </button>
            <Button size="sm" onClick={handleExport} disabled={processing || loading}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {ws.exportPdf}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside
            className={cn(
              "relative z-10 h-full min-h-0 shrink-0 overflow-hidden bg-white",
              sidebarOpen ? "w-[7.85rem] sm:w-[8.85rem]" : "hidden lg:block lg:w-8"
            )}
          >
            {sidebarOpen && (
              <SignThumbScrollPanel className="absolute inset-0">
                {(loading ? [1, 2, 3] : visibleSlots).map((slot, index) => {
                  const pageNum = index + 1;
                  const active = pageNum === currentPage;
                  const thumb = loading ? undefined : slotThumbUrl(slot as WorkspacePageSlot, thumbnails);

                  return (
                    <div key={loading ? index : (slot as WorkspacePageSlot).id}>
                      {loading ? (
                        <div className="aspect-[3/4] animate-pulse rounded-lg bg-pd-border/40" />
                      ) : (
                        <SignPageThumb
                          pageNum={pageNum}
                          thumb={thumb}
                          isBlank={(slot as WorkspacePageSlot).kind === "blank"}
                          active={active}
                          onSelect={() => setCurrentPage(pageNum)}
                          onDuplicate={() => duplicateSlotAt(index)}
                          onRotate={() => rotateSlotAt(index)}
                          onRemove={() => removeSlotAt(index)}
                        />
                      )}
                      {!loading && (
                        <SignPageInsertDivider
                          onAddBlank={() => insertBlankAfter(index)}
                          onAddDocuments={() => openInsertDocuments(index)}
                        />
                      )}
                    </div>
                  );
                })}
              </SignThumbScrollPanel>
            )}
          </aside>

          <section aria-label={ws.signingWorkspace} className={cn("relative flex min-h-0 flex-1 flex-col overflow-auto", cursorClass)}>
            {error && (
              <div className="p-3">
                <ToolErrorBanner message={error} />
              </div>
            )}

            {loading && (
              <p className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                {ws.loadingPages}
              </p>
            )}

            <div className="relative flex flex-1 items-start justify-center p-4 sm:p-8">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-pd-brand" />
              ) : (
                <div
                  className="relative mx-auto shrink-0"
                  style={{ width: canvasWidth, maxWidth: "100%" }}
                >
                  {tool === "signature" && pendingSignature && (
                    <p className="mb-2 text-center text-xs text-pd-brand">
                      {pendingSignature.kind === "initials"
                        ? ws.clickToPlaceInitials
                        : ws.clickToPlaceSignature}
                    </p>
                  )}

                  <div
                    ref={canvasRef}
                    className={cn("relative w-full bg-white shadow-xl select-none", cursorClass)}
                    onClick={handleCanvasClick}
                  >
                    {currentSlot?.kind === "blank" ? (
                      <div className="flex aspect-[3/4] w-full items-center justify-center bg-white text-sm text-pd-muted">
                        {ws.blankPage}
                      </div>
                    ) : canvasUrl ? (
                       
                      <img
                        src={canvasUrl}
                        alt={ws.pageAlt(currentPage)}
                        className="block h-auto w-full pointer-events-none"
                        style={{
                          transform: currentRotation ? `rotate(${currentRotation}deg)` : undefined,
                          transformOrigin: "center center",
                        }}
                        draggable={false}
                      />
                    ) : (
                      <div className="flex aspect-[3/4] w-full items-center justify-center bg-slate-50">
                        <Loader2 className="h-6 w-6 animate-spin text-pd-brand" />
                      </div>
                    )}

                    {pageAnnotations.map((ann) => {
                      const selected = selectedId === ann.id;
                      if (ann.type === "image" && ann.dataUrl) {
                        return (
                          <SignImageAnnotation
                            key={ann.id}
                            ann={ann}
                            selected={selected}
                            onSelect={setSelectedId}
                            onDragStart={handleOverlayMouseDown}
                            onResizeStart={handleResizeStart}
                          />
                        );
                      }
                      if (ann.type === "text" || ann.type === "date") {
                        return (
                          <div
                            key={ann.id}
                            className={cn(
                              "absolute cursor-move whitespace-nowrap font-medium text-black",
                              selected && "ring-2 ring-pd-brand ring-offset-1"
                            )}
                            style={{
                              left: `${ann.xNorm * 100}%`,
                              top: `${ann.yNorm * 100}%`,
                              fontSize: `${(ann.fontSize ?? 14) * zoom * 0.85}px`,
                            }}
                            onMouseDown={(e) => handleOverlayMouseDown(e, ann.id, ann.xNorm, ann.yNorm)}
                          >
                            {ann.text}
                          </div>
                        );
                      }
                      if (ann.type === "check") {
                        return (
                          <div
                            key={ann.id}
                            className={cn(
                              "absolute flex cursor-move items-center justify-center font-bold text-black",
                              selected && "ring-2 ring-pd-brand ring-offset-1"
                            )}
                            style={{
                              left: `${ann.xNorm * 100}%`,
                              top: `${ann.yNorm * 100}%`,
                              width: `${ann.widthNorm * 100}%`,
                              height: `${ann.heightNorm * 100}%`,
                              fontSize: `${ann.heightNorm * CANVAS_RENDER_WIDTH * zoom * 0.5}px`,
                            }}
                            onMouseDown={(e) => handleOverlayMouseDown(e, ann.id, ann.xNorm, ann.yNorm)}
                          >
                            ✓
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}
            </div>

            {!loading && visibleSlots.length > 0 && (
              <div className="pointer-events-none sticky bottom-4 flex justify-center pb-4">
                <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#1f2937]/90 px-2 py-1.5 text-white shadow-lg">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[4rem] text-center text-xs">
                    {currentPage} / {visibleSlots.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= visibleSlots.length}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="mx-1 h-4 w-px bg-white/20" />
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                    className="rounded-full p-1.5 hover:bg-white/10"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="min-w-[2.5rem] text-center text-xs">{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                    className="rounded-full p-1.5 hover:bg-white/10"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-pd-muted">{ws.signWorkspaceHint}</p>
    </>
  );
}
