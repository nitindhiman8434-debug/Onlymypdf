import { describe, expect, it, vi, beforeEach } from "vitest";

import { EnterpriseSalesRequiredError } from "@/lib/enterprise/enterprise-sales";
import {
  activateOrganizationBilling,
  cancelOrganizationAutoRenew,
  clearOrganizationAutoRenewByRazorpaySub,
  renewOrganizationPlanFromWebhook,
} from "@/lib/enterprise/org-billing.service";

vi.mock("@/lib/billing/billing-config", () => ({
  isMockBillingMode: vi.fn(),
}));

vi.mock("@/lib/billing/mock-billing.service", () => ({
  createMockSubscriptionId: vi.fn(() => "sub_mock_test123456789"),
}));

vi.mock("@/lib/enterprise/organizations.service", () => ({
  getOrganizationMemberRole: vi.fn(),
  countOrganizationMembers: vi.fn(),
  activateOrganizationPlan: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  createPayment: vi.fn(),
  getPaymentByRazorpayPaymentId: vi.fn(),
}));

vi.mock("@/lib/billing/invoice.service", () => ({
  issueGstInvoiceForPayment: vi.fn(),
}));

import { isMockBillingMode } from "@/lib/billing/billing-config";
import {
  activateOrganizationPlan,
  countOrganizationMembers,
  getOrganizationMemberRole,
} from "@/lib/enterprise/organizations.service";
import { createServiceClient } from "@/lib/supabase/server";
import { createPayment, getPaymentByRazorpayPaymentId } from "@/lib/db/queries";
import { issueGstInvoiceForPayment } from "@/lib/billing/invoice.service";

function mockOrgLookup() {
  vi.mocked(createServiceClient).mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "org-1",
              name: "Acme",
              seat_limit: 5,
              plan_status: "inactive",
            },
            error: null,
          }),
          maybeSingle: vi.fn(),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [{ id: "org-1" }], error: null }),
        }),
      }),
    }),
  } as never);
}

describe("activateOrganizationBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationMemberRole).mockResolvedValue("owner");
    vi.mocked(countOrganizationMembers).mockResolvedValue(2);
    vi.mocked(activateOrganizationPlan).mockResolvedValue(undefined);
    vi.mocked(createPayment).mockResolvedValue({ id: "pay-1" } as never);
    vi.mocked(issueGstInvoiceForPayment).mockResolvedValue(undefined as never);
    mockOrgLookup();
  });

  it("throws EnterpriseSalesRequiredError in live billing mode", async () => {
    vi.mocked(isMockBillingMode).mockReturnValue(false);

    await expect(
      activateOrganizationBilling("org-1", "owner-1", "monthly")
    ).rejects.toBeInstanceOf(EnterpriseSalesRequiredError);
  });

  it("throws when caller is not the organization owner", async () => {
    vi.mocked(getOrganizationMemberRole).mockResolvedValue("member");

    await expect(
      activateOrganizationBilling("org-1", "member-1", "monthly")
    ).rejects.toThrow("Only the organization owner can activate team billing.");
  });

  it("throws when organization is missing", async () => {
    vi.mocked(isMockBillingMode).mockReturnValue(true);
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "missing" } }),
          }),
        }),
      }),
    } as never);

    await expect(
      activateOrganizationBilling("org-missing", "owner-1", "monthly")
    ).rejects.toThrow("Organization not found.");
  });

  it("activates team billing in mock mode", async () => {
    vi.mocked(isMockBillingMode).mockReturnValue(true);

    const result = await activateOrganizationBilling("org-1", "owner-1", "yearly");

    expect(result.mock).toBe(true);
    expect(result.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(activateOrganizationPlan).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({
        razorpaySubscriptionId: "sub_mock_test123456789",
        dailyToolLimit: expect.any(Number),
      })
    );
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "owner-1",
        plan_name: "team",
        plan_duration: "yearly",
        status: "completed",
      })
    );
    expect(issueGstInvoiceForPayment).toHaveBeenCalled();
  });
});

