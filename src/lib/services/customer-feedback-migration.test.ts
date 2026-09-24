import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("verified customer feedback migration", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "024_verified_customer_feedback.sql"),
    "utf8"
  );

  it("requires an owned completed job and row-level security", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("job.user_id = auth.uid()");
    expect(sql).toContain("job.status = 'completed'");
    expect(sql).toContain("auth.uid() = user_id");
  });

  it("prevents browser clients from spoofing moderation state", () => {
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain(
      "REVOKE INSERT, UPDATE ON public.customer_feedback FROM anon, authenticated"
    );
    expect(sql).toContain("publish_consent BOOLEAN NOT NULL DEFAULT FALSE");
  });
});
