import { recordConversionMetric } from "@/lib/ops/conversion-telemetry";
import {
  validateConversionOutput,
  type ConversionOutputKind,
  type ConversionOutputValidation,
} from "./conversion-output-validation";

export class ConversionOutputValidationError extends Error {
  constructor(public readonly validation: ConversionOutputValidation) {
    super(`Conversion output validation failed: ${validation.errors.join(" ")}`);
    this.name = "ConversionOutputValidationError";
  }
}

export async function validateAndRecordConversion(input: {
  jobId?: string;
  toolName: string;
  output: Buffer;
  outputKind: ConversionOutputKind;
  inputBytes?: number;
  startedAt: number;
  queueTimeMs?: number;
  engine?: string;
  attemptCount?: number;
}): Promise<ConversionOutputValidation> {
  const validation = await validateConversionOutput(input.output, input.outputKind);
  const processingTimeMs = Math.max(0, Date.now() - input.startedAt);
  if (!validation.valid) {
    await recordConversionMetric({
      jobId: input.jobId,
      toolName: input.toolName,
      status: "failed",
      engine: input.engine,
      inputBytes: input.inputBytes,
      outputBytes: input.output.length,
      queueTimeMs: input.queueTimeMs,
      processingTimeMs,
      attemptCount: input.attemptCount ?? 1,
      validation,
      errorCode: "OUTPUT_VALIDATION_FAILED",
      occurredAt: new Date().toISOString(),
    });
    throw new ConversionOutputValidationError(validation);
  }

  await recordConversionMetric({
    jobId: input.jobId,
    toolName: input.toolName,
    status: "completed",
    engine: input.engine,
    inputBytes: input.inputBytes,
    outputBytes: input.output.length,
    queueTimeMs: input.queueTimeMs,
    processingTimeMs,
    attemptCount: input.attemptCount ?? 1,
    fallbackUsed: (input.attemptCount ?? 1) > 1,
    validation,
    occurredAt: new Date().toISOString(),
  });
  return validation;
}

export async function recordFailedConversion(input: {
  toolName: string;
  startedAt: number;
  inputBytes?: number;
  engine?: string;
  attemptCount?: number;
  error: unknown;
}): Promise<void> {
  await recordConversionMetric({
    toolName: input.toolName,
    status: "failed",
    engine: input.engine,
    inputBytes: input.inputBytes,
    processingTimeMs: Math.max(0, Date.now() - input.startedAt),
    attemptCount: input.attemptCount ?? 1,
    fallbackUsed: (input.attemptCount ?? 1) > 1,
    errorCode: input.error instanceof Error ? input.error.name : "CONVERSION_FAILED",
    occurredAt: new Date().toISOString(),
  });
}
