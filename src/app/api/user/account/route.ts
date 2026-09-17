import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";

import { tryGetApiUser, type ApiUser } from "@/lib/auth/get-api-user";

import {

  getUserJobs,

  getUserProfile,

  getUserUploadedFilePaths,

  markFileDeleted,

  deleteUserConsentRecords,

  deleteUserErrorLogs,

  getUserConsentRecords,

  getUserUsageLogsForExport,

  getUserAiUsageLogsForExport,

  getUserUploadedFilesMetadata,

} from "@/lib/db/queries";

import { deleteFile } from "@/lib/services/upload.service";

import { guardGeneralApiRateLimit, checkReauthRateLimit, rateLimitResponse } from "@/lib/server/rate-limiter";

import { guardMutationOrigin } from "@/lib/server/mutation-origin";

import { toSafeApiError, captureApiError } from "@/lib/server/safe-error";

import { buildGdprExportPayload } from "@/lib/privacy/gdpr-export";

import { sanitizeOrganizationForRole } from "@/lib/enterprise/org-member-view";

import { verifyUserStepUp } from "@/lib/auth/verify-reauth";
import { clearStepUpCookie } from "@/lib/auth/step-up-auth";
import {
  anonymizeBillingInvoicesForUser,
  assertAccountDeletionAllowed,
  cancelUserBillingBeforeDelete,
  scrubUserFileMetadata,
} from "@/lib/privacy/account-deletion.service";



async function buildUserDataExportResponse(user: ApiUser): Promise<NextResponse> {

  const supabase = await createServiceClient();

  const profile = await getUserProfile(user.id);

  const jobs = await getUserJobs(user.id, 1000);



  const [

    { data: payments },

    { data: subscriptions },

    consentRecords,

    usageLogs,

    aiUsageLogs,

    uploadedFiles,

    { data: orgMemberships },

    { data: apiKeys },

    { data: billingInvoices },

  ] = await Promise.all([

    supabase

      .from("payments")

      .select("id, amount, currency, status, created_at, plan_name")

      .eq("user_id", user.id)

      .order("created_at", { ascending: false })

      .limit(500),

    supabase

      .from("subscriptions")

      .select("id, status, current_period_end, created_at, plan_id")

      .eq("user_id", user.id)

      .order("created_at", { ascending: false })

      .limit(50),

    getUserConsentRecords(user.id),

    getUserUsageLogsForExport(user.id),

    getUserAiUsageLogsForExport(user.id),

    getUserUploadedFilesMetadata(user.id),

    supabase

      .from("organization_members")

      .select(

        "role, joined_at, organizations ( id, name, slug, plan, plan_status, seat_limit, billing_email, created_at )"

      )

      .eq("user_id", user.id),

    supabase

      .from("api_keys")

      .select(

        "id, name, key_prefix, organization_id, scopes, created_at, last_used_at, expires_at, revoked_at"

      )

      .eq("user_id", user.id)

      .order("created_at", { ascending: false }),

    supabase

      .from("billing_invoices")

      .select(

        "id, invoice_number, organization_id, amount_paise, tax_paise, status, created_at, payment_id"

      )

      .eq("user_id", user.id)

      .order("created_at", { ascending: false })

      .limit(500),

  ]);



  const organizationMemberships = (orgMemberships ?? []).map((row) => {
    const rawOrg = (
      row as { organizations: Record<string, unknown> | Record<string, unknown>[] | null }
    ).organizations;
    const record = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg;
    const sanitizedOrg = record
      ? sanitizeOrganizationForRole(
          record as Parameters<typeof sanitizeOrganizationForRole>[0],
          String(row.role)
        )
      : null;

    return {
      role: row.role,
      joined_at: row.joined_at,
      organization: sanitizedOrg,
    };
  });

  const organizations: Record<string, unknown>[] = organizationMemberships
    .map((row) => row.organization)
    .filter((org) => org != null)
    .map((org) => org as Record<string, unknown>);

  const exportPayload = buildGdprExportPayload({

    user: { id: user.id, email: user.email, plan: user.plan },

    profile: profile

      ? {

          full_name: profile.full_name,

          preferred_language: profile.preferred_language,

          usage_count_today: profile.usage_count_today,

          total_usage_count: profile.total_usage_count,

          created_at: profile.created_at,

        }

      : null,

    toolJobs: jobs.map((j: Record<string, unknown>) => ({

      id: j.id,

      tool_name: j.tool_name,

      status: j.status,

      created_at: j.created_at,

      completed_at: j.completed_at,

      file_size_bytes: j.file_size_bytes,

    })),

    payments: payments ?? [],

    subscriptions: subscriptions ?? [],

    consentRecords,

    usageLogs,

    aiUsageLogs,

    uploadedFiles,

    organizations,

    organizationMemberships,

    apiKeys: (apiKeys ?? []).map((key) => ({

      id: key.id,

      name: key.name,

      key_prefix: key.key_prefix,

      organization_id: key.organization_id,

      scopes: key.scopes,

      created_at: key.created_at,

      last_used_at: key.last_used_at,

      expires_at: key.expires_at,

      revoked_at: key.revoked_at,

    })),

    billingInvoices: billingInvoices ?? [],

  });



  return new NextResponse(JSON.stringify(exportPayload, null, 2), {

    status: 200,

    headers: {

      "Content-Type": "application/json",

      "Content-Disposition": `attachment; filename="onlymypdf-data-export-${user.id.slice(0, 8)}.json"`,

    },

  });

}



