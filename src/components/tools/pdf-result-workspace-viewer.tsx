"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToolWorkspaceMessages } from "@/hooks/use-tool-workspace-messages";
import {
  loadPdfDocumentPreview,
  pageThumbFromSession,
} from "@/lib/pdf/pdf-thumbnails.client";
import { getClientPreviewThumbMaxWidth } from "@/lib/config/preview-limits";

const THUMB_PANEL_WIDTH = 188;
const THUMB_IMAGE_WIDTH = 176;
const THUMB_ROW_HEIGHT = 228;
const THUMB_OVERSCAN = 8;
const MAIN_PAGE_GAP = 12;
const MAIN_OVERSCAN = 4;
const PREVIEW_THUMB_MAX_WIDTH = getClientPreviewThumbMaxWidth();
/** A4 portrait aspect */
const PAGE_ASPECT = 297 / 210;
const DEFAULT_ZOOM = 100;
const FIT_WIDTH_ZOOM = 100;

const VIEWER_HEIGHT_CLASS = "h-full min-h-0";

function pageRowHeight(
  pageNum: number,
  frameWidthPx: number,
  pageAspects: Record<number, number>
): number {
  const aspect = pageAspects[pageNum] ?? PAGE_ASPECT;
  return Math.max(80, Math.round(frameWidthPx * aspect)) + MAIN_PAGE_GAP;
}

function buildPageOffsets(
  totalPages: number,
  frameWidthPx: number,
  pageAspects: Record<number, number>
): number[] {
  const offsets = new Array<number>(totalPages + 1).fill(0);
  for (let page = 1; page <= totalPages; page++) {
    offsets[page] = offsets[page - 1] + pageRowHeight(page, frameWidthPx, pageAspects);
  }
  return offsets;
}

function pageIndexAtScroll(
  scrollTop: number,
  offsets: number[],
  totalPages: number
): number {
  if (totalPages <= 0) return 1;
  let page = 1;
  for (let p = 1; p <= totalPages; p++) {
    if (offsets[p - 1] <= scrollTop + 1) page = p;
  }
  return page;
}

interface PdfResultWorkspaceViewerProps {
  blobUrl: string;
  filename: string;
  className?: string;
  initialSessionId?: string | null;
  initialTotalPages?: number;
}

