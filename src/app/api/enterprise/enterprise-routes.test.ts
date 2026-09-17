import { type NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/get-api-user", () => ({
  tryGetApiUser: vi.fn(),
}));

vi.mock("@/lib/server/rate-limiter", () => ({
  guardGeneralApiRateLimit: vi.fn(),
}));

vi.mock("@/lib/server/mutation-origin", () => ({
  guardMutationOrigin: vi.fn(),
}));

vi.mock("@/lib/server/safe-error", () => ({
  toSafeApiError: vi.fn((_err: unknown, fallback: string) => fallback),
  captureApiError: vi.fn(),
}));

vi.mock("@/lib/enterprise/organizations.service", () => ({
  acceptOrganizationInvite: vi.fn(),
  countUserOrganizations: vi.fn(),
  MAX_ORGANIZATIONS_PER_USER: 3,
  createOrganization: vi.fn(),
  createOrganizationInvite: vi.fn(),
  getOrganizationById: vi.fn(),
  getOrganizationMemberRole: vi.fn(),
  listOrganizationInvites: vi.fn(),
  listOrganizationMembers: vi.fn(),
  listUserOrganizations: vi.fn(),
  removeOrganizationMember: vi.fn(),
  revokeOrganizationInvite: vi.fn(),
}));

vi.mock("@/lib/email/org-invite-mailer", () => ({
  sendOrganizationInviteEmail: vi.fn(),
}));

vi.mock("@/lib/enterprise/api-keys.service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/enterprise/api-keys.service")>(
    "@/lib/enterprise/api-keys.service"
  );
  return {
    ApiKeyOrganizationAccessError: actual.ApiKeyOrganizationAccessError,
    createUserApiKey: vi.fn(),
    listUserApiKeys: vi.fn(),
    revokeUserApiKey: vi.fn(),
  };
});

vi.mock("@/lib/enterprise/org-billing.service", () => ({
  activateOrganizationBilling: vi.fn(),
  cancelOrganizationAutoRenew: vi.fn(),
}));

vi.mock("@/lib/enterprise/org-access.service", () => ({
  resolveProAccessForUser: vi.fn(),
}));

vi.mock("@/lib/enterprise/enterprise-sales", async () => {
  const actual = await vi.importActual<typeof import("@/lib/enterprise/enterprise-sales")>(
    "@/lib/enterprise/enterprise-sales"
  );
  return {
    EnterpriseSalesRequiredError: actual.EnterpriseSalesRequiredError,
    sendTeamPlanSalesRequest: vi.fn(),
  };
});

import { tryGetApiUser } from "@/lib/auth/get-api-user";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";
import { guardMutationOrigin } from "@/lib/server/mutation-origin";
import {
  acceptOrganizationInvite,
  countUserOrganizations,
  createOrganization,
  createOrganizationInvite,
  getOrganizationById,
  getOrganizationMemberRole,
  listOrganizationInvites,
  listOrganizationMembers,
  listUserOrganizations,
  removeOrganizationMember,
  revokeOrganizationInvite,
} from "@/lib/enterprise/organizations.service";
import { sendOrganizationInviteEmail } from "@/lib/email/org-invite-mailer";
import {
  ApiKeyOrganizationAccessError,
  createUserApiKey,
  listUserApiKeys,
  revokeUserApiKey,
} from "@/lib/enterprise/api-keys.service";
import { activateOrganizationBilling } from "@/lib/enterprise/org-billing.service";
import { resolveProAccessForUser } from "@/lib/enterprise/org-access.service";
import {
  EnterpriseSalesRequiredError,
  sendTeamPlanSalesRequest,
} from "@/lib/enterprise/enterprise-sales";
import { GET as orgGET, POST as orgPOST } from "@/app/api/enterprise/organizations/route";
import { GET as orgDetailGET } from "@/app/api/enterprise/organizations/detail/route";
import {
  DELETE as inviteDELETE,
  GET as inviteGET,
  POST as invitePOST,
  PUT as invitePUT,
} from "@/app/api/enterprise/organizations/invite/route";
import {
  DELETE as membersDELETE,
  GET as membersGET,
} from "@/app/api/enterprise/organizations/members/route";
import {
  DELETE as apiKeyDELETE,
  GET as apiKeyGET,
  POST as apiKeyPOST,
} from "@/app/api/enterprise/api-keys/route";
import { POST as billingActivatePOST } from "@/app/api/enterprise/organizations/billing/activate/route";
import { POST as salesRequestPOST } from "@/app/api/enterprise/organizations/billing/sales-request/route";

function requestJson(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
  } as unknown as NextRequest;
}

