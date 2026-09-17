import { randomBytes } from "node:crypto";
import { TEAM_PRICING } from "@/config/constants";
import { logOrganizationAudit } from "@/lib/enterprise/org-audit";
import { sanitizeOrganizationForRole } from "@/lib/enterprise/org-member-view";
import { createServiceClient } from "@/lib/supabase/server";

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  billing_email: string | null;
  plan: string;
  seat_limit: number;
  owner_id: string;
  created_at: string;
  plan_status?: string;
  plan_expires_at?: string | null;
  daily_tool_limit?: number;
  daily_usage_count?: number;
  daily_usage_date?: string | null;
  razorpay_subscription_id?: string | null;
};

export type OrganizationInvite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string | null;
};

export type OrganizationMember = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email?: string | null;
  full_name?: string | null;
};

export function clampSeatLimit(raw?: number): number {
  const value = raw ?? TEAM_PRICING.defaultSeatLimit;
  return Math.min(TEAM_PRICING.defaultSeatLimit, Math.max(1, Math.floor(value)));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Max organizations a single user may create (owner role). */
export const MAX_ORGANIZATIONS_PER_USER = 3;

export async function countUserOrganizations(userId: string): Promise<number> {
  const supabase = await createServiceClient();
  const { count, error } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "owner");
  if (error) throw error;
  return count ?? 0;
}

export async function listUserOrganizations(userId: string): Promise<OrganizationRecord[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "role, organizations ( id, name, slug, billing_email, plan, seat_limit, owner_id, created_at, plan_status, plan_expires_at, daily_tool_limit, daily_usage_count, daily_usage_date, razorpay_subscription_id )"
    )
    .eq("user_id", userId);

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const typed = row as {
        role: string;
        organizations: OrganizationRecord | OrganizationRecord[] | null;
      };
      const org = typed.organizations;
      const record = (Array.isArray(org) ? org[0] : org) as OrganizationRecord | null;
      if (!record) return null;
      return sanitizeOrganizationForRole(record, typed.role);
    })
    .filter(Boolean) as OrganizationRecord[];
}

export async function createOrganization(
  userId: string,
  input: { name: string; billingEmail?: string; seatLimit?: number }
): Promise<OrganizationRecord> {
  const supabase = await createServiceClient();
  const baseSlug = slugify(input.name) || "team";
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: input.name.trim().slice(0, 120),
      slug,
      billing_email: input.billingEmail?.trim() || null,
      seat_limit: clampSeatLimit(input.seatLimit),
      owner_id: userId,
      plan: "team",
    })
    .select("id, name, slug, billing_email, plan, seat_limit, owner_id, created_at")
    .single();

  if (orgError) throw orgError;

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) throw memberError;

  return org as OrganizationRecord;
}

export async function getOrganizationMemberRole(
  organizationId: string,
  userId: string
): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

export async function countOrganizationMembers(organizationId: string): Promise<number> {
  const supabase = await createServiceClient();
  const { count, error } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) throw error;
  return count ?? 0;
}

export async function listOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, joined_at")
    .eq("organization_id", organizationId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  const members = (data ?? []) as OrganizationMember[];
  for (const member of members) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", member.user_id)
      .maybeSingle();
    member.full_name = profile?.full_name ?? null;
    member.email = profile?.email ?? null;
  }
  return members;
}

export async function assertSeatAvailable(organizationId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("seat_limit")
    .eq("id", organizationId)
    .single();
  if (!org) throw new Error("Organization not found");

  const count = await countOrganizationMembers(organizationId);
  if (count >= org.seat_limit) {
    throw new Error(`Seat limit reached (${org.seat_limit}). Remove a member or upgrade seats.`);
  }
}

export async function addOrganizationMember(
  organizationId: string,
  userId: string,
  role: "admin" | "member" = "member"
): Promise<void> {
  await assertSeatAvailable(organizationId);
  const supabase = await createServiceClient();
  const { error } = await supabase.from("organization_members").insert({
    organization_id: organizationId,
    user_id: userId,
    role,
  });
  if (error) {
    if (error.code === "23505") throw new Error("User is already a member.");
    throw error;
  }

  // Close the seat-limit TOCTOU: re-count after insert and roll back if a
  // concurrent accept pushed the org over its seat limit.
  const { data: org } = await supabase
    .from("organizations")
    .select("seat_limit")
    .eq("id", organizationId)
    .single();
  if (org) {
    const count = await countOrganizationMembers(organizationId);
    if (count > org.seat_limit) {
      await supabase
        .from("organization_members")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", userId);
      throw new Error(
        `Seat limit reached (${org.seat_limit}). Remove a member or upgrade seats.`
      );
    }
  }
}

export async function removeOrganizationMember(
  organizationId: string,
  memberUserId: string,
  actorUserId: string
): Promise<void> {
  const supabase = await createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("id", organizationId)
    .single();
  if (!org) throw new Error("Organization not found");
  if (memberUserId === org.owner_id) {
    throw new Error("Cannot remove the organization owner.");
  }

  const actorRole = await getOrganizationMemberRole(organizationId, actorUserId);
  if (!actorRole || !["owner", "admin"].includes(actorRole)) {
    throw new Error("Not authorized to remove members.");
  }

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", memberUserId);
  if (error) throw error;
  await logOrganizationAudit({
    organizationId,
    actorUserId,
    action: "member.remove",
    targetType: "user",
    targetId: memberUserId,
  });
}

