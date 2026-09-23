import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import {
  acknowledgeSupabaseConversionMessage,
  claimSupabaseConversionJob,
  enqueueSupabaseConversionJob,
  getSupabaseConversionQueueDepth,
} from "./supabase-conversion-queue";

describe("Supabase conversion queue RPC adapter", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("enqueues a job through the service-role RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: 7, error: null });
    await enqueueSupabaseConversionJob("11111111-1111-4111-8111-111111111111");
    expect(mocks.rpc).toHaveBeenCalledWith("enqueue_pdf_to_word_job", {
      p_job_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("maps a claimed PGMQ message and its receipt", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          msg_id: 42,
          job_id: "22222222-2222-4222-8222-222222222222",
          read_count: 2,
        },
      ],
      error: null,
    });
    await expect(claimSupabaseConversionJob()).resolves.toEqual({
      messageId: "42",
      jobId: "22222222-2222-4222-8222-222222222222",
      readCount: 2,
    });
  });

  it("acknowledges a processed message and reads numeric queue depth", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [{ pending: "3", processing: "1" }], error: null });
    await acknowledgeSupabaseConversionMessage("42");
    await expect(getSupabaseConversionQueueDepth()).resolves.toEqual({
      pending: 3,
      processing: 1,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "delete_pdf_to_word_queue_message", {
      p_msg_id: "42",
    });
  });

  it("fails closed when the queue RPC returns an error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "queue unavailable" } });
    await expect(claimSupabaseConversionJob()).rejects.toThrow("queue unavailable");
  });
});
