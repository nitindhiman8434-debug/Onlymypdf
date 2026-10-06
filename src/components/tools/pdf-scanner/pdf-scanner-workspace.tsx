"use client";



import { useState, useRef, useCallback, useEffect, useMemo } from "react";

import {

  Camera,

  Upload,

  Download,

  Loader2,

  X,

  ScanLine,

  Plus,

  Shield,

  RotateCcw,

  CheckCircle2,

} from "lucide-react";

import { cn } from "@/lib/utils/cn";

import { Button, buttonVariants } from "@/components/ui/button";

import { ToolErrorBanner, ToolHiddenFileInput, ToolUploadSizeHint } from "@/components/tools/tool-ui";

import { useToolWorkspaceMessages } from "@/hooks/use-tool-workspace-messages";

import { SCANNER_IMAGE_MIME_TYPES, SCANNER_MAX_IMAGES, type ScannerFilter } from "@/config/pdf-scanner";

import { scannerSelectionError } from "./scanner-selection";



type ScannerPage = { id: string; file: File; preview: string };

type InputMode = "camera" | "upload";



const FILTER_CSS: Record<ScannerFilter, string> = {

  original: "",

  bw: "grayscale(100%) contrast(1.25) brightness(1.05)",

  enhanced: "contrast(1.15) saturate(1.08) brightness(1.06)",

};



function CameraPreview({

  videoRef,

  maxHeight = "min(480px, 55vh)",

}: {

  videoRef: React.RefObject<HTMLVideoElement | null>;

  maxHeight?: string;

}) {

  const [aspectRatio, setAspectRatio] = useState<number | null>(null);



  const syncAspect = useCallback(() => {

    const video = videoRef.current;

    if (video?.videoWidth && video.videoHeight) {

      setAspectRatio(video.videoWidth / video.videoHeight);

    }

  }, [videoRef]);



  useEffect(() => {

    syncAspect();

  }, [syncAspect]);



  const ratio = aspectRatio ?? 4 / 3;

  const frameWidth =

    aspectRatio != null ? `min(100%, calc(${maxHeight} * ${aspectRatio}))` : "100%";



  return (

    <div className="flex justify-center">

      <div

        className="overflow-hidden rounded-xl bg-slate-900"

        style={{

          aspectRatio: ratio,

          maxHeight,

          width: frameWidth,

          maxWidth: "100%",

        }}

      >

        <video

          ref={videoRef}

          className="block size-full"

          autoPlay

          playsInline

          muted

          onLoadedMetadata={syncAspect}

          onResize={syncAspect}

        />

      </div>

    </div>

  );

}



