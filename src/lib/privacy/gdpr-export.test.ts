import { describe, expect, it } from "vitest";
import { buildGdprExportPayload, GDPR_EXPORT_SECTIONS } from "@/lib/privacy/gdpr-export";

describe("buildGdprExportPayload", () => {
  it("includes all GDPR export sections", () => {
    const payload = buildGdprExportPayload({
      user: { id: "u1", email: "a@b.com", plan: "free" },
      profile: { full_name: "Test" },
      toolJobs: [{ id: "j1" }],
      customerFeedback: [{ id: "feedback-1", tool_job_id: "j1" }],
      payments: [],
      subscriptions: [],
      consentRecords: [{ id: "c1" }],
      usageLogs: [{ id: "l1" }],
      aiUsageLogs: [{ id: "a1" }],
      uploadedFiles: [{ id: "f1" }],
      organizations: [{ id: "org-1", name: "Acme" }],
      organizationMemberships: [{ role: "owner", organization: { id: "org-1" } }],
      apiKeys: [{ id: "key-1", name: "Prod", key_prefix: "omp_abc" }],
      billingInvoices: [{ id: "inv-1", invoice_number: "OMP-2026-00001" }],
    });

    expect(payload.format).toBe("onlymypdf-gdpr-export-v4");
    expect(payload.sections_included).toEqual(GDPR_EXPORT_SECTIONS);
    expect(payload.consent_records).toHaveLength(1);
    expect(payload.customer_feedback).toEqual([
      { id: "feedback-1", tool_job_id: "j1" },
    ]);
    expect(payload.organizations).toHaveLength(1);
    expect(payload.api_keys).toHaveLength(1);
    expect(payload.billing_invoices).toHaveLength(1);
  });
});
