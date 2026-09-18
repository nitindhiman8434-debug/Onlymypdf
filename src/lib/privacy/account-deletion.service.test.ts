import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  anonymizeBillingInvoicesForUser,
  assertAccountDeletionAllowed,
  cancelUserBillingBeforeDelete,
  deleteAccountLinkedFilesBeforeRemoval,
  scrubUserFileMetadata,
} from "@/lib/privacy/account-deletion.service";

vi.mock("@/lib/enterprise/organizations.service", () => ({
  countUserOrganizations: vi.fn(),
}));

vi.mock("@/lib/services/payment.service", () => ({
  cancelRazorpaySubscription: vi.fn(),
}));

vi.mock("@/lib/services/subscription-fulfillment.service", () => ({
  cancelLocalSubscription: vi.fn(),
}));

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "subscriptions") {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({
              in: mockIn.mockResolvedValue({
                data: [{ razorpay_subscription_id: "sub_live_1" }],
              }),
            }),
          }),
        };
      }
      if (table === "billing_invoices") {
        return {
          update: mockUpdate.mockReturnValue({
            eq: mockEq.mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "uploaded_files" || table === "tool_jobs") {
        return {
          update: mockUpdate.mockReturnValue({
            eq: mockEq.mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    }),
  })),
}));

import { countUserOrganizations } from "@/lib/enterprise/organizations.service";
import { cancelRazorpaySubscription } from "@/lib/services/payment.service";
import { cancelLocalSubscription } from "@/lib/services/subscription-fulfillment.service";

describe("account-deletion.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks delete when user owns organizations", async () => {
    vi.mocked(countUserOrganizations).mockResolvedValue(1);
    await expect(assertAccountDeletionAllowed("user-1")).resolves.toEqual({
      ok: false,
      status: 409,
      error: expect.stringContaining("Transfer organization ownership"),
    });
  });

  it("allows delete when user owns no organizations", async () => {
    vi.mocked(countUserOrganizations).mockResolvedValue(0);
    await expect(assertAccountDeletionAllowed("user-1")).resolves.toEqual({ ok: true });
  });

  it("deletes storage objects before marking their rows deleted", async () => {
    const deleteStoredFile = vi.fn().mockResolvedValue(undefined);
    const markDeleted = vi.fn().mockResolvedValue(undefined);

    await expect(
      deleteAccountLinkedFilesBeforeRemoval("user-1", {
        listFiles: vi.fn().mockResolvedValue([
          { id: "file-1", storage_path: "users/user-1/input.pdf" },
        ]),
        deleteStoredFile,
        markDeleted,
        recordError: vi.fn().mockResolvedValue(undefined),
      })
    ).resolves.toBe(1);

    expect(deleteStoredFile).toHaveBeenCalledWith("users/user-1/input.pdf");
    expect(markDeleted).toHaveBeenCalledWith("file-1");
    expect(deleteStoredFile.mock.invocationCallOrder[0]).toBeLessThan(
      markDeleted.mock.invocationCallOrder[0]
    );
  });

  it("keeps a failed storage row discoverable for account-deletion retry", async () => {
    const markDeleted = vi.fn().mockResolvedValue(undefined);
    const recordError = vi.fn().mockResolvedValue(undefined);

    await expect(
      deleteAccountLinkedFilesBeforeRemoval("user-1", {
        listFiles: vi.fn().mockResolvedValue([
          { id: "file-1", storage_path: "users/user-1/input.pdf" },
        ]),
        deleteStoredFile: vi.fn().mockRejectedValue(new Error("storage unavailable")),
        markDeleted,
        recordError,
      })
    ).rejects.toThrow("account was kept so deletion can be retried");

    expect(markDeleted).not.toHaveBeenCalled();
    expect(recordError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: "ACCOUNT_FILE_DELETE_FAILED",
        metadata: { file_id: "file-1" },
      })
    );
  });

  it("cancels Razorpay subscriptions before delete", async () => {
    await cancelUserBillingBeforeDelete("user-1");
    expect(cancelRazorpaySubscription).toHaveBeenCalledWith("sub_live_1");
    expect(cancelLocalSubscription).toHaveBeenCalledWith("sub_live_1");
  });

  it("redacts billing invoice PII", async () => {
    await anonymizeBillingInvoicesForUser("user-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_name: null,
        billing_email: null,
        billing_state: null,
        line_items: [],
      })
    );
  });

  it("scrubs original filenames before account deletion", async () => {
    await scrubUserFileMetadata("user-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        original_name: "deleted",
        stored_name: "deleted",
      })
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        input_files: [],
        output_file: null,
      })
    );
  });
});