describe("cancelOrganizationAutoRenew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationMemberRole).mockResolvedValue("owner");
  });

  it("throws when caller is not owner", async () => {
    vi.mocked(getOrganizationMemberRole).mockResolvedValue("admin");

    await expect(cancelOrganizationAutoRenew("org-1", "user-2")).rejects.toThrow(
      "Only the organization owner can cancel team billing."
    );
  });

  it("clears razorpay subscription id on the organization", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { razorpay_subscription_id: null },
              error: null,
            }),
          }),
        }),
        update,
      }),
    } as never);

    await cancelOrganizationAutoRenew("org-1", "owner-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        razorpay_subscription_id: null,
      })
    );
  });
});

function mockRenewalLookup(
  org: Record<string, unknown> | null,
  lastPayment: { plan_duration?: string } | null = null
) {
  vi.mocked(createServiceClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === "payments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: lastPayment, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: org, error: null }),
          }),
        }),
      };
    }),
  } as never);
}

describe("renewOrganizationPlanFromWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activateOrganizationPlan).mockResolvedValue(undefined);
    vi.mocked(createPayment).mockResolvedValue({ id: "pay-2" } as never);
    vi.mocked(issueGstInvoiceForPayment).mockResolvedValue(undefined as never);
    vi.mocked(getPaymentByRazorpayPaymentId).mockResolvedValue(null);
    vi.mocked(countOrganizationMembers).mockResolvedValue(2);
  });

  it("returns false when subscription is unknown", async () => {
    mockRenewalLookup(null);

    const ok = await renewOrganizationPlanFromWebhook({
      razorpaySubscriptionId: "sub_unknown",
    });

    expect(ok).toBe(false);
    expect(activateOrganizationPlan).not.toHaveBeenCalled();
  });

  it("extends organization plan and records payment when payload includes payment", async () => {
    mockRenewalLookup({
      id: "org-1",
      owner_id: "owner-1",
      name: "Acme",
      seat_limit: 5,
      plan_expires_at: null,
    });

    const ok = await renewOrganizationPlanFromWebhook({
      razorpaySubscriptionId: "sub_rzp_team_1",
      amountPaise: 49900,
      paymentId: "pay_rzp_1",
    });

    expect(ok).toBe(true);
    expect(activateOrganizationPlan).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ razorpaySubscriptionId: "sub_rzp_team_1" })
    );
    expect(createPayment).toHaveBeenCalled();
    expect(issueGstInvoiceForPayment).toHaveBeenCalled();
  });

  it("does not extend the plan again when the payment id already exists", async () => {
    mockRenewalLookup({
      id: "org-1",
      owner_id: "owner-1",
      name: "Acme",
      seat_limit: 5,
      plan_expires_at: null,
    });
    vi.mocked(getPaymentByRazorpayPaymentId).mockResolvedValue({ id: "pay-existing" } as never);

    const ok = await renewOrganizationPlanFromWebhook({
      razorpaySubscriptionId: "sub_rzp_team_1",
      amountPaise: 49900,
      paymentId: "pay_rzp_1",
    });

    expect(ok).toBe(true);
    expect(activateOrganizationPlan).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("extends organization plan without payment when webhook omits payment fields", async () => {
    mockRenewalLookup({
      id: "org-1",
      owner_id: "owner-1",
      name: "Acme",
      seat_limit: 5,
      plan_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const ok = await renewOrganizationPlanFromWebhook({
      razorpaySubscriptionId: "sub_rzp_team_1",
    });

    expect(ok).toBe(true);
    expect(activateOrganizationPlan).toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });
});

describe("clearOrganizationAutoRenewByRazorpaySub", () => {
  it("returns true when a row is updated", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [{ id: "org-1" }], error: null }),
          }),
        }),
      }),
    } as never);

    await expect(clearOrganizationAutoRenewByRazorpaySub("sub_rzp_1")).resolves.toBe(true);
  });

  it("returns false when update fails", async () => {
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }),
          }),
        }),
      }),
    } as never);

    await expect(clearOrganizationAutoRenewByRazorpaySub("sub_rzp_1")).resolves.toBe(false);
  });
});
