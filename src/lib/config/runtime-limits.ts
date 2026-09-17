/** Server-side conversion limits (env-driven, safe production defaults). */
export function getMaxConcurrentHeavyJobs(): number {
  const raw = process.env.MAX_CONCURRENT_HEAVY_JOBS;
  const parsed = raw ? Number(raw) : 8;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 8;
}

/** Browser-first PDF tools (merge/split/rotate). Server API remains as fallback. */
export function isClientPdfToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLIENT_PDF_TOOLS !== "false";
}
