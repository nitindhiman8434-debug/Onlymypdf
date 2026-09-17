import type { OrganizationMember, OrganizationRecord } from "@/lib/enterprise/organizations.service";

/** Fields visible only to org owners and admins. */
const OWNER_ADMIN_ONLY_KEYS = [
  "billing_email",
  "razorpay_subscription_id",
] as const;

export function sanitizeOrganizationForRole<T extends OrganizationRecord>(
  org: T,
  role: string
): T {
  if (role === "owner" || role === "admin") return org;

  const sanitized = { ...org };
  for (const key of OWNER_ADMIN_ONLY_KEYS) {
    delete (sanitized as Record<string, unknown>)[key];
  }
  return sanitized;
}

/** Hide member emails from non-admin org viewers. */
export function sanitizeOrganizationMemberForRole(
  member: OrganizationMember,
  viewerRole: string
): OrganizationMember {
  if (viewerRole === "owner" || viewerRole === "admin") return member;
  return { ...member, email: null };
}
