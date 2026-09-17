import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptJobPayloadSecret, encryptJobPayloadSecret } from "./job-payload-secret";

const originalSecret = process.env.JOB_PAYLOAD_SECRET;

describe("job payload secret encryption", () => {
  beforeEach(() => {
    process.env.JOB_PAYLOAD_SECRET = "test-job-payload-secret-with-enough-entropy";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JOB_PAYLOAD_SECRET;
    else process.env.JOB_PAYLOAD_SECRET = originalSecret;
  });

  it("encrypts and decrypts without exposing plaintext", () => {
    const encrypted = encryptJobPayloadSecret("correct horse battery staple");
    expect(encrypted).not.toContain("correct horse");
    expect(decryptJobPayloadSecret(encrypted)).toBe("correct horse battery staple");
  });

  it("rejects an altered authentication tag", () => {
    const encrypted = encryptJobPayloadSecret("secret");
    const parts = encrypted.split(".");
    parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
    expect(() => decryptJobPayloadSecret(parts.join("."))).toThrow(
      "Encrypted job payload is invalid"
    );
  });
});