function emptyRequest(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

function requestWithQuery(url: string): NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("enterprise route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardGeneralApiRateLimit).mockResolvedValue(null);
    vi.mocked(guardMutationOrigin).mockReturnValue(null);
    vi.mocked(tryGetApiUser).mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "owner@example.com", plan: "pro" },
    } as never);
    vi.mocked(resolveProAccessForUser).mockResolvedValue({
      isPro: true,
      source: "individual",
    });
  });

  it("lists and creates organizations for the authenticated user", async () => {
    vi.mocked(listUserOrganizations).mockResolvedValue([{ id: "org-1", name: "Acme" }] as never);
    vi.mocked(countUserOrganizations).mockResolvedValue(0);
    vi.mocked(createOrganization).mockResolvedValue({
      id: "org-2",
      name: "Beta",
      seat_limit: 5,
    } as never);

    const listResponse = await orgGET(emptyRequest());
    expect(listResponse.status).toBe(200);
    expect(await readJson(listResponse)).toMatchObject({
      organizations: [{ id: "org-1", name: "Acme" }],
    });

    const createResponse = await orgPOST(requestJson({ name: " Beta ", seatLimit: 999 }));
    expect(createResponse.status).toBe(201);
    expect(createOrganization).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "Beta", seatLimit: 999 })
    );
  });

  it("handles API key list, create, access rejection, and revoke", async () => {
    vi.mocked(listUserApiKeys).mockResolvedValue([{ id: "key-1", name: "Prod" }] as never);
    vi.mocked(createUserApiKey).mockResolvedValue({
      record: { id: "key-2", name: "Team key" },
      secret: "omp_secret",
    } as never);

    const listResponse = await apiKeyGET(emptyRequest());
    expect(listResponse.status).toBe(200);
    expect(await readJson(listResponse)).toMatchObject({ keys: [{ id: "key-1" }] });

    const createResponse = await apiKeyPOST(
      requestJson({ name: "Team key", organizationId: "org-1" })
    );
    expect(createResponse.status).toBe(201);
    expect(resolveProAccessForUser).toHaveBeenCalledWith("user-1");
    expect(createUserApiKey).toHaveBeenCalledWith("user-1", "Team key", "org-1");

    vi.mocked(createUserApiKey).mockRejectedValueOnce(
      new ApiKeyOrganizationAccessError("No org access")
    );
    const rejected = await apiKeyPOST(requestJson({ name: "Bad", organizationId: "org-2" }));
    expect(rejected.status).toBe(403);

    const deleteResponse = await apiKeyDELETE(requestJson({ keyId: "key-2" }));
    expect(deleteResponse.status).toBe(200);
    expect(revokeUserApiKey).toHaveBeenCalledWith("user-1", "key-2");
  });

  it("returns structured sales-required response for live team billing", async () => {
    vi.mocked(activateOrganizationBilling).mockRejectedValue(
      new EnterpriseSalesRequiredError("Contact sales", "sales@example.com")
    );

    const response = await billingActivatePOST(
      requestJson({ organizationId: "org-1", duration: "yearly" })
    );
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "ENTERPRISE_SALES_REQUIRED",
      salesEmail: "sales@example.com",
    });
  });

  it("submits enterprise sales requests", async () => {
    vi.mocked(sendTeamPlanSalesRequest).mockResolvedValue({
      delivered: true,
      mode: "email",
    });

    const response = await salesRequestPOST(
      requestJson({ organizationId: "org-1", duration: "monthly", notes: "Need 10 seats" })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, delivered: true });
    expect(sendTeamPlanSalesRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        requesterUserId: "user-1",
        requesterEmail: "owner@example.com",
        duration: "monthly",
      })
    );
  });

  it("loads organization detail and members for org members", async () => {
    vi.mocked(getOrganizationById).mockResolvedValue({ id: "org-1", name: "Acme" } as never);
    vi.mocked(getOrganizationMemberRole).mockResolvedValue("admin");
    vi.mocked(listOrganizationMembers).mockResolvedValue([
      { id: "member-1", user_id: "user-1", role: "owner" },
    ] as never);

    const detail = await orgDetailGET(
      requestWithQuery("https://onlymypdf.test/api?organizationId=org-1")
    );
    expect(detail.status).toBe(200);
    expect(await readJson(detail)).toMatchObject({ organization: { id: "org-1" } });

    const members = await membersGET(
      requestWithQuery("https://onlymypdf.test/api?organizationId=org-1")
    );
    expect(members.status).toBe(200);
    expect(await readJson(members)).toMatchObject({ members: [{ id: "member-1" }] });
  });

  it("removes organization members", async () => {
    const response = await membersDELETE(
      requestJson({ organizationId: "org-1", userId: "user-2" })
    );

    expect(response.status).toBe(200);
    expect(removeOrganizationMember).toHaveBeenCalledWith("org-1", "user-2", "user-1");
  });

  it("manages organization invites", async () => {
    vi.mocked(listOrganizationInvites).mockResolvedValue([{ id: "invite-1" }] as never);
    vi.mocked(createOrganizationInvite).mockResolvedValue({
      id: "invite-2",
      token: "tok_1",
      expiresAt: "2026-01-01T00:00:00.000Z",
    } as never);
    vi.mocked(getOrganizationById).mockResolvedValue({ id: "org-1", name: "Acme" } as never);
    vi.mocked(sendOrganizationInviteEmail).mockResolvedValue({
      delivered: true,
      mode: "email",
    });
    vi.mocked(acceptOrganizationInvite).mockResolvedValue({ organizationName: "Acme" } as never);

    const list = await inviteGET(
      requestWithQuery("https://onlymypdf.test/api?organizationId=org-1")
    );
    expect(list.status).toBe(200);
    expect(await readJson(list)).toMatchObject({ invites: [{ id: "invite-1" }] });

    const created = await invitePOST(
      requestJson({ organizationId: "org-1", email: "new@example.com", role: "admin" })
    );
    expect(created.status).toBe(200);
    expect(createOrganizationInvite).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      "new@example.com",
      "admin"
    );
    expect(sendOrganizationInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
        organizationName: "Acme",
      })
    );

    const accepted = await invitePUT(requestJson({ token: "tok_1" }));
    expect(accepted.status).toBe(200);
    expect(acceptOrganizationInvite).toHaveBeenCalledWith(
      "tok_1",
      "user-1",
      "owner@example.com"
    );

    const deleted = await inviteDELETE(requestJson({ organizationId: "org-1", inviteId: "invite-1" }));
    expect(deleted.status).toBe(200);
    expect(revokeOrganizationInvite).toHaveBeenCalledWith("org-1", "invite-1", "user-1");
  });
});
