import { countUserOrganizations } from "@/lib/enterprise/organizations.service";
import { cancelLocalSubscription } from "@/lib/services/subscription-fulfillment.service";
import { cancelRazorpaySubscription } from "@/lib/services/payment.service";
import { createServiceClient } from "@/lib/supabase/server";

export type AccountDeletionBlock =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Block delete while the user still owns one or more organizations. */
export async function assertAccountDeletionAllowed(userId: string): Promise<AccountDeletionBlock> {
  const ownedOrgs = await countUserOrganizations(userId);
  if (ownedOrgs > 0) {
    return {
      ok: false,
      status: 409,
      error:
        "Transfer organization ownership or delete your teams before deleting your account.",
    };
  }
  return { ok: true };
}

/** Cancel auto-renew subscriptions at Razorpay and locally before account removal. */
export async function cancelUserBillingBeforeDelete(userId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("razorpay_subscription_id")
    .eq("user_id", userId)
    .in("status", ["active", "past_due"]);

  for (const sub of subscriptions ?? []) {
    const razorpayId = sub.razorpay_subscription_id?.trim();
    if (!razorpayId) continue;
    try {
      await cancelRazorpaySubscription(razorpayId);
    } catch {
      // still mark local cancel if gateway is unreachable
    }
    await cancelLocalSubscription(razorpayId);
  }
}

/** Clear original filenames before rows are deleted or orphaned. */
export async function scrubUserFileMetadata(userId: string): Promise<void> {
  const supabase = await createServiceClient();
  await supabase
    .from("uploaded_files")
    .update({
      original_name: "deleted",
      stored_name: "deleted",
    })
    .eq("user_id", userId);
  await supabase
    .from("tool_jobs")
    .update({
      input_files: [],
      output_file: null,
    })
    .eq("user_id", userId);
}

/** Redact invoice PII; user_id is cleared via ON DELETE SET NULL when auth user is removed. */
export async function anonymizeBillingInvoicesForUser(userId: string): Promise<void> {
  const supabase = await createServiceClient();
  await supabase
    .from("billing_invoices")
    .update({
      billing_name: null,
      billing_email: null,
      billing_state: null,
      line_items: [],
    })
    .eq("user_id", userId);
}
