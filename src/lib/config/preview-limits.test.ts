import { afterEach, describe, expect, it, vi } from "vitest";

describe("preview-limits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults session TTL to 15 minutes", async () => {
    vi.stubEnv("PREVIEW_SESSION_TTL_MINUTES", "");
    const { getPreviewSessionTtlMs } = await import("./preview-limits");
    expect(getPreviewSessionTtlMs()).toBe(15 * 60 * 1000);
  });

  it("reads custom session TTL from env", async () => {
    vi.stubEnv("PREVIEW_SESSION_TTL_MINUTES", "20");
    const { getPreviewSessionTtlMs } = await import("./preview-limits");
    expect(getPreviewSessionTtlMs()).toBe(20 * 60 * 1000);
  });

  it("defaults thumb max width to 960", async () => {
    vi.stubEnv("PREVIEW_THUMB_MAX_WIDTH", "");
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_THUMB_MAX_WIDTH", "");
    const { getPreviewThumbMaxWidth } = await import("./preview-limits");
    expect(getPreviewThumbMaxWidth()).toBe(960);
  });

  it("caps thumb width at 1200", async () => {
    vi.stubEnv("PREVIEW_THUMB_MAX_WIDTH", "2000");
    const { getPreviewThumbMaxWidth } = await import("./preview-limits");
    expect(getPreviewThumbMaxWidth()).toBe(1200);
  });
});
