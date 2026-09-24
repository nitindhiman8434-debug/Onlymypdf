import { isLocalDevActivityEnabled } from "@/lib/auth/local-dev-activity";
import { createServiceClient } from "@/lib/supabase/server";
import type { ValidCustomerFeedback } from "@/lib/validation/customer-feedback-validation";

export class CustomerFeedbackError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "CustomerFeedbackError";
  }
}

export async function getCustomerFeedbackContext(userId: string) {
  if (isLocalDevActivityEnabled()) {
    const { getLocalDevCustomerFeedback } = await import("@/lib/auth/local-dev-activity");
    return getLocalDevCustomerFeedback(userId);
  }

  const supabase = await createServiceClient();
  const [{ data: jobs, error: jobsError }, { data: feedback, error: feedbackError }] =
    await Promise.all([
      supabase
        .from("tool_jobs")
        .select("id, tool_name, status, created_at, completed_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(50),
      supabase
        .from("customer_feedback")
        .select(
          "id, tool_job_id, tool_name, overall_rating, accuracy_rating, speed_rating, comment, publish_consent, consent_version, status, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (jobsError) throw jobsError;
  if (feedbackError) throw feedbackError;
  const reviewedJobIds = new Set((feedback ?? []).map((entry) => entry.tool_job_id));
  return {
    jobs: (jobs ?? []).filter((job) => !reviewedJobIds.has(job.id)).slice(0, 20),
    feedback: feedback ?? [],
  };
}

export async function createCustomerFeedback(
  userId: string,
  payload: ValidCustomerFeedback
) {
  if (isLocalDevActivityEnabled()) {
    const { createLocalDevCustomerFeedback } = await import(
      "@/lib/auth/local-dev-activity"
    );
    try {
      return await createLocalDevCustomerFeedback({
        userId,
        jobId: payload.jobId,
        overallRating: payload.overallRating,
        accuracyRating: payload.accuracyRating,
        speedRating: payload.speedRating,
        comment: payload.comment,
        publishConsent: payload.publishConsent,
        consentVersion: payload.consentVersion,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Feedback could not be saved.";
      throw new CustomerFeedbackError(message, message.includes("already") ? 409 : 404);
    }
  }

  const supabase = await createServiceClient();
  const { data: job, error: jobError } = await supabase
    .from("tool_jobs")
    .select("id, tool_name, status")
    .eq("id", payload.jobId)
    .eq("user_id", userId)
    .eq("status", "completed")
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) {
    throw new CustomerFeedbackError("Completed conversion not found.", 404);
  }

  const { data, error } = await supabase
    .from("customer_feedback")
    .insert({
      user_id: userId,
      tool_job_id: job.id,
      tool_name: job.tool_name,
      overall_rating: payload.overallRating,
      accuracy_rating: payload.accuracyRating,
      speed_rating: payload.speedRating,
      comment: payload.comment,
      publish_consent: payload.publishConsent,
      consent_version: payload.consentVersion,
    })
    .select(
      "id, tool_job_id, tool_name, overall_rating, accuracy_rating, speed_rating, comment, publish_consent, consent_version, status, created_at"
    )
    .single();

  if (error?.code === "23505") {
    throw new CustomerFeedbackError("Feedback already exists for this conversion.", 409);
  }
  if (error) throw error;
  return data;
}

export async function deleteCustomerFeedback(userId: string, feedbackId: string) {
  if (isLocalDevActivityEnabled()) {
    const { deleteLocalDevCustomerFeedback } = await import(
      "@/lib/auth/local-dev-activity"
    );
    const deleted = await deleteLocalDevCustomerFeedback(userId, feedbackId);
    if (!deleted) throw new CustomerFeedbackError("Feedback not found.", 404);
    return;
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("customer_feedback")
    .delete()
    .eq("id", feedbackId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CustomerFeedbackError("Feedback not found.", 404);
}
