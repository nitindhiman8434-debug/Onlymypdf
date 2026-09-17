import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInvoiceForUser,
  issueGstInvoiceForPayment,
  listUserInvoices,
} from "@/lib/billing/invoice.service";

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  getUserProfile: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/db/queries";

describe("invoice.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserProfile).mockResolvedValue({
      full_name: "Jane Doe",
      email: "jane@example.com",
    } as never);
    vi.mocked(createServiceClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: "OMP-2026-00003", error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          like: vi.fn().mockResolvedValue({ count: 2, error: null }),
          eq: vi.fn().mockImplementation(function eqChain() {
            return {
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "inv-1",
                    invoice_number: "OMP-2026-00003",
                    amount_paise: 29900,
                  },
                  error: null,
                }),
              }),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "inv-1",
                    invoice_number: "OMP-2026-00003",
                    amount_paise: 29900,
                    tax_paise: 4561,
                    status: "paid",
                    issued_at: "2026-01-01T00:00:00.000Z",
                    razorpay_payment_id: "pay_1",
                  },
                ],
                error: null,
              }),
            };
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "inv-new", invoice_number: "OMP-2026-00003" },
              error: null,
            }),
          }),
        }),
      }),
    } as never);
  });

  it("issues GST invoices for completed payments", async () => {
    const result = await issueGstInvoiceForPayment({
      userId: "user-1",
      paymentId: "pay-1",
      amountPaise: 29900,
      razorpayPaymentId: "pay_rzp_1",
      planLabel: "Pro monthly",
    });

    expect(result.invoiceId).toBe("inv-new");
    expect(result.invoiceNumber).toContain("OMP-2026-");
  });

  it("rejects invalid invoice amounts", async () => {
    await expect(
      issueGstInvoiceForPayment({
        userId: "user-1",
        paymentId: "pay-1",
        amountPaise: 0,
        planLabel: "Pro monthly",
      })
    ).rejects.toThrow("Invalid invoice amount");
  });

  it("lists invoices for a user", async () => {
    const invoices = await listUserInvoices("user-1");
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.invoice_number).toBe("OMP-2026-00003");
  });

  it("loads a single invoice for a user", async () => {
    const invoice = await getInvoiceForUser("user-1", "inv-1");
    expect(invoice?.amount_paise).toBe(29900);
  });
});
