import type { ConversionOutputValidation } from "@/lib/services/conversion-output-validation";

export type ConversionEventStatus = "completed" | "failed";

export type ConversionMetricEvent = {
  jobId?: string;
  toolName: string;
  status: ConversionEventStatus;
  engine?: string | null;
  inputBytes?: number | null;
  outputBytes?: number | null;
  queueTimeMs?: number | null;
  processingTimeMs?: number | null;
  attemptCount?: number;
  fallbackUsed?: boolean;
  validation?: ConversionOutputValidation | null;
  errorCode?: string | null;
  occurredAt: string;
};

export type ConversionOperationalMetrics = {
  windowHours: number;
  jobs: number;
  successful: number;
  failed: number;
  successRate: number | null;
  validOutputRate: number | null;
  fallbackRate: number | null;
  queueP95Ms: number | null;
  processingP50Ms: number | null;
  processingP95Ms: number | null;
  byEngine: Record<string, number>;
  latestEventAt: string | null;
};

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(quantile * ordered.length) - 1));
  return ordered[index];
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function aggregateConversionMetrics(
  events: ConversionMetricEvent[],
  windowHours = 24
): ConversionOperationalMetrics {
  const completed = events.filter((event) => event.status === "completed");
  const validated = completed.filter((event) => event.validation != null);
  const validOutputs = validated.filter((event) => event.validation?.valid === true).length;
  const fallbackEligible = events.filter((event) => (event.attemptCount ?? 0) > 0);
  const fallbackCount = fallbackEligible.filter(
    (event) => event.fallbackUsed || (event.attemptCount ?? 0) > 1
  ).length;
  const processing = events
    .map((event) => event.processingTimeMs)
    .filter((value): value is number => typeof value === "number" && value >= 0);
  const queue = events
    .map((event) => event.queueTimeMs)
    .filter((value): value is number => typeof value === "number" && value >= 0);
  const byEngine: Record<string, number> = {};
  for (const event of events) {
    const engine = event.engine?.trim() || "unknown";
    byEngine[engine] = (byEngine[engine] ?? 0) + 1;
  }

  const latestEventAt = events
    .map((event) => event.occurredAt)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return {
    windowHours,
    jobs: events.length,
    successful: completed.length,
    failed: events.length - completed.length,
    successRate: rate(completed.length, events.length),
    validOutputRate: rate(validOutputs, validated.length),
    fallbackRate: rate(fallbackCount, fallbackEligible.length),
    queueP95Ms: percentile(queue, 0.95),
    processingP50Ms: percentile(processing, 0.5),
    processingP95Ms: percentile(processing, 0.95),
    byEngine,
    latestEventAt,
  };
}