export function PdfScannerWorkspace() {

  const ws = useToolWorkspaceMessages();

  const filterOptions = useMemo(

    () =>

      ([

        { value: "original" as const, label: ws.filterOriginal },

        { value: "bw" as const, label: ws.filterBw },

        { value: "enhanced" as const, label: ws.filterEnhanced },

      ] as const),

    [ws.filterOriginal, ws.filterBw, ws.filterEnhanced]

  );



  const [images, setImages] = useState<ScannerPage[]>([]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [filter, setFilter] = useState<ScannerFilter>("enhanced");

  const [inputMode, setInputMode] = useState<InputMode>("upload");

  const [processing, setProcessing] = useState(false);

  const [progress, setProgress] = useState(0);

  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [resultPageCount, setResultPageCount] = useState(0);

  const [error, setError] = useState("");

  const [cameraActive, setCameraActive] = useState(false);

  const [cameraStarting, setCameraStarting] = useState(false);

  const [capturePending, setCapturePending] = useState(false);

  const [isDragging, setIsDragging] = useState(false);



  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const imagesRef = useRef<ScannerPage[]>([]);
  const processingRef = useRef(false);
  const resultRef = useRef(false);
  const resultUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const cameraRequestRef = useRef(0);
  const cameraStartingRef = useRef(false);
  const pendingCaptureRef = useRef<symbol | null>(null);
  const processAbortRef = useRef<AbortController | null>(null);



  const activeFilterCss = FILTER_CSS[filter];

  const selectedImage = images[selectedIndex];

  const hasPages = images.length > 0;

  const atPageLimit = images.length >= SCANNER_MAX_IMAGES;



  const stopCamera = useCallback((cancelPendingCapture = false) => {
    if (pendingCaptureRef.current && !cancelPendingCapture) return;
    pendingCaptureRef.current = null;
    setCapturePending(false);
    cameraRequestRef.current++;
    cameraStartingRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingCaptureRef.current = null;
      cameraRequestRef.current++;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      processAbortRef.current?.abort();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview));
      imagesRef.current = [];
    };
  }, []);

  const addImages = useCallback((files: FileList | File[]) => {
    if (!mountedRef.current || processingRef.current || resultRef.current) return;
    const batch = Array.from(files);
    if (!batch.length) return;
    const selectionError = scannerSelectionError(imagesRef.current.length, batch);
    if (selectionError) {
      setError(selectionError);
      return;
    }
    const newImages: ScannerPage[] = [];
    try {
      for (const file of batch) {
        newImages.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
      }
    } catch {
      newImages.forEach((image) => URL.revokeObjectURL(image.preview));
      setError("These images could not be previewed. Try selecting them again.");
      return;
    }
    // Update the ref immediately so rapid uploads and asynchronous camera blobs
    // share the same limit before React commits another render.
    const firstAddedIndex = imagesRef.current.length;
    const next = [...imagesRef.current, ...newImages];
    imagesRef.current = next;
    setImages(next);
    setSelectedIndex(firstAddedIndex);
    setError("");
  }, []);

  const removeImage = (id: string) => {
    if (processingRef.current || resultRef.current) return;
    const previous = imagesRef.current;
    const index = previous.findIndex((image) => image.id === id);
    if (index < 0) return;
    URL.revokeObjectURL(previous[index].preview);
    const next = previous.filter((image) => image.id !== id);
    imagesRef.current = next;
    setImages(next);
    setSelectedIndex((current) => {
      if (!next.length) return 0;
      return Math.min(index <= current ? Math.max(0, current - 1) : current, next.length - 1);
    });
    setError("");
  };

  const startCamera = async () => {
    if (!mountedRef.current || processingRef.current || resultRef.current
        || cameraStartingRef.current || streamRef.current || imagesRef.current.length >= SCANNER_MAX_IMAGES) return;
    const request = cameraRequestRef.current + 1;
    cameraRequestRef.current = request;
    cameraStartingRef.current = true;
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (!mountedRef.current || request !== cameraRequestRef.current
          || processingRef.current || resultRef.current || imagesRef.current.length >= SCANNER_MAX_IMAGES) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
      setError("");
    } catch {
      if (mountedRef.current && request === cameraRequestRef.current) setError(ws.cameraAccessDenied);
    } finally {
      if (mountedRef.current && request === cameraRequestRef.current) {
        cameraStartingRef.current = false;
        setCameraStarting(false);
      }
    }
  };

  const capturePhoto = () => {
    if (processingRef.current || resultRef.current || pendingCaptureRef.current || imagesRef.current.length >= SCANNER_MAX_IMAGES
        || !videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setError("The camera is still starting. Try capturing the page again.");
      return;
    }
    const canvas = canvasRef.current;
    const request = cameraRequestRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    const capture = Symbol("pending camera capture");
    pendingCaptureRef.current = capture;
    setCapturePending(true);
    const commitCapture = (blob: Blob | null) => {
      if (pendingCaptureRef.current !== capture) return;
      try {
        if (!mountedRef.current || request !== cameraRequestRef.current) return;
        if (blob) {
          addImages([new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" })]);
        } else {
          setError("The captured page could not be prepared. Please capture it again.");
        }
      } finally {
        if (pendingCaptureRef.current === capture) {
          pendingCaptureRef.current = null;
          if (mountedRef.current) setCapturePending(false);
        }
      }
    };
    try {
      canvas.toBlob(commitCapture, "image/jpeg", 0.92);
    } catch {
      commitCapture(null);
    }
  };

  const handleProcess = async () => {
    if (processingRef.current || resultRef.current || pendingCaptureRef.current || !imagesRef.current.length) return;
    processingRef.current = true;
    setProcessing(true);
    setError("");
    setProgress(20);
    stopCamera();
    const submittedPages = [...imagesRef.current];
    const controller = new AbortController();
    processAbortRef.current = controller;
    const formData = new FormData();
    submittedPages.forEach((image) => formData.append("files", image.file));
    formData.append("filter", filter);
    try {
      setProgress(55);
      const response = await fetch("/api/tools/pdf-scanner", {
        method: "POST", body: formData, signal: controller.signal,
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || ws.scanningFailed);
      }
      const output = await response.blob();
      if (!mountedRef.current || controller.signal.aborted) return;
      const outputUrl = URL.createObjectURL(output);
      resultUrlRef.current = outputUrl;
      resultRef.current = true;
      setResultPageCount(submittedPages.length);
      setResultUrl(outputUrl);
      setProgress(100);
    } catch (failure) {
      if (mountedRef.current && !controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : ws.processingFailed);
      }
    } finally {
      if (processAbortRef.current === controller) processAbortRef.current = null;
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  };

  const reset = () => {
    if (processingRef.current) return;
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview));
    imagesRef.current = [];
    resultRef.current = false;
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setImages([]);
    setSelectedIndex(0);
    setResultUrl(null);
    setResultPageCount(0);
    setError("");
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    stopCamera(true);
  };

  const switchMode = (mode: InputMode) => {
    if (processingRef.current || resultRef.current || pendingCaptureRef.current) return;
    setInputMode(mode);
    if (mode === "upload") stopCamera();
  };

  const triggerAdd = () => {
    if (processingRef.current || resultRef.current || pendingCaptureRef.current || imagesRef.current.length >= SCANNER_MAX_IMAGES) return;
    if (inputMode === "camera") void startCamera();
    else fileInputRef.current?.click();
  };

  useEffect(() => {

    if (cameraActive && videoRef.current && streamRef.current) {

      videoRef.current.srcObject = streamRef.current;

      void videoRef.current.play().catch(() => {});

    }

  }, [cameraActive, hasPages]);



  if (resultUrl) {

    return (

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white px-5 py-8 text-center sm:py-10">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md">

          <CheckCircle2 className="h-7 w-7" />

        </div>

        <h2 className="mt-4 text-xl font-bold text-pd-foreground">{ws.pdfReady}</h2>

        <p className="mt-1 text-sm text-pd-muted">{ws.pagesScanned(resultPageCount)}</p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">

          <a href={resultUrl} download="scanned-document.pdf" className={buttonVariants({ className: "rounded-lg bg-teal-700 font-semibold hover:bg-teal-800" })}>

            <Download className="h-4 w-4" />

            {ws.downloadPdf}

          </a>

          <Button variant="outline" onClick={reset} className="rounded-lg">

            <RotateCcw className="h-4 w-4" />

            {ws.scanAgain}

          </Button>

        </div>

      </div>

    );

  }



  return (

    <div className="overflow-hidden rounded-2xl border border-pd-border/70 bg-pd-surface shadow-sm" aria-busy={processing}>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pd-border/60 bg-slate-50/80 px-3 py-2 sm:px-4">

        <div className="flex items-center gap-2">

          <ScanLine className="h-4 w-4 text-teal-600" aria-hidden />

          <span className="text-sm font-bold text-pd-foreground">{ws.scanner}</span>

          <div
            role="group"
            aria-label="Scanner input mode"
            className="ml-1 flex rounded-lg border border-pd-border/70 bg-white p-0.5"
          >

            {(["camera", "upload"] as const).map((mode) => (

              <button

                key={mode}

                type="button"

                onClick={() => switchMode(mode)}

                disabled={processing || capturePending}

                aria-pressed={inputMode === mode}

                className={cn(

                  "flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",

                  inputMode === mode

                    ? "bg-teal-700 text-white"

                    : "text-pd-muted hover:text-pd-foreground"

                )}

              >

                {mode === "camera" ? <Camera className="h-3 w-3" /> : <Upload className="h-3 w-3" />}

                {mode === "camera" ? ws.camera : ws.upload}

              </button>

            ))}

          </div>

        </div>

        <div className="flex items-center gap-2">

          {hasPages && (

            <>

              <button

                type="button"

                onClick={triggerAdd}

                disabled={processing || atPageLimit || cameraStarting || capturePending}

                className="flex cursor-pointer items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"

              >

                <Plus className="h-3.5 w-3.5" />

                {ws.addPage}

              </button>

              <button

                type="button"

                onClick={reset}

                disabled={processing}

                className="cursor-pointer text-xs font-medium text-pd-muted hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"

              >

                {ws.clear}

              </button>

            </>

          )}

          <span className="hidden items-center gap-1 text-[10px] text-pd-muted sm:flex">

            <Shield className="h-3 w-3 text-emerald-600" />

            {ws.autoDelete2h}

          </span>

        </div>

      </div>



      <p className="px-3 pt-3 text-xs text-pd-muted sm:px-4" aria-live="polite">
        {images.length} of {SCANNER_MAX_IMAGES} images selected.
        {atPageLimit ? " Limit reached. Remove a page to add another." : ` Add up to ${SCANNER_MAX_IMAGES} images per PDF.`}
      </p>

      {capturePending && (
        <p className="px-3 pt-2 text-sm text-teal-800 sm:px-4" role="status" aria-atomic="true">
          Preparing captured page. Please wait before creating the PDF or closing the camera.
        </p>
      )}

      <ToolHiddenFileInput

        ref={fileInputRef}

        accept={SCANNER_IMAGE_MIME_TYPES.join(",")}

        multiple

        disabled={processing || atPageLimit || capturePending}

        ariaLabel={ws.chooseImagesScan}

        onChange={(event) => {
          if (event.currentTarget.files) addImages(event.currentTarget.files);
          event.currentTarget.value = "";
        }}

      />

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />



      {!hasPages && (

        <div className="p-3 sm:p-4">

          {inputMode === "camera" ? (

            cameraActive ? (

              <div className="space-y-2">

                <CameraPreview videoRef={videoRef} />

                <div className="flex flex-wrap items-center gap-2">

                  <Button

                    size="sm"

                    onClick={capturePhoto}

                    disabled={processing || atPageLimit || capturePending}

                    aria-busy={capturePending}

                    className="w-auto shrink-0 rounded-lg bg-teal-700 px-4 font-semibold hover:bg-teal-800"

                  >

                    <Camera className="h-4 w-4" />

                    {ws.capture}

                  </Button>

                  <Button size="sm" variant="outline" onClick={() => stopCamera()} disabled={processing || capturePending} className="w-auto shrink-0 rounded-lg">

                    {ws.close}

                  </Button>

                </div>

              </div>

            ) : (

              <button

                type="button"

                onClick={() => void startCamera()}

                disabled={processing || atPageLimit || cameraStarting}

                className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-dashed border-teal-300/80 bg-teal-50/40 px-4 py-5 text-left transition hover:border-teal-400 hover:bg-teal-50/70 sm:py-6"

              >

                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">

                  <Camera className="h-5 w-5" />

                </span>

                <div className="min-w-0 flex-1">

                  <p className="font-semibold text-pd-foreground">{ws.openCameraToScan}</p>

                  <p className="text-xs text-pd-muted">{ws.cameraScanHint}</p>

                </div>

              </button>

            )

          ) : (

            <div

              className={cn(

                "flex cursor-pointer items-center gap-4 rounded-xl border border-dashed px-4 py-5 transition sm:py-6",

                isDragging

                  ? "border-teal-500 bg-teal-50"

                  : "border-pd-border hover:border-teal-300 hover:bg-teal-50/30"

              )}

              onDragOver={(e) => {

                e.preventDefault();

                setIsDragging(true);

              }}

              onDragLeave={() => setIsDragging(false)}

              onDrop={(e) => {

                e.preventDefault();

                setIsDragging(false);

                if (e.dataTransfer.files.length) addImages(e.dataTransfer.files);

              }}

              onClick={triggerAdd}

            >

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">

                <Upload className="h-5 w-5" />

              </span>

              <div className="min-w-0 flex-1">

                <p className="font-semibold text-pd-foreground">{ws.dropImagesBrowse}</p>

                <ToolUploadSizeHint formatNote={`JPG, PNG, WebP · up to ${SCANNER_MAX_IMAGES} images`} />

              </div>

              <Button type="button" size="sm" disabled={processing || atPageLimit} className="hidden shrink-0 rounded-lg sm:inline-flex">

                {ws.browse}

              </Button>

            </div>

          )}

        </div>

      )}



      {hasPages && (

        <div className="p-3 sm:p-4">

          {cameraActive && (

            <div className="mb-3 space-y-2 rounded-xl border border-teal-200 bg-teal-50/50 p-2">

              <CameraPreview videoRef={videoRef} maxHeight="min(360px, 45vh)" />

              <div className="flex flex-wrap items-center gap-2">

                <Button

                  size="sm"

                  onClick={capturePhoto}

                  disabled={processing || atPageLimit || capturePending}

                  aria-busy={capturePending}

                  className="w-auto shrink-0 rounded-lg bg-teal-700 px-4 hover:bg-teal-800"

                >

                  {ws.capturePage}

                </Button>

                <Button size="sm" variant="outline" onClick={() => stopCamera()} disabled={processing || capturePending} className="w-auto shrink-0">

                  {ws.done}

                </Button>

              </div>

            </div>

          )}



          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">

            <div className="overflow-hidden rounded-xl border border-pd-border/60 bg-slate-50">

              <div className="flex items-center justify-between border-b border-pd-border/50 px-2.5 py-1.5">

                <span className="text-[10px] font-bold uppercase tracking-wider text-pd-muted">

                  {ws.previewPages(selectedIndex + 1, images.length)}

                </span>

              </div>

              <div className="flex h-[min(240px,38vh)] items-center justify-center bg-white p-2 sm:h-[min(280px,42vh)]">

                {selectedImage && (

                  <img

                    src={selectedImage.preview}

                    alt={ws.pageAlt(selectedIndex + 1)}

                    className="max-h-full max-w-full object-contain"

                    style={{ filter: activeFilterCss }}

                  />

                )}

              </div>

            </div>



            <div className="flex gap-2 overflow-x-auto pb-0.5 lg:max-h-[min(280px,42vh)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">

              {images.map((image, index) => (
                <div
                  key={image.id}
                  className={cn(
                    "group relative shrink-0 rounded-lg border-2 transition",
                    selectedIndex === index ? "border-teal-500 ring-1 ring-teal-200" : "border-pd-border/70"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => { if (!processingRef.current) setSelectedIndex(index); }}
                    disabled={processing}
                    aria-label={`Preview page ${index + 1}`}
                    aria-pressed={selectedIndex === index}
                    className="block overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50"
                  >
                    <img
                      src={image.preview}
                      alt=""
                      className="h-14 w-11 object-cover lg:h-12 lg:w-10"
                      style={{ filter: activeFilterCss }}
                    />
                    <span aria-hidden="true" className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                      {index + 1}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    disabled={processing}
                    aria-label={`Remove page ${index + 1}`}
                    className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ))}

            </div>

          </div>



          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-pd-border/60 bg-slate-50/80 p-2.5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex flex-wrap items-center gap-2">

              <span className="text-xs font-semibold text-pd-muted">{ws.filterLabel}</span>

              {filterOptions.map((opt) => (

                <button

                  key={opt.value}

                  type="button"

                  onClick={() => { if (!processingRef.current) setFilter(opt.value); }}

                  disabled={processing}

                  aria-pressed={filter === opt.value}

                  className={cn(

                    "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",

                    filter === opt.value

                      ? "border-teal-500 bg-white text-teal-700 shadow-sm"

                      : "border-transparent bg-white/60 text-pd-muted hover:border-pd-border"

                  )}

                >

                  {selectedImage && (

                    <img

                      src={selectedImage.preview}

                      alt=""

                      className="h-6 w-5 rounded object-cover"

                      style={{ filter: FILTER_CSS[opt.value] }}

                    />

                  )}

                  {opt.label}

                </button>

              ))}

            </div>



            {processing ? (

              <div className="flex items-center gap-2 sm:min-w-[140px]" role="progressbar" aria-label="Creating PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>

                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />

                <div className="flex-1">

                  <div className="h-1.5 overflow-hidden rounded-full bg-pd-border">

                    <div

                      className="h-full rounded-full bg-teal-500 transition-all"

                      style={{ width: `${progress}%` }}

                    />

                  </div>

                </div>

              </div>

            ) : (

              <Button

                onClick={() => void handleProcess()}

                disabled={capturePending}

                className="w-full shrink-0 rounded-lg bg-teal-700 font-semibold hover:bg-teal-800 sm:w-auto"

              >

                <ScanLine className="h-4 w-4" />

                {ws.createPdfCount(images.length)}

              </Button>

            )}

          </div>

          <p className="mt-2 text-xs text-pd-muted">Filter preview is approximate. Review the downloaded PDF.</p>

        </div>

      )}



      {error && (

        <div className="px-3 pb-3 sm:px-4">

          <ToolErrorBanner message={error} />

        </div>

      )}

    </div>

  );

}

