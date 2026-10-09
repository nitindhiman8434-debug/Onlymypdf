import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/en.json";
import PricingPage from "./page";

const { auth, checkout, router } = vi.hoisted(() => ({
  auth: {
    loading: true,
    user: null as { id: string; email: string } | null,
    profile: null,
    isPro: false,
  },
  checkout: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuthContext: () => auth,
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/hooks/use-pro-checkout", () => ({
  useProCheckout: () => ({ checkout, loading: false, error: null }),
}));

function buttonsNamed(html: string, name: string) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter((match) => match[2].replace(/<[^>]*>/g, "").trim() === name)
    .map((match) => ({ disabled: /\bdisabled(?:=|\s|$)/.test(match[1]) }));
}

describe("public pricing initial render", () => {
  beforeEach(() => {
    auth.loading = true;
    auth.user = null;
    auth.isPro = false;
    vi.clearAllMocks();
  });

  it("renders public pricing while auth is unresolved, with only auth-dependent actions disabled", () => {
    const html = renderToStaticMarkup(createElement(PricingPage));

    expect(html.match(/<h1\b[^>]*>(.*?)<\/h1>/)?.[1]).toBe(en.pricing.title);
    expect(html).toContain(en.pricing.page.compareTitle);
    const questionHtml = renderToStaticMarkup(createElement("span", null, en.pricing.page.faq.q1)).slice(6, -7);
    expect(html).toContain(questionHtml);
    expect(html).not.toContain('href="/signup"');
    expect(buttonsNamed(html, en.pricing.signupToUpgrade)).toEqual([{ disabled: true }]);
    expect(buttonsNamed(html, en.pricing.upgrade)).toEqual([{ disabled: true }]);
    expect(buttonsNamed(html, en.pricing.getStarted)).toEqual([
      { disabled: true },
      { disabled: false },
    ]);
    expect(html).toContain('href="/#tools"');
    expect(checkout).not.toHaveBeenCalled();
  });

  it("enables guest signup actions once auth has resolved", () => {
    auth.loading = false;
    const html = renderToStaticMarkup(createElement(PricingPage));

    expect(html).toContain('href="/signup"');
    expect(buttonsNamed(html, en.pricing.signupToUpgrade)).toEqual([{ disabled: false }]);
    expect(buttonsNamed(html, en.pricing.upgrade)).toEqual([{ disabled: false }]);
    expect(buttonsNamed(html, en.pricing.getStarted).every((button) => !button.disabled)).toBe(true);
    expect(checkout).not.toHaveBeenCalled();
  });

  it("keeps the redirect placeholder for a resolved signed-in session", () => {
    auth.loading = false;
    auth.user = { id: "signed-in-user", email: "user@example.test" };
    const html = renderToStaticMarkup(createElement(PricingPage));

    expect(html).toContain("animate-spin");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<button");
    expect(checkout).not.toHaveBeenCalled();
  });
});
