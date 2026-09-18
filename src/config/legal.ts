import { APP_NAME, SUPPORT_EMAIL } from "@/config/constants";

function publicValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

/** Public legal identity. Set the NEXT_PUBLIC_* values before a production launch. */
export const LEGAL_CONTACT = {
  operatorName: publicValue(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME, APP_NAME),
  operatorCountry: publicValue(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_COUNTRY, "India"),
  privacyEmail: publicValue(process.env.NEXT_PUBLIC_PRIVACY_EMAIL, SUPPORT_EMAIL),
  supportEmail: SUPPORT_EMAIL,
} as const;

export const LEGAL_POLICY_DATE = {
  en: "September 18, 2026",
  hi: "18 सितंबर, 2026",
} as const;

export const PUBLIC_RETENTION = {
  proFileHours: 24,
  usageLogDays: 90,
  aiUsageLogDays: 90,
  errorLogDays: 90,
  adminAuditLogDays: 90,
  consentRecordYears: 3,
} as const;
