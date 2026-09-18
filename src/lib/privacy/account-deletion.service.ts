import { countUserOrganizations } from "@/lib/enterprise/organizations.service";
import { cancelLocalSubscription } from "@/lib/services/subscription-fulfillment.service";
import { cancelRazorpaySubscription } from "@/lib/services/payment.service";
import { createServiceClient } from "@/lib/supabase/server";
import { getUserUploadedFilePaths, logError, markFileDeleted } from "@/lib/db/queries";
import { deleteFile } from "@/lib/services/upload.service";

export type AccountDeletionBlock =
  | { ok: true }
  | { ok: false; status: number; error: string };

export class AccountFileDeletionError extends Error {
  constructor(failureCount: number) {
    super(
      `Could not delete ${failureCount} stored file(s). The account was kept so deletion can be retried.`
    );
    this.name = "AccountFileDeletionError";
  }
}

type AccountFileDeletionDependencies = {
  listFiles: typeof getUserUploadedFilePaths;
  deleteStoredFile: typeof deleteFile;
  markDeleted: typeof markFileDeleted;
  recordError: typeof logError;
};

const accountFileDeletionDefaults: AccountFileDeletionDependencies = {
  listFiles: getUserUploadedFilePaths,
  deleteStoredFile: deleteFile,
  markDeleted: markFileDeleted,
  recordError: logError,
};

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

/**
 * Delete account-linked storage objects before removing their database rows.
 * A failed object remains discoverable for a later retry instead of becoming orphaned.
 */
export async function deleteAccountLinkedFilesBeforeRemoval(
  userId: string,
  dependencies: AccountFileDeletionDependencies = accountFileDeletionDefaults
): Promise<number> {
  const files = await dependencies.listFiles(userId);
  const failures: string[] = [];
  let deleted = 0;

  for (const file of files) {
    try {
      await dependencies.deleteStoredFile(file.storage_path);
      await dependencies.markDeleted(file.id);
      deleted += 1;
    } catch (error) {
      failures.push(file.id);
      await dependencies.recordError({
        user_id: userId,
        tool_name: "account-deletion",
        error_type: "ACCOUNT_FILE_DELETE_FAILED",
        error_message: error instanceof Error ? error.message : String(error),
        metadata: { file_id: file.id },
      });
    }
  }

  if (failures.length > 0) {
    throw new AccountFileDeletionError(failures.length);
  }

  return deleted;
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
