import { describe, expect, it } from "vitest";
import {
  CUSTOMER_FEEDBACK_CONSENT_VERSION,
  validateCustomerFeedback,
} from "@/lib/validation/customer-feedback-validation";

const validPayload = {
  jobId: "4f0dbf64-6a8f-4c0c-b29c-279468570bbc",
  overallRating: 5,
  accuracyRating: 4,
  speedRating: 5,
  comment: "The converted document kept the table structure editable.",
  researchConsent: true,
  publishConsent: false,
};

describe("validateCustomerFeedback", () => {
  it("accepts explicit consent and normalized ratings", () => {
    const result = validateCustomerFeedback(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.consentVersion).toBe(CUSTOMER_FEEDBACK_CONSENT_VERSION);
      expect(result.data.publishConsent).toBe(false);
    }
  });

  it("requires a completed-job identifier shape", () => {
    const result = validateCustomerFeedback({ ...validPayload, jobId: "job-1" });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Choose a valid completed conversion.",
    });
  });

  it("rejects out-of-range ratings", () => {
    const result = validateCustomerFeedback({ ...validPayload, accuracyRating: 0 });
    expect(result.ok).toBe(false);
  });

  it("requires storage consent independently from publication consent", () => {
    const result = validateCustomerFeedback({
      ...validPayload,
      researchConsent: false,
      publishConsent: true,
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Consent is required to store this feedback.",
    });
  });

  it("rejects comments above the privacy-safe size boundary", () => {
    const result = validateCustomerFeedback({
      ...validPayload,
      comment: "x".repeat(2001),
    });
    expect(result.ok).toBe(false);
  });
});
