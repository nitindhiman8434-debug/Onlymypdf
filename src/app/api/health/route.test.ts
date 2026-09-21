import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/ops/health-auth", () => ({
  isHealthDetailAuthorized: vi.fn(() => false),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns public liveness payload", async () => {
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string; timestamp?: string };
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  }, 15_000);
});
