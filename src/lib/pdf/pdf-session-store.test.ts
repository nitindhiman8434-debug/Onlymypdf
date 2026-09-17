import { describe, expect, it, vi } from "vitest";

describe("pdf-session-store (local)", () => {
  it("creates a session and reads the buffer back", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const {
      buildOwnerHash,
      createPdfSession,
      getPdfSessionBuffer,
      cacheThumb,
      getCachedThumb,
    } = await import("@/lib/pdf/pdf-session-store");

    const ownerHash = buildOwnerHash("user-1", null);
    const pdf = Buffer.from("%PDF-1.4 test");
    const sessionId = await createPdfSession(pdf, ownerHash);

    const read = await getPdfSessionBuffer(sessionId, ownerHash);
    expect(read?.equals(pdf)).toBe(true);

    await cacheThumb(sessionId, "p1-120", "data:image/png;base64,abc");
    const thumb = await getCachedThumb(sessionId, "p1-120", ownerHash);
    expect(thumb).toBe("data:image/png;base64,abc");
  });

  it("creates a localOnly session without distributed persistence", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");

    const { createPdfSession, getPdfSessionBuffer } = await import(
      "@/lib/pdf/pdf-session-store"
    );

    const sessionId = await createPdfSession(Buffer.from("%PDF-local"), "owner-local", {
      localOnly: true,
    });
    const read = await getPdfSessionBuffer(sessionId, "owner-local");
    expect(read?.toString()).toBe("%PDF-local");
  });

  it("rejects mismatched owner hash", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { createPdfSession, getPdfSessionBuffer } = await import(
      "@/lib/pdf/pdf-session-store"
    );

    const sessionId = await createPdfSession(Buffer.from("%PDF"), "owner-a");
    const read = await getPdfSessionBuffer(sessionId, "owner-b");
    expect(read).toBeNull();
  });

  it("rejects legacy sessions with empty owner hash", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { createPdfSession, getPdfSessionBuffer } = await import(
      "@/lib/pdf/pdf-session-store"
    );

    const sessionId = await createPdfSession(Buffer.from("%PDF"), "");
    const read = await getPdfSessionBuffer(sessionId);
    expect(read).toBeNull();
  });
});
