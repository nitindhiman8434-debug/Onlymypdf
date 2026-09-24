export const GDPR_EXPORT_FORMAT = "onlymypdf-gdpr-export-v4";

export type GdprExportSection =
  | "account"
  | "profile"
  | "tool_jobs"
  | "customer_feedback"
  | "payments"
  | "subscriptions"
  | "consent_records"
  | "usage_logs"
  | "ai_usage_logs"
  | "uploaded_files"
  | "organizations"
  | "organization_memberships"
  | "api_keys"
  | "billing_invoices";

export const GDPR_EXPORT_SECTIONS: GdprExportSection[] = [
  "account",
  "profile",
  "tool_jobs",
  "customer_feedback",
  "payments",
  "subscriptions",
  "consent_records",
  "usage_logs",
  "ai_usage_logs",
  "uploaded_files",
  "organizations",
  "organization_memberships",
  "api_keys",
  "billing_invoices",
];

export function buildGdprExportPayload(data: {
  user: { id: string; email?: string | null; plan?: string | null };
  profile: Record<string, unknown> | null;
  toolJobs: Record<string, unknown>[];
  customerFeedback: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  consentRecords: Record<string, unknown>[];
  usageLogs: Record<string, unknown>[];
  aiUsageLogs: Record<string, unknown>[];
  uploadedFiles: Record<string, unknown>[];
  organizations: Record<string, unknown>[];
  organizationMemberships: Record<string, unknown>[];
  apiKeys: Record<string, unknown>[];
  billingInvoices: Record<string, unknown>[];
}) {
  return {
    exported_at: new Date().toISOString(),
    format: GDPR_EXPORT_FORMAT,
    sections_included: GDPR_EXPORT_SECTIONS,
    account: {
      id: data.user.id,
      email: data.user.email,
      plan: data.user.plan,
    },
    profile: data.profile,
    tool_jobs: data.toolJobs,
    customer_feedback: data.customerFeedback,
    payments: data.payments,
    subscriptions: data.subscriptions,
    consent_records: data.consentRecords,
    usage_logs: data.usageLogs,
    ai_usage_logs: data.aiUsageLogs,
    uploaded_files: data.uploadedFiles,
    organizations: data.organizations,
    organization_memberships: data.organizationMemberships,
    api_keys: data.apiKeys,
    billing_invoices: data.billingInvoices,
  };
}
