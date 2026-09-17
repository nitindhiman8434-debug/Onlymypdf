import { describe, expect, it } from "vitest";
import { signedUrlLifetimeSeconds } from "./upload.service";

describe("signedUrlLifetimeSeconds", () => {
  const now = Date.parse("2026-09-17T00:00:00.000Z");

  it("caps a Pro file URL at two hours", () => {
    expect(signedUrlLifetimeSeconds("2026-09-18T00:00:00.000Z", now)).toBe(7200);
  });

  it("never signs beyond the database retention deadline", () => {
    expect(signedUrlLifetimeSeconds("2026-09-17T00:15:00.000Z", now)).toBe(900);
  });

  it("uses a one-second URL for already expired records", () => {
    expect(signedUrlLifetimeSeconds("2026-09-16T23:59:00.000Z", now)).toBe(1);
  });
});