export function PdfResultWorkspaceViewer({
  blobUrl,
  filename,
  className,
  initialSessionId = null,
  initialTotalPages = 0,
}: PdfResultWorkspaceViewerProps) {
  const ws = useToolWorkspaceMessages();
  const [sessionId, setSessionId] = useState(initialSessionId ?? "");
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(!initialSessionId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const thumbScrollRef = useRef<HTMLDivElement>(null);
  const mainPaneRef = useRef<HTMLDivElement>(null);
  const scrollToPageRef = useRef(false);
  const loadRef = useRef(0);

  const [thumbScrollTop, setThumbScrollTop] = useState(0);
  const [thumbViewportHeight, setThumbViewportHeight] = useState(480);
  const [mainScrollTop, setMainScrollTop] = useState(0);
  const [mainViewportHeight, setMainViewportHeight] = useState(480);
  const [mainPaneWidth, setMainPaneWidth] = useState(800);
  const [pageAspects, setPageAspects] = useState<Record<number, number>>({});

  useEffect(() => {
    setPageAspects({});
  }, [blobUrl, sessionId]);

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      setTotalPages(initialTotalPages);
      setLoading(false);
      setCurrentPage(1);
      return;
    }

    let cancelled = false;
    const requestId = ++loadRef.current;
    setLoading(true);
    setLoadError(null);
    setSessionId("");
    setTotalPages(0);
    setCurrentPage(1);

    fetch(blobUrl)
      .then((res) => res.blob())
      .then((blob) => new File([blob], filename, { type: "application/pdf" }))
      .then((pdfFile) => loadPdfDocumentPreview(pdfFile))
      .then((preview) => {
        if (cancelled || requestId !== loadRef.current) return;
        if (preview.error) setLoadError(preview.error);
        if (preview.sessionId) setSessionId(preview.sessionId);
        if (preview.totalPages > 0) setTotalPages(preview.totalPages);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(ws.couldNotLoadPreview);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [blobUrl, filename, initialSessionId, initialTotalPages, ws.couldNotLoadPreview]);

  const renderWidth = Math.min(
    PREVIEW_THUMB_MAX_WIDTH,
    Math.max(THUMB_IMAGE_WIDTH, Math.round(mainPaneWidth * (zoom / FIT_WIDTH_ZOOM)))
  );

  const frameWidth = `${zoom}%`;
  const frameWidthPx = Math.round(mainPaneWidth * (zoom / FIT_WIDTH_ZOOM));

  const pageOffsets = useMemo(
    () => buildPageOffsets(totalPages, frameWidthPx, pageAspects),
    [totalPages, frameWidthPx, pageAspects]
  );
  const mainTotalHeight = pageOffsets[totalPages] ?? 0;

  const recordPageAspect = useCallback((pageNum: number, aspect: number) => {
    setPageAspects((prev) => {
      const rounded = Math.round(aspect * 1000) / 1000;
      if (prev[pageNum] === rounded) return prev;
      return { ...prev, [pageNum]: rounded };
    });
  }, []);

  const pageUrlForPage = useCallback(
    (pageNum: number) =>
      sessionId ? pageThumbFromSession(sessionId, pageNum, renderWidth) : "",
    [sessionId, renderWidth]
  );

  const thumbUrlForPage = useCallback(
    (pageNum: number) =>
      sessionId ? pageThumbFromSession(sessionId, pageNum, THUMB_IMAGE_WIDTH) : "",
    [sessionId]
  );

  const goToPage = useCallback(
    (page: number) => {
      const next = Math.min(totalPages, Math.max(1, page));
      scrollToPageRef.current = true;
      setCurrentPage(next);
    },
    [totalPages]
  );

  const goPrev = () => goToPage(currentPage - 1);
  const goNext = () => goToPage(currentPage + 1);

  useEffect(() => {
    if (!scrollToPageRef.current) return;
    const el = mainPaneRef.current;
    if (!el) return;
    scrollToPageRef.current = false;
    el.scrollTop = pageOffsets[currentPage - 1] ?? 0;
  }, [currentPage, pageOffsets]);

  useEffect(() => {
    scrollToPageRef.current = true;
  }, [zoom, pageOffsets]);

  useEffect(() => {
    const el = mainPaneRef.current;
    if (!el) return;

    const update = () => {
      setMainPaneWidth(el.clientWidth);
      setMainViewportHeight(el.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, totalPages]);

  useEffect(() => {
    const el = thumbScrollRef.current;
    if (!el || totalPages <= 0) return;

    const update = () => setThumbViewportHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalPages, loading]);

  useEffect(() => {
    const el = thumbScrollRef.current;
    if (!el || currentPage < 1) return;
    const targetTop = (currentPage - 1) * THUMB_ROW_HEIGHT;
    const targetBottom = targetTop + THUMB_ROW_HEIGHT;
    if (targetTop < el.scrollTop) {
      el.scrollTop = targetTop;
    } else if (targetBottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = targetBottom - el.clientHeight;
    }
  }, [currentPage]);

  const handleMainScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setMainScrollTop(el.scrollTop);
    const page = pageIndexAtScroll(el.scrollTop, pageOffsets, totalPages);
    setCurrentPage((prev) => (prev === page ? prev : page));
  };

  const avgRowHeight =
    totalPages > 0 ? mainTotalHeight / totalPages : frameWidthPx * PAGE_ASPECT + MAIN_PAGE_GAP;

  const mainStart = Math.max(
    0,
    pageIndexAtScroll(
      Math.max(0, mainScrollTop - MAIN_OVERSCAN * avgRowHeight),
      pageOffsets,
      totalPages
    ) - 1
  );
  const mainVisibleCount =
    Math.ceil(Math.max(mainViewportHeight, avgRowHeight) / avgRowHeight) + MAIN_OVERSCAN * 2;
  const mainEnd = Math.min(totalPages, mainStart + mainVisibleCount);

  const thumbStart = Math.max(
    0,
    Math.floor(thumbScrollTop / THUMB_ROW_HEIGHT) - THUMB_OVERSCAN
  );
  const thumbVisibleCount =
    Math.ceil(Math.max(thumbViewportHeight, THUMB_ROW_HEIGHT) / THUMB_ROW_HEIGHT) +
    THUMB_OVERSCAN * 2;
  const thumbEnd = Math.min(totalPages, thumbStart + thumbVisibleCount);
  const thumbTotalHeight = totalPages * THUMB_ROW_HEIGHT;

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-md border border-[#2d2f31] bg-[#3a3b3c]",
        VIEWER_HEIGHT_CLASS,
        className
      )}
    >
      <div className="relative z-20 flex shrink-0 items-center gap-2 border-b border-[#2d2f31] bg-[#323639] px-3 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm text-white/90">{filename}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 disabled:opacity-35"
            aria-label={ws.previousPage}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-white/90">
            {currentPage} / {totalPages || "…"}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 disabled:opacity-35"
            aria-label={ws.nextPage}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(60, z - 10))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10"
            aria-label={ws.zoomOut}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-sm tabular-nums text-white/80">{zoom}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(160, z + 10))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10"
            aria-label={ws.zoomIn}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative z-0 flex h-full min-h-0 flex-1 overflow-hidden">
        <aside
          className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-[#2d2f31] bg-[#323639]"
          style={{ width: THUMB_PANEL_WIDTH }}
        >
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/70" />
            </div>
          ) : (
            <div
              ref={thumbScrollRef}
              onScroll={(e) => setThumbScrollTop(e.currentTarget.scrollTop)}
              className="pdf-viewer-thumb-scroll h-0 min-h-0 flex-1 overflow-y-scroll overflow-x-hidden px-1 py-1.5 pr-0.5"
            >
              <div
                className="relative w-full"
                style={{ height: thumbTotalHeight, contain: "strict" }}
              >
                {Array.from({ length: Math.max(0, thumbEnd - thumbStart) }, (_, i) => {
                  const pageNum = thumbStart + i + 1;
                  const active = pageNum === currentPage;
                  const thumb = thumbUrlForPage(pageNum);

                  return (
                    <div
                      key={pageNum}
                      className="absolute left-0 right-0 px-0.5"
                      style={{
                        top: (pageNum - 1) * THUMB_ROW_HEIGHT,
                        height: THUMB_ROW_HEIGHT,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => goToPage(pageNum)}
                        className={cn(
                          "relative h-[calc(100%-8px)] w-full overflow-hidden rounded-sm border-2 bg-white shadow-sm transition",
                          active
                            ? "border-[#8ab4f8] ring-1 ring-[#8ab4f8]/40"
                            : "border-transparent hover:border-white/25"
                        )}
                      >
                        {thumb ? (
                           
                          <img
                            src={thumb}
                            alt={`Page ${pageNum}`}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain bg-white"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-white text-xs text-pd-muted">
                            …
                          </div>
                        )}
                        <span
                          className={cn(
                            "absolute bottom-1 left-1 rounded px-1 py-0.5 text-[10px] font-semibold",
                            active ? "bg-[#8ab4f8] text-[#202124]" : "bg-black/65 text-white"
                          )}
                        >
                          {pageNum}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <div
          ref={mainPaneRef}
          onScroll={handleMainScroll}
          className="pdf-viewer-thumb-scroll relative h-full min-h-0 min-w-0 flex-1 overflow-y-scroll overflow-x-hidden bg-[#525659]"
        >
          {loadError ? (
            <p className="flex h-full items-center justify-center px-4 text-center text-sm text-red-300">
              {loadError}
            </p>
          ) : loading || !sessionId ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          ) : (
            <div
              className="relative w-full py-1"
              style={{ height: mainTotalHeight, contain: "strict" }}
            >
              {Array.from({ length: Math.max(0, mainEnd - mainStart) }, (_, i) => {
                const pageNum = mainStart + i + 1;
                const src = pageUrlForPage(pageNum);
                const active = pageNum === currentPage;
                const rowHeight = pageRowHeight(pageNum, frameWidthPx, pageAspects);

                return (
                  <div
                    key={pageNum}
                    className="absolute left-0 right-0 flex justify-center px-0"
                    style={{
                      top: pageOffsets[pageNum - 1] ?? 0,
                      height: rowHeight,
                    }}
                  >
                    <div
                      className={cn(
                        "flex w-full justify-center",
                        active && "ring-2 ring-[#8ab4f8]/60 ring-offset-2 ring-offset-[#525659]"
                      )}
                      style={{ width: frameWidth, maxWidth: "100%" }}
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={`Page ${pageNum}`}
                          loading="lazy"
                          decoding="async"
                          className="block h-auto w-full bg-white shadow-md"
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            if (img.naturalWidth > 0) {
                              recordPageAspect(
                                pageNum,
                                img.naturalHeight / img.naturalWidth
                              );
                            }
                          }}
                        />
                      ) : (
                        <div
                          className="flex w-full items-center justify-center bg-white text-sm text-pd-muted"
                          style={{ minHeight: rowHeight - MAIN_PAGE_GAP }}
                        >
                          …
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
