export type ConversionWorkerRuntime = "dedicated" | "scheduled";

export function getConversionWorkerRuntime(): ConversionWorkerRuntime {
  return process.env.CONVERSION_WORKER_RUNTIME?.trim().toLowerCase() === "scheduled"
    ? "scheduled"
    : "dedicated";
}
