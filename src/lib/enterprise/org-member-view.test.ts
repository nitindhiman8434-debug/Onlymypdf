import { describe, expect, it } from "vitest";
import { sanitizeOrganizationForRole, sanitizeOrganizationMemberForRole } from "@/lib/enterprise/org-member-view";
import type { OrganizationMember, OrganizationRecord } from "@/lib/enterprise/organizations.service";

const sampleOrg: OrganizationRecord = {
  id: "org-1",
  name: "Acme",
  slug: "acme",
  billing_email: "billing@acme.com",
  plan: "team",
  seat_limit: 5,
  owner_id: "user-1",
  created_at: "2026-01-01T00:00:00.000Z",
  razorpay_subscription_id: "sub_secret_123",
};

describe("sanitizeOrganizationForRole", () => {
  it("keeps billing fields for owners and admins", () => {
    expect(sanitizeOrganizationForRole(sampleOrg, "owner").billing_email).toBe(
      "billing@acme.com"
    );
    expect(sanitizeOrganizationForRole(sampleOrg, "admin").razorpay_subscription_id).toBe(
      "sub_secret_123"
    );
  });

  it("strips billing fields for regular members", () => {
    const sanitized = sanitizeOrganizationForRole(sampleOrg, "member");
    expect(sanitized.billing_email).toBeUndefined();
    expect(sanitized.razorpay_subscription_id).toBeUndefined();
    expect(sanitized.name).toBe("Acme");
  });

  it("hides member emails from non-admin viewers", () => {
    const member: OrganizationMember = {
      id: "m1",
      user_id: "u2",
      role: "member",
      joined_at: "2026-01-01T00:00:00.000Z",
      email: "peer@acme.com",
      full_name: "Peer User",
    };
    expect(sanitizeOrganizationMemberForRole(member, "member").email).toBeNull();
    expect(sanitizeOrganizationMemberForRole(member, "admin").email).toBe("peer@acme.com");
  });
});
