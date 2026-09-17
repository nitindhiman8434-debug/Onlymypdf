import { NextResponse, type NextRequest } from "next/server";
import { CORRELATION_ID_HEADER, getCorrelationId } from "@/lib/server/correlation-id";

export type ToolApiErrorBody = {
  error: string;
  correlationId: string;
  code?: string;
  retryAfterSec?: number;
  /** Echoed back so the password prompt can name the file it is asking about. */
  fileName?: string;
};

/** JSON error for tool / AI routes with correlation ID for support. */
export function toolJsonError(
  request: NextRequest,
  message: string,
  status: number,
  extra?: Partial<Omit<ToolApiErrorBody, "error" | "correlationId">>
): NextResponse {
  const correlationId = getCorrelationId(request);
  return NextResponse.json(
    {
      error: message,
      correlationId,
      ...extra,
    } satisfies ToolApiErrorBody,
    {
      status,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    }
  );
}
