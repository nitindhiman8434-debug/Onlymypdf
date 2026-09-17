import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getExternalStatusPageUrl,
  isExternalStatusPageConfigured,
} from "./status-page";

describe("status-page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_STATUS_PAGE_URL", undefined);
    expect(getExternalStatusPageUrl()).toBeNull();
    expect(isExternalStatusPageConfigured()).toBe(false);
  });

  it("normalizes trailing slash on https URL", () => {
    vi.stubEnv("NEXT_PUBLIC_STATUS_PAGE_URL", "https://status.example.com/");
    expect(getExternalStatusPageUrl()).toBe("https://status.example.com");
  });

  it("rejects invalid URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_STATUS_PAGE_URL", "not-a-url");
    expect(getExternalStatusPageUrl()).toBeNull();
  });

  it("rejects http URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_STATUS_PAGE_URL", "http://localhost:8080/status");
    expect(getExternalStatusPageUrl()).toBeNull();
  });
});
