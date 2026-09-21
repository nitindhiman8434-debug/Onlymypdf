import { describe, expect, it } from "vitest";
import { FILE_LIMITS } from "@/config/constants";
import {
  BILLING_COPY,
  fileSizeLimitShortAnswer,
  planFileSizeFaqLine,
  toolPageUploadSubHint,
  TOOL_UPLOAD_SUB_HINT,
  uploadDropzoneSizeLabel,
} from "./billing-copy";

describe("billing-copy", () => {
  it("planFileSizeFaqLine reflects configured limits", () => {
    const line = planFileSizeFaqLine();
    expect(line).toContain(String(FILE_LIMITS.maxFreeFileSizeMB));
    expect(line).toContain(String(FILE_LIMITS.maxProFileSizeMB));
    expect(line.toLowerCase()).not.toContain("unlimited");
  });

  it("fileSizeLimitShortAnswer matches free and pro labels", () => {
    const answer = fileSizeLimitShortAnswer();
    expect(answer).toMatch(/free users/i);
    expect(answer).toMatch(/pro users/i);
  });

  it("includes refund and Razorpay references", () => {
    expect(BILLING_COPY.refundSummary).toMatch(/refund policy/i);
    expect(BILLING_COPY.paymentMethods).toMatch(/Razorpay/i);
    expect(BILLING_COPY.checkoutModel).toMatch(/renews automatically/i);
    expect(BILLING_COPY.checkoutModel).toMatch(/one-time purchase/i);
  });

  it("tool upload hints reflect configured limits", () => {
    expect(TOOL_UPLOAD_SUB_HINT).toContain(String(FILE_LIMITS.maxFreeFileSizeMB));
    expect(TOOL_UPLOAD_SUB_HINT).toContain(String(FILE_LIMITS.maxProFileSizeMB));
    expect(toolPageUploadSubHint()).toBe(TOOL_UPLOAD_SUB_HINT);
    expect(uploadDropzoneSizeLabel(FILE_LIMITS.maxFreeFileSizeMB)).toContain(
      String(FILE_LIMITS.maxFreeFileSizeMB)
    );
    expect(uploadDropzoneSizeLabel(0)).toBe(fileSizeLimitShortAnswer());
  });
});