export async function createOrganizationInvite(
  organizationId: string,
  invitedBy: string,
  email: string,
  role: "admin" | "member" = "member"
): Promise<{ token: string; expiresAt: string } | { duplicate: true }> {
  await assertSeatAvailable(organizationId);
  const actorRole = await getOrganizationMemberRole(organizationId, invitedBy);
  if (!actorRole || !["owner", "admin"].includes(actorRole)) {
    throw new Error("Not authorized to invite members.");
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createServiceClient();

  const { error } = await supabase.from("organization_invites").insert({
    organization_id: organizationId,
    email: email.trim().toLowerCase(),
    role,
    token,
    invited_by: invitedBy,
    expires_at: expiresAt,
  });

  if (error) {
    if (error.code === "23505") return { duplicate: true };
    throw error;
  }

  await logOrganizationAudit({
    organizationId,
    actorUserId: invitedBy,
    action: "invite.create",
    targetType: "email",
    payload: { role },
  });

  return { token, expiresAt };
}

export const INVITE_ACCEPT_FAILED_MESSAGE = "Unable to accept this invitation.";

export async function acceptOrganizationInvite(
  token: string,
  userId: string,
  userEmail: string
): Promise<{ organizationId: string; organizationName: string }> {
  const supabase = await createServiceClient();
  const { data: invite, error } = await supabase
    .from("organization_invites")
    .select("id, organization_id, email, role, expires_at, accepted_at, organizations ( name )")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) throw new Error(INVITE_ACCEPT_FAILED_MESSAGE);
  if (invite.accepted_at) throw new Error(INVITE_ACCEPT_FAILED_MESSAGE);
  if (new Date(invite.expires_at) <= new Date()) throw new Error(INVITE_ACCEPT_FAILED_MESSAGE);
  if (invite.email !== userEmail.trim().toLowerCase()) {
    throw new Error(INVITE_ACCEPT_FAILED_MESSAGE);
  }

  await addOrganizationMember(
    invite.organization_id,
    userId,
    invite.role === "admin" ? "admin" : "member"
  );

  await supabase
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const orgName =
    (invite as { organizations?: { name?: string } | { name?: string }[] }).organizations;
  const name = Array.isArray(orgName) ? orgName[0]?.name : orgName?.name;

  await logOrganizationAudit({
    organizationId: invite.organization_id,
    actorUserId: userId,
    action: "invite.accept",
    targetType: "user",
    targetId: userId,
  });

  return {
    organizationId: invite.organization_id,
    organizationName: name ?? "Team",
  };
}

export async function listOrganizationInvites(
  organizationId: string,
  actorUserId: string
): Promise<OrganizationInvite[]> {
  const actorRole = await getOrganizationMemberRole(organizationId, actorUserId);
  if (!actorRole || !["owner", "admin"].includes(actorRole)) {
    throw new Error("Not authorized to view invites.");
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("organization_invites")
    .select("id, email, role, expires_at, created_at, accepted_at")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrganizationInvite[];
}

export async function revokeOrganizationInvite(
  organizationId: string,
  inviteId: string,
  actorUserId: string
): Promise<void> {
  const actorRole = await getOrganizationMemberRole(organizationId, actorUserId);
  if (!actorRole || !["owner", "admin"].includes(actorRole)) {
    throw new Error("Not authorized to revoke invites.");
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("organization_invites")
    .delete()
    .eq("id", inviteId)
    .eq("organization_id", organizationId)
    .is("accepted_at", null);

  if (error) throw error;
  await logOrganizationAudit({
    organizationId,
    actorUserId,
    action: "invite.revoke",
    targetType: "invite",
    targetId: inviteId,
  });
}

export async function getOrganizationById(
  organizationId: string,
  userId: string
): Promise<(OrganizationRecord & { memberCount: number; userRole: string }) | null> {
  const role = await getOrganizationMemberRole(organizationId, userId);
  if (!role) return null;

  const supabase = await createServiceClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, billing_email, plan, seat_limit, owner_id, created_at, plan_status, plan_expires_at, daily_tool_limit, daily_usage_count, daily_usage_date, razorpay_subscription_id"
    )
    .eq("id", organizationId)
    .single();

  if (error || !org) return null;

  const memberCount = await countOrganizationMembers(organizationId);
  const orgRecord = { ...(org as OrganizationRecord), memberCount, userRole: role };
  return sanitizeOrganizationForRole(orgRecord, role);
}

export async function activateOrganizationPlan(
  organizationId: string,
  input: {
    razorpaySubscriptionId?: string | null;
    periodEnd: Date;
    dailyToolLimit?: number;
  }
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      plan_status: "active",
      plan_expires_at: input.periodEnd.toISOString(),
      razorpay_subscription_id: input.razorpaySubscriptionId ?? null,
      daily_tool_limit: input.dailyToolLimit ?? 500,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);
  if (error) throw error;
}

/** Owner-only: cancel billing and delete the organization (members/invites cascade). */
export async function deleteOrganizationByOwner(
  organizationId: string,
  ownerUserId: string
): Promise<void> {
  const role = await getOrganizationMemberRole(organizationId, ownerUserId);
  if (role !== "owner") {
    throw new Error("Only the organization owner can delete this team.");
  }

  const supabase = await createServiceClient();
  const { data: org, error: loadError } = await supabase
    .from("organizations")
    .select("id, owner_id, razorpay_subscription_id")
    .eq("id", organizationId)
    .single();

  if (loadError || !org || org.owner_id !== ownerUserId) {
    throw new Error("Organization not found");
  }

  const razorpayId = org.razorpay_subscription_id?.trim();
  if (razorpayId) {
    const { cancelRazorpaySubscription } = await import("@/lib/services/payment.service");
    try {
      await cancelRazorpaySubscription(razorpayId);
    } catch {
      // proceed with local delete if gateway is unreachable
    }
  }

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId)
    .eq("owner_id", ownerUserId);

  if (error) throw error;
}