export async function POST(request: NextRequest) {

  const rateLimited = await guardGeneralApiRateLimit(request);

  if (rateLimited) return rateLimited;



  const originBlocked = guardMutationOrigin(request);

  if (originBlocked) return originBlocked;



  try {

    const auth = await tryGetApiUser();

    if (!auth.ok) return auth.response;

    const user = auth.user;



    const body = await request.json().catch(() => ({}));

    const password = typeof body.password === "string" ? body.password : "";

    const reauthRate = await checkReauthRateLimit(request, user.id);
    if (!reauthRate.allowed) return rateLimitResponse(reauthRate.retryAfterSec);

    const reauthOk = await verifyUserStepUp({
      request,
      userId: user.id,
      email: user.email,
      purpose: "export",
      password,
    });

    if (!reauthOk) {
      return NextResponse.json(
        {
          error: password
            ? "Incorrect password."
            : "Confirm your identity before exporting data.",
        },
        { status: 403 }
      );
    }

    const response = await buildUserDataExportResponse(user);
    return clearStepUpCookie(response);

  } catch (error) {

    captureApiError(error, { route: "user/account", method: "POST" });

    const message = toSafeApiError(error, "Failed to export data");

    return NextResponse.json({ error: message }, { status: 500 });

  }

}



export async function DELETE(request: NextRequest) {

  const rateLimited = await guardGeneralApiRateLimit(request);

  if (rateLimited) return rateLimited;



  const originBlocked = guardMutationOrigin(request);

  if (originBlocked) return originBlocked;



  try {

    const auth = await tryGetApiUser();

    if (!auth.ok) return auth.response;

    const user = auth.user;



    const body = await request.json().catch(() => ({}));

    const password = typeof body.password === "string" ? body.password : "";

    const reauthRate = await checkReauthRateLimit(request, user.id);
    if (!reauthRate.allowed) return rateLimitResponse(reauthRate.retryAfterSec);

    const reauthOk = await verifyUserStepUp({
      request,
      userId: user.id,
      email: user.email,
      purpose: "delete",
      password,
    });

    if (!reauthOk) {
      return NextResponse.json(
        {
          error: password
            ? "Incorrect password."
            : "Confirm your identity before deleting your account.",
        },
        { status: 403 }
      );
    }

    const deletionAllowed = await assertAccountDeletionAllowed(user.id);
    if (!deletionAllowed.ok) {
      return NextResponse.json(
        { error: deletionAllowed.error },
        { status: deletionAllowed.status }
      );
    }

    await cancelUserBillingBeforeDelete(user.id);
    await anonymizeBillingInvoicesForUser(user.id);
    await scrubUserFileMetadata(user.id);

    const supabase = await createServiceClient();



    const files = await getUserUploadedFilePaths(user.id);

    for (const file of files) {

      try {

        await deleteFile(file.storage_path);

        await markFileDeleted(file.id);

      } catch {

        await markFileDeleted(file.id);

      }

    }



    await supabase.from("api_keys").delete().eq("user_id", user.id);

    await supabase.from("uploaded_files").delete().eq("user_id", user.id);

    await supabase.from("tool_jobs").delete().eq("user_id", user.id);

    await supabase.from("usage_logs").delete().eq("user_id", user.id);

    await supabase.from("ai_usage_logs").delete().eq("user_id", user.id);

    await deleteUserConsentRecords(user.id);

    await deleteUserErrorLogs(user.id);

    await supabase.from("user_profiles").delete().eq("id", user.id);



    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

    if (authError) {

      return NextResponse.json(

        { error: "Account deletion failed. Contact support." },

        { status: 500 }

      );

    }



    const response = NextResponse.json({

      success: true,

      message:

        "Your account and personal data have been deleted. Anonymized billing and tax records may be retained as required by law.",

    });
    return clearStepUpCookie(response);

  } catch (error) {

    captureApiError(error, { route: "user/account", method: "DELETE" });

    const message = toSafeApiError(error, "Failed to delete account");

    return NextResponse.json({ error: message }, { status: 500 });

  }

}


