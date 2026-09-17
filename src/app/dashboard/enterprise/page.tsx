"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Key,
  Loader2,
  Mail,
  Plus,
  Trash2,
  Users,
  Crown,
  RefreshCw,
} from "lucide-react";
import { DashboardMobileNav } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/components/providers/auth-provider";
import { useTranslation } from "@/i18n";
import { isMockCheckoutClient } from "@/lib/payment/checkout-config";

type Org = {
  id: string;
  name: string;
  slug: string;
  seat_limit: number;
  plan: string;
  plan_status?: string;
  plan_expires_at?: string | null;
  daily_tool_limit?: number;
  daily_usage_count?: number;
  daily_usage_date?: string | null;
  razorpay_subscription_id?: string | null;
  memberCount?: number;
  userRole?: string;
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  full_name?: string | null;
  email?: string | null;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
};

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
};

function readInviteTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  return params.get("invite");
}

function EnterprisePageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPro, proSource, organizationName, refreshProfile, user } = useAuthContext();
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? orgs[0] ?? null;
  const canManage = selectedOrg?.userRole === "owner" || selectedOrg?.userRole === "admin";
  const isOwner = selectedOrg?.userRole === "owner";
  const isMockBilling = isMockCheckoutClient();
  const planActive =
    selectedOrg?.plan_status === "active" || selectedOrg?.plan_status === "past_due";

  const loadOrgDetails = useCallback(async (organizationId: string) => {
    const [membersRes, invitesRes, detailRes] = await Promise.all([
      fetch(`/api/enterprise/organizations/members?organizationId=${organizationId}`, {
        credentials: "include",
      }),
      fetch(`/api/enterprise/organizations/invite?organizationId=${organizationId}`, {
        credentials: "include",
      }),
      fetch(`/api/enterprise/organizations/detail?organizationId=${organizationId}`, {
        credentials: "include",
      }),
    ]);

    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(data.members ?? []);
    }
    if (invitesRes.ok) {
      const data = await invitesRes.json();
      setInvites(data.invites ?? []);
    }
    if (detailRes.ok) {
      const data = await detailRes.json();
      if (data.organization) {
        setOrgs((prev) =>
          prev.map((o) => (o.id === organizationId ? { ...o, ...data.organization } : o))
        );
      }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgRes, keyRes] = await Promise.all([
        fetch("/api/enterprise/organizations", { credentials: "include" }),
        fetch("/api/enterprise/api-keys", { credentials: "include" }),
      ]);
      if (orgRes.ok) {
        const data = await orgRes.json();
        const list = (data.organizations ?? []) as Org[];
        setOrgs(list);
        setSelectedOrgId((prev) =>
          prev && list.some((o) => o.id === prev) ? prev : list[0]?.id ?? null
        );
      }
      if (keyRes.ok) {
        const data = await keyRes.json();
        setKeys(data.keys ?? []);
      }
    } catch {
      setError(t("enterprisePage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setInviteToken(readInviteTokenFromHash());
  }, []);

  async function acceptPendingInvite() {
    if (!inviteToken || !user) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enterprise/organizations/invite", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("enterprisePage.inviteAcceptFailed"));
      setMessage(t("enterprisePage.inviteAccepted", { name: data.organizationName ?? "team" }));
      setInviteToken(null);
      await refreshProfile();
      await load();
      router.replace("/dashboard/enterprise");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("enterprisePage.inviteAcceptFailed"));
    } finally {
      setActionLoading(false);
    }
  }

  function dismissPendingInvite() {
    setInviteToken(null);
    router.replace("/dashboard/enterprise");
  }

  useEffect(() => {
    if (selectedOrgId) void loadOrgDetails(selectedOrgId);
  }, [selectedOrgId, loadOrgDetails]);

  async function createOrg() {
    if (orgName.trim().length < 2) return;
    setActionLoading(true);
    setError(null);
    const res = await fetch("/api/enterprise/organizations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName.trim() }),
    });
    setActionLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? t("enterprisePage.createOrgFailed"));
      return;
    }
    setOrgName("");
    void load();
  }

  async function sendInvite() {
    if (!selectedOrg || !inviteEmail.includes("@")) return;
    setActionLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/enterprise/organizations/invite", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrg.id, email: inviteEmail.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (!res.ok) {
      setError(data.error ?? t("enterprisePage.inviteFailed"));
      return;
    }
    setInviteEmail("");
    setMessage(
      data.emailSent
        ? t("enterprisePage.inviteSent")
        : t("enterprisePage.inviteCreatedNoEmail", { url: data.acceptUrl ?? "" })
    );
    void loadOrgDetails(selectedOrg.id);
  }

  async function revokeInvite(inviteId: string) {
    if (!selectedOrg) return;
    await fetch("/api/enterprise/organizations/invite", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrg.id, inviteId }),
    });
    void loadOrgDetails(selectedOrg.id);
  }

  async function removeMember(userId: string) {
    if (!selectedOrg || !window.confirm(t("enterprisePage.removeMemberConfirm"))) return;
    const res = await fetch("/api/enterprise/organizations/members", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrg.id, userId }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? t("enterprisePage.removeMemberFailed"));
      return;
    }
    void loadOrgDetails(selectedOrg.id);
  }

  async function activateTeamPlan(duration: "monthly" | "yearly") {
    if (!selectedOrg) return;
    setActionLoading(true);
    setError(null);
    const res = await fetch("/api/enterprise/organizations/billing/activate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrg.id, duration }),
    });
    const data = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (!res.ok) {
      if (data.code === "ENTERPRISE_SALES_REQUIRED") {
        setError(
          `${data.error ?? t("enterprisePage.activateFailed")} ${t("enterprisePage.salesContactAt", {
            email: data.salesEmail ?? "support@onlymypdf.in",
          })}`
        );
        return;
      }
      setError(data.error ?? t("enterprisePage.activateFailed"));
      return;
    }
    setMessage(t("enterprisePage.activateSuccess"));
    await refreshProfile();
    void loadOrgDetails(selectedOrg.id);
  }

  async function requestTeamSalesActivation(duration: "monthly" | "yearly") {
    if (!selectedOrg) return;
    setActionLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/enterprise/organizations/billing/sales-request", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrg.id, duration }),
    });
    const data = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (!res.ok) {
      setError(data.error ?? t("enterprisePage.salesRequestFailed"));
      return;
    }
    setMessage(
      data.delivered
        ? t("enterprisePage.salesRequestSent")
        : t("enterprisePage.salesRequestDev")
    );
  }

  async function cancelTeamRenew() {
    if (!selectedOrg || !window.confirm(t("enterprisePage.cancelRenewConfirm"))) return;
    setActionLoading(true);
    const res = await fetch("/api/enterprise/organizations/billing/activate", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrg.id }),
    });
    setActionLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? t("enterprisePage.cancelRenewFailed"));
      return;
    }
    setMessage(t("enterprisePage.cancelRenewSuccess"));
    void loadOrgDetails(selectedOrg.id);
  }

  async function createKey() {
    if (!selectedOrg) return;
    const res = await fetch("/api/enterprise/api-keys", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Production API key", organizationId: selectedOrg.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? t("enterprisePage.keyCreateFailed"));
      return;
    }
    setNewSecret(data.secret ?? null);
    void load();
  }

  async function revokeKey(keyId: string) {
    await fetch("/api/enterprise/api-keys", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId }),
    });
    void load();
  }

  async function deleteOrganization() {
    if (!selectedOrg || !window.confirm(t("enterprisePage.deleteOrgConfirm"))) return;
    setActionLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/enterprise/organizations/detail", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selectedOrg.id }),
    });
    setActionLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? t("enterprisePage.deleteOrgFailed"));
      return;
    }
    setMessage(t("enterprisePage.deleteOrgSuccess"));
    setSelectedOrgId(null);
    void load();
  }

  const usageToday =
    selectedOrg?.daily_usage_date === new Date().toISOString().slice(0, 10)
      ? (selectedOrg.daily_usage_count ?? 0)
      : 0;

  return (
    <>
      <DashboardMobileNav />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-pd-foreground">{t("enterprisePage.title")}</h1>
            <p className="mt-2 text-sm text-pd-muted">{t("enterprisePage.subtitle")}</p>
            {proSource === "organization" && organizationName && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                <Crown className="h-3.5 w-3.5" />
                {t("enterprisePage.orgProBadge", { name: organizationName })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-pd-border px-3 py-1.5 text-xs font-semibold text-pd-muted hover:text-pd-brand"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("enterprisePage.refresh")}
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {inviteToken && user && (
          <div className="mt-4 rounded-xl border border-pd-brand/30 bg-pd-brand-muted/40 p-4">
            <p className="text-sm font-medium text-pd-foreground">{t("enterprisePage.invitePrompt")}</p>
            <p className="mt-1 text-sm text-pd-muted">{t("enterprisePage.invitePromptDesc")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void acceptPendingInvite()} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("enterprisePage.acceptingInvite")}
                  </>
                ) : (
                  t("enterprisePage.acceptInviteBtn")
                )}
              </Button>
              <Button variant="outline" onClick={dismissPendingInvite} disabled={actionLoading}>
                {t("enterprisePage.declineInviteBtn")}
              </Button>
            </div>
          </div>
        )}

        {newSecret && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-semibold text-emerald-900">{t("enterprisePage.keyCreated")}</p>
            <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-xs">{newSecret}</code>
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-pd-border bg-pd-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-pd-brand" />
            <h2 className="font-semibold">{t("enterprisePage.organizations")}</h2>
          </div>

          {loading ? (
            <p className="text-sm text-pd-muted">{t("enterprisePage.loading")}</p>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-pd-muted">{t("enterprisePage.noOrgs")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    selectedOrg?.id === org.id
                      ? "border-pd-brand bg-pd-brand-muted text-pd-brand"
                      : "border-pd-border bg-pd-background text-pd-foreground hover:border-pd-brand/40"
                  }`}
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={t("enterprisePage.orgNamePlaceholder")}
              className="flex-1 rounded-lg border border-pd-border px-3 py-2 text-sm"
            />
            <Button type="button" onClick={() => void createOrg()} disabled={orgName.trim().length < 2 || actionLoading}>
              <Plus className="mr-1 h-4 w-4" />
              {t("enterprisePage.createOrg")}
            </Button>
          </div>
        </section>

        {selectedOrg && (
          <>
            <section className="mt-6 rounded-2xl border border-pd-border bg-pd-surface p-5">
              <h2 className="font-semibold">{selectedOrg.name}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-xl bg-pd-background px-3 py-2">
                  <p className="text-xs text-pd-muted">{t("enterprisePage.planStatus")}</p>
                  <p className="font-semibold capitalize">{selectedOrg.plan_status ?? "inactive"}</p>
                  {selectedOrg.plan_expires_at && (
                    <p className="text-xs text-pd-muted">
                      {t("enterprisePage.expires")}{" "}
                      {new Date(selectedOrg.plan_expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-pd-background px-3 py-2">
                  <p className="text-xs text-pd-muted">{t("enterprisePage.seats")}</p>
                  <p className="font-semibold">
                    {selectedOrg.memberCount ?? members.length} / {selectedOrg.seat_limit}
                  </p>
                  <p className="text-xs text-pd-muted">
                    {t("enterprisePage.teamUsage", {
                      used: String(usageToday),
                      limit: String(selectedOrg.daily_tool_limit ?? 500),
                    })}
                  </p>
                </div>
              </div>

              {isOwner && !planActive && isMockBilling && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={actionLoading} onClick={() => void activateTeamPlan("monthly")}>
                    {t("enterprisePage.activateMonthly")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={actionLoading} onClick={() => void activateTeamPlan("yearly")}>
                    {t("enterprisePage.activateYearly")}
                  </Button>
                  <p className="w-full text-xs text-pd-muted">{t("enterprisePage.activateHint")}</p>
                </div>
              )}

              {isOwner && !planActive && !isMockBilling && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={actionLoading} onClick={() => void requestTeamSalesActivation("monthly")}>
                    {t("enterprisePage.requestTeamMonthly")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={actionLoading} onClick={() => void requestTeamSalesActivation("yearly")}>
                    {t("enterprisePage.requestTeamYearly")}
                  </Button>
                  <p className="w-full text-xs text-pd-muted">{t("enterprisePage.liveBillingHint")}</p>
                </div>
              )}

              {isOwner && planActive && selectedOrg.razorpay_subscription_id && (
                <Button type="button" size="sm" variant="outline" className="mt-4" disabled={actionLoading} onClick={() => void cancelTeamRenew()}>
                  {t("enterprisePage.cancelAutoRenew")}
                </Button>
              )}

              {isOwner && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-4 border-red-200 text-red-700 hover:bg-red-50"
                  disabled={actionLoading}
                  onClick={() => void deleteOrganization()}
                >
                  {t("enterprisePage.deleteOrg")}
                </Button>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-pd-border bg-pd-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-pd-brand" />
                <h2 className="font-semibold">{t("enterprisePage.members")}</h2>
              </div>
              <ul className="space-y-2 text-sm">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg bg-pd-background px-3 py-2">
                    <span>
                      {m.full_name || m.email || m.user_id.slice(0, 8)}
                      <span className="ml-2 text-xs text-pd-muted">{m.role}</span>
                    </span>
                    {canManage && m.role !== "owner" && (
                      <button type="button" onClick={() => void removeMember(m.user_id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {canManage && (
                <div className="mt-4 flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t("enterprisePage.inviteEmailPlaceholder")}
                    className="flex-1 rounded-lg border border-pd-border px-3 py-2 text-sm"
                  />
                  <Button type="button" disabled={!inviteEmail.includes("@") || actionLoading} onClick={() => void sendInvite()}>
                    <Mail className="mr-1 h-4 w-4" />
                    {t("enterprisePage.invite")}
                  </Button>
                </div>
              )}

              {invites.length > 0 && canManage && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase text-pd-muted">{t("enterprisePage.pendingInvites")}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {invites.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                        <span>
                          {inv.email} · {inv.role}
                        </span>
                        <button type="button" onClick={() => void revokeInvite(inv.id)} className="text-red-600">
                          {t("enterprisePage.revoke")}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}

        <section className="mt-6 rounded-2xl border border-pd-border bg-pd-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-pd-brand" />
              <h2 className="font-semibold">{t("enterprisePage.apiKeys")}</h2>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void createKey()} disabled={!isPro || !selectedOrg}>
              {t("enterprisePage.newKey")}
            </Button>
          </div>
          {!isPro ? (
            <p className="text-sm text-pd-muted">
              {t("enterprisePage.proRequired")}{" "}
              <Link href="/dashboard/pricing" className="text-pd-brand hover:underline">
                {t("dashboard.upgradeToPro")}
              </Link>
            </p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-pd-muted">{t("enterprisePage.noKeys")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {keys.map((key) => (
                <li key={key.id} className="flex items-center justify-between rounded-lg bg-pd-background px-3 py-2">
                  <span>
                    {key.name} · <code>{key.key_prefix}…</code>
                  </span>
                  <button type="button" onClick={() => void revokeKey(key.id)} className="text-red-600 hover:text-red-700" aria-label="Revoke key">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-6 text-xs text-pd-muted">
          {t("enterprisePage.salesNote")}{" "}
          <Link href="/contact?subject=business" className="text-pd-brand hover:underline">
            {t("enterprisePage.contactSales")}
          </Link>{" "}
          ·{" "}
          <Link href="/trust" className="text-pd-brand hover:underline">
            {t("nav.trust")}
          </Link>
        </p>
      </div>
    </>
  );
}

export default function DashboardEnterprisePage() {
  return (
    <Suspense fallback={null}>
      <EnterprisePageContent />
    </Suspense>
  );
}
