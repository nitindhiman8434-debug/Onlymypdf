export const CUSTOMER_FEEDBACK_CONSENT_VERSION = "customer-feedback-2026-09-24";
export const CUSTOMER_FEEDBACK_COMMENT_MIN = 20;
export const CUSTOMER_FEEDBACK_COMMENT_MAX = 2000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CustomerFeedbackPayload = {
  jobId?: string;
  overallRating?: number;
  accuracyRating?: number;
  speedRating?: number;
  comment?: string;
  researchConsent?: boolean;
  publishConsent?: boolean;
};

export type ValidCustomerFeedback = {
  jobId: string;
  overallRating: number;
  accuracyRating: number;
  speedRating: number;
  comment: string;
  publishConsent: boolean;
  consentVersion: string;
};

export type CustomerFeedbackValidationResult =
  | { ok: true; data: ValidCustomerFeedback }
  | { ok: false; status: 400; error: string };

function isRating(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

export function validateCustomerFeedback(
  payload: CustomerFeedbackPayload
): CustomerFeedbackValidationResult {
  const jobId = payload.jobId?.trim() ?? "";
  const comment = payload.comment?.trim() ?? "";

  if (!UUID_PATTERN.test(jobId)) {
    return { ok: false, status: 400, error: "Choose a valid completed conversion." };
  }
  if (!isRating(payload.overallRating)) {
    return { ok: false, status: 400, error: "Overall rating must be between 1 and 5." };
  }
  if (!isRating(payload.accuracyRating)) {
    return { ok: false, status: 400, error: "Accuracy rating must be between 1 and 5." };
  }
  if (!isRating(payload.speedRating)) {
    return { ok: false, status: 400, error: "Speed rating must be between 1 and 5." };
  }
  if (comment.length < CUSTOMER_FEEDBACK_COMMENT_MIN) {
    return {
      ok: false,
      status: 400,
      error: `Feedback must be at least ${CUSTOMER_FEEDBACK_COMMENT_MIN} characters.`,
    };
  }
  if (comment.length > CUSTOMER_FEEDBACK_COMMENT_MAX) {
    return {
      ok: false,
      status: 400,
      error: `Feedback must be ${CUSTOMER_FEEDBACK_COMMENT_MAX} characters or fewer.`,
    };
  }
  if (payload.researchConsent !== true) {
    return {
      ok: false,
      status: 400,
      error: "Consent is required to store this feedback.",
    };
  }

  return {
    ok: true,
    data: {
      jobId,
      overallRating: payload.overallRating,
      accuracyRating: payload.accuracyRating,
      speedRating: payload.speedRating,
      comment,
      publishConsent: payload.publishConsent === true,
      consentVersion: CUSTOMER_FEEDBACK_CONSENT_VERSION,
    },
  };
}
