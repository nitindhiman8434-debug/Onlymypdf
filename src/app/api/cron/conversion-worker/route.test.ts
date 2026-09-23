import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ops/cron-auth", () => ({
  isCronAuthorized: vi.fn(),
}));

vi.mock("@/lib/server/safe-error", () => ({
  toSafeApiError: vi.fn((_error: unknown, fallback: string) => fallback),
}));

vi.mock("@/lib/services/pdf-to-word-worker.service", () => ({
  drainPdfToWordQueue: vi.fn(),
}));

vi.mock("@/lib/services/pdf-to-word-jobs.service", () => ({
  getPdfToWordQueueDepth: vi.fn(),
}));

vi.mock("@/lib/ops/conversion-worker-health", () => ({
  recordConversionWorkerHeartbeat: vi.fn(),
}));

import { isCronAuthorized } from "@/lib/ops/cron-auth";
import { recordConversionWorkerHeartbeat } from "@/lib/ops/conversion-worker-health";
import { getPdfToWordQueueDepth } from "@/lib/services/pdf-to-word-jobs.service";
import { drainPdfToWordQueue } from "@/lib/services/pdf-to-word-worker.service";
import { GET } from "./route";

describe("scheduled conversion worker route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCronAuthorized).mockReturnValue(true);
    vi.mocked(recordConversionWorkerHeartbeat).mockResolvedValue(undefined);
    vi.mocked(getPdfToWordQueueDepth).mockResolvedValue({ pending: 0, processing: 0 });
  });

  it("records a processed heartbeat after draining the queue", async () => {
    vi.mocked(drainPdfToWordQueue).mockResolvedValue([
      { processed: true, jobId: "job-023", status: "completed" },
    ]);

    const response = await GET(
      new NextRequest("https://onlymypdf.example/api/cron/conversion-worker?maxJobs=1", {
        headers: { authorization: "Bearer test" },
      })
    );

    expect(response.status).toBe(200);
    expect(drainPdfToWordQueue).toHaveBeenCalledWith(1);
    expect(recordConversionWorkerHeartbeat).toHaveBeenNthCalledWith(1, { state: "ready" });
    expect(recordConversionWorkerHeartbeat).toHaveBeenNthCalledWith(2, {
      state: "processed",
      jobId: "job-023",
      result: "completed",
    });
  });

  it("records an idle heartbeat when the queue is empty", async () => {
    vi.mocked(drainPdfToWordQueue).mockResolvedValue([{ processed: false }]);

    const response = await GET(
      new NextRequest("https://onlymypdf.example/api/cron/conversion-worker", {
        headers: { authorization: "Bearer test" },
      })
    );

    expect(response.status).toBe(200);
    expect(recordConversionWorkerHeartbeat).toHaveBeenLastCalledWith({ state: "idle" });
  });

  it("records an error heartbeat when queue processing fails", async () => {
    vi.mocked(drainPdfToWordQueue).mockRejectedValue(new Error("queue unavailable"));

    const response = await GET(
      new NextRequest("https://onlymypdf.example/api/cron/conversion-worker", {
        headers: { authorization: "Bearer test" },
      })
    );

    expect(response.status).toBe(500);
    expect(recordConversionWorkerHeartbeat).toHaveBeenLastCalledWith({ state: "error" });
  });

  it("rejects unauthenticated scheduler calls without touching the queue", async () => {
    vi.mocked(isCronAuthorized).mockReturnValue(false);

    const response = await GET(
      new NextRequest("https://onlymypdf.example/api/cron/conversion-worker")
    );

    expect(response.status).toBe(401);
    expect(drainPdfToWordQueue).not.toHaveBeenCalled();
    expect(recordConversionWorkerHeartbeat).not.toHaveBeenCalled();
  });
});
