import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMockOrderId,
  createMockPaymentId,
  createMockPaymentSignature,
  verifyMockPaymentSignature,
} from "@/lib/billing/mock-billing.service";

describe("mock-billing.service", () => {
  it("creates mock ids with expected prefixes", () => {
    expect(createMockOrderId()).toMatch(/^order_mock_/);
    expect(createMockPaymentId()).toMatch(/^pay_mock_/);
  });

  it("creates mock subscription ids and detects mock prefixes", async () => {
    const { createMockSubscriptionId, isMockSubscriptionId } = await import(
      "@/lib/billing/mock-billing.service"
    );
    const subId = createMockSubscriptionId();
    expect(subId).toMatch(/^sub_mock_/);
    expect(isMockSubscriptionId(subId)).toBe(true);
    expect(isMockSubscriptionId("sub_live_abc")).toBe(false);
  });

  it("verifies mock payment signatures", () => {
    const orderId = createMockOrderId();
    const paymentId = createMockPaymentId();
    const sig = createMockPaymentSignature(orderId, paymentId);
    expect(verifyMockPaymentSignature(orderId, paymentId, sig)).toBe(true);
    expect(verifyMockPaymentSignature(orderId, paymentId, "mock_bad")).toBe(false);
  });
});

describe("billing-config", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("uses mock mode when BILLING_MODE=mock", async () => {
    process.env.BILLING_MODE = "mock";
    const { getBillingMode, isMockBillingMode } = await import("@/lib/billing/billing-config");
    expect(getBillingMode()).toBe("mock");
    expect(isMockBillingMode()).toBe(true);
  });

  it("defaults to mock in development without Razorpay keys", async () => {
    delete process.env.BILLING_MODE;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    vi.stubEnv("NODE_ENV", "development");
    const { getBillingMode } = await import("@/lib/billing/billing-config");
    expect(getBillingMode()).toBe("mock");
  });

  it("reports live Razorpay availability when keys are configured", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test";
    const { isLiveRazorpayConfigured, isBillingCheckoutAvailable } = await import(
      "@/lib/billing/billing-config"
    );
    expect(isLiveRazorpayConfigured()).toBe(true);
    expect(isBillingCheckoutAvailable()).toBe(true);
  });

  it("returns checkout unavailable message when live keys are missing", async () => {
    delete process.env.BILLING_MODE;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    vi.stubEnv("NODE_ENV", "production");
    const { getCheckoutUnavailableMessage, isBillingCheckoutAvailable } = await import(
      "@/lib/billing/billing-config"
    );
    expect(isBillingCheckoutAvailable()).toBe(false);
    expect(getCheckoutUnavailableMessage()).toContain("Online payments are not configured");
  });

  it("enables subscription billing when mock mode is active", async () => {
    process.env.BILLING_MODE = "mock";
    const { isSubscriptionBillingAvailable } = await import("@/lib/billing/billing-config");
    expect(isSubscriptionBillingAvailable()).toBe(true);
  });

  it("allows a production-safe disabled mode without exposing checkout", async () => {
    process.env.BILLING_MODE = "disabled";
    process.env.NEXT_PUBLIC_BILLING_MODE = "disabled";
    process.env.RAZORPAY_KEY_ID = "should-not-enable-disabled-mode";
    process.env.RAZORPAY_KEY_SECRET = "should-not-enable-disabled-mode";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "should-not-enable-disabled-mode";

    const {
      getBillingMode,
      getCheckoutUnavailableMessage,
      isBillingCheckoutAvailable,
      isSubscriptionBillingAvailable,
    } = await import("@/lib/billing/billing-config");

    expect(getBillingMode()).toBe("disabled");
    expect(isBillingCheckoutAvailable()).toBe(false);
    expect(isSubscriptionBillingAvailable()).toBe(false);
    expect(getCheckoutUnavailableMessage()).toContain("temporarily unavailable");
  });
});
