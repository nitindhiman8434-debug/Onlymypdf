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

import { Button } from "@/components/ui/button";

import { ToolErrorBanner, ToolHiddenFileInput, ToolUploadSizeHint } from "@/components/tools/tool-ui";

import { useToolWorkspaceMessages } from "@/hooks/use-tool-workspace-messages";



type ScanFilter = "original" | "bw" | "enhanced";

type InputMode = "camera" | "upload";



const FILTER_CSS: Record<ScanFilter, string> = {

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



  const [images, setImages] = useState<{ id: string; file: File; preview: string }[]>([]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [filter, setFilter] = useState<ScanFilter>("enhanced");

  const [inputMode, setInputMode] = useState<InputMode>("upload");

  const [processing, setProcessing] = useState(false);

  const [progress, setProgress] = useState(0);

  const [result, setResult] = useState<Blob | null>(null);

  const [error, setError] = useState("");

  const [cameraActive, setCameraActive] = useState(false);

  const [isDragging, setIsDragging] = useState(false);



  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);



  const activeFilterCss = FILTER_CSS[filter];

  const selectedImage = images[selectedIndex];

  const hasPages = images.length > 0;



  const addImages = useCallback((files: FileList | File[]) => {

    const newImages = Array.from(files)

      .filter((f) => f.type.startsWith("image/"))

      .map((f) => ({

        id: crypto.randomUUID(),

        file: f,

        preview: URL.createObjectURL(f),

      }));

    if (newImages.length === 0) return;

    setImages((prev) => {

      const next = [...prev, ...newImages];

      setSelectedIndex(next.length - newImages.length);

      return next;

    });

    setResult(null);

    setError("");

  }, []);



  const removeImage = (id: string) => {

    setImages((prev) => {

      const idx = prev.findIndex((i) => i.id === id);

      const img = prev.find((i) => i.id === id);

      if (img) URL.revokeObjectURL(img.preview);

      const next = prev.filter((i) => i.id !== id);

      setSelectedIndex((cur) => {

        if (next.length === 0) return 0;

        if (idx <= cur) return Math.max(0, cur - 1);

        return Math.min(cur, next.length - 1);

      });

      return next;

    });

  };



  const startCamera = async () => {

    try {

      const stream = await navigator.mediaDevices.getUserMedia({

        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },

      });

      streamRef.current = stream;

      if (videoRef.current) {

        videoRef.current.srcObject = stream;

        await videoRef.current.play();

      }

      setCameraActive(true);

      setError("");

    } catch {

      setError(ws.cameraAccessDenied);

    }

  };



  const capturePhoto = () => {

    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;

    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;

    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob(

      (blob) => {

        if (blob) addImages([new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" })]);

      },

      "image/jpeg",

      0.92

    );

  };



  const stopCamera = () => {

    streamRef.current?.getTracks().forEach((t) => t.stop());

    streamRef.current = null;

    setCameraActive(false);

  };



  const handleProcess = async () => {

    if (!hasPages) return;

    setProcessing(true);

    setError("");

    setProgress(20);

    stopCamera();

    const formData = new FormData();

    images.forEach((img) => formData.append("files", img.file));

    formData.append("filter", filter);

    try {

      setProgress(55);

      const res = await fetch("/api/tools/pdf-scanner", { method: "POST", body: formData });

      if (!res.ok) {

        const err = await res.json().catch(() => ({}));

        throw new Error(err.error || ws.scanningFailed);

      }

      setResult(await res.blob());

      setProgress(100);

    } catch (err) {

      setError(err instanceof Error ? err.message : ws.processingFailed);

    } finally {

      setProcessing(false);

    }

  };



  const handleDownload = () => {

    if (!result) return;

    const url = URL.createObjectURL(result);

    const a = document.createElement("a");

    a.href = url;

    a.download = "scanned-document.pdf";

    a.click();

    URL.revokeObjectURL(url);

  };



  const reset = () => {

    images.forEach((img) => URL.revokeObjectURL(img.preview));

    setImages([]);

    setSelectedIndex(0);

    setResult(null);

    setError("");

    setProgress(0);

    stopCamera();

  };



  const switchMode = (mode: InputMode) => {

    setInputMode(mode);

    if (mode === "upload") stopCamera();

  };



  const triggerAdd = () => {

    if (inputMode === "camera") void startCamera();

    else fileInputRef.current?.click();

  };



  useEffect(() => {

    if (cameraActive && videoRef.current && streamRef.current) {

      videoRef.current.srcObject = streamRef.current;

      void videoRef.current.play().catch(() => {});

    }

  }, [cameraActive, hasPages]);



  if (result) {

    return (

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white px-5 py-8 text-center sm:py-10">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md">

          <CheckCircle2 className="h-7 w-7" />

        </div>

        <h2 className="mt-4 text-xl font-bold text-pd-foreground">{ws.pdfReady}</h2>

        <p className="mt-1 text-sm text-pd-muted">{ws.pagesScanned(images.length)}</p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">

          <Button onClick={handleDownload} className="rounded-lg bg-teal-700 font-semibold hover:bg-teal-800">

            <Download className="h-4 w-4" />

            {ws.downloadPdf}

          </Button>

          <Button variant="outline" onClick={reset} className="rounded-lg">

            <RotateCcw className="h-4 w-4" />

            {ws.scanAgain}

          </Button>

        </div>

      </div>

    );

  }



  return (

    <div className="overflow-hidden rounded-2xl border border-pd-border/70 bg-pd-surface shadow-sm">

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

                aria-pressed={inputMode === mode}

                className={cn(

                  "flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition",

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

                className="flex cursor-pointer items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"

              >

                <Plus className="h-3.5 w-3.5" />

                {ws.addPage}

              </button>

              <button

                type="button"

                onClick={reset}

                className="cursor-pointer text-xs font-medium text-pd-muted hover:text-red-600"

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



      <ToolHiddenFileInput

        ref={fileInputRef}

        accept="image/jpeg,image/png,image/webp"

        multiple

        ariaLabel={ws.chooseImagesScan}

        onChange={(e) => e.target.files && addImages(e.target.files)}

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

                    className="w-auto shrink-0 rounded-lg bg-teal-700 px-4 font-semibold hover:bg-teal-800"

                  >

                    <Camera className="h-4 w-4" />

                    {ws.capture}

                  </Button>

                  <Button size="sm" variant="outline" onClick={stopCamera} className="w-auto shrink-0 rounded-lg">

                    {ws.close}

                  </Button>

                </div>

              </div>

            ) : (

              <button

                type="button"

                onClick={() => void startCamera()}

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

              onClick={() => fileInputRef.current?.click()}

            >

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">

                <Upload className="h-5 w-5" />

              </span>

              <div className="min-w-0 flex-1">

                <p className="font-semibold text-pd-foreground">{ws.dropImagesBrowse}</p>

                <ToolUploadSizeHint formatNote="JPG, PNG, WebP · multi-page" />

              </div>

              <Button type="button" size="sm" className="hidden shrink-0 rounded-lg sm:inline-flex">

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

                  className="w-auto shrink-0 rounded-lg bg-teal-700 px-4 hover:bg-teal-800"

                >

                  {ws.capturePage}

                </Button>

                <Button size="sm" variant="outline" onClick={stopCamera} className="w-auto shrink-0">

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

              {images.map((img, i) => (

                <button

                  key={img.id}

                  type="button"

                  onClick={() => setSelectedIndex(i)}

                  className={cn(

                    "group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition",

                    selectedIndex === i ? "border-teal-500 ring-1 ring-teal-200" : "border-pd-border/70"

                  )}

                >

                  <img

                    src={img.preview}

                    alt={ws.pageAlt(i + 1)}

                    className="h-14 w-11 object-cover lg:h-12 lg:w-10"

                    style={{ filter: activeFilterCss }}

                  />

                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">

                    {i + 1}

                  </span>

                  <button

                    type="button"

                    onClick={(e) => {

                      e.stopPropagation();

                      removeImage(img.id);

                    }}

                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition group-hover:opacity-100"

                  >

                    <X className="h-2.5 w-2.5" />

                  </button>

                </button>

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

                  onClick={() => setFilter(opt.value)}

                  className={cn(

                    "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition",

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

              <div className="flex items-center gap-2 sm:min-w-[140px]">

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

                className="w-full shrink-0 rounded-lg bg-teal-700 font-semibold hover:bg-teal-800 sm:w-auto"

              >

                <ScanLine className="h-4 w-4" />

                {ws.createPdfCount(images.length)}

              </Button>

            )}

          </div>

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


