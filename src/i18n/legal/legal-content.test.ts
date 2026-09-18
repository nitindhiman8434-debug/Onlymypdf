import { describe, expect, it } from "vitest";
import { FILE_LIMITS } from "@/config/constants";
import { LEGAL_CONTACT, LEGAL_POLICY_DATE, PUBLIC_RETENTION } from "@/config/legal";
import { getLegalDocument, type LegalDocument } from "./index";

function documentText(document: LegalDocument): string {
  return document.sections
    .flatMap((section) => [
      section.title,
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []),
    ])
    .join("\n");
}

describe("public legal content", () => {
  it("uses one effective date across the English and Hindi policies", () => {
    for (const id of ["terms", "privacy", "cookies", "refund", "trust", "sla"] as const) {
      expect(getLegalDocument(id, "en").lastUpdated).toBe(LEGAL_POLICY_DATE.en);
      expect(getLegalDocument(id, "hi").lastUpdated).toBe(LEGAL_POLICY_DATE.hi);
    }
  });

  it("keeps published file retention aligned with enforced plan limits", () => {
    const privacy = documentText(getLegalDocument("privacy", "en"));
    const terms = documentText(getLegalDocument("terms", "en"));

    expect(privacy).toContain(`Free plan files expire within ${FILE_LIMITS.fileRetentionHours} hours`);
    expect(privacy).toContain(`Pro plan files expire within ${PUBLIC_RETENTION.proFileHours} hours`);
    expect(terms).toContain(`Free files expire within ${FILE_LIMITS.fileRetentionHours} hours`);
    expect(terms).toContain(`Pro files expire within ${PUBLIC_RETENTION.proFileHours} hours`);
  });

  it("names core infrastructure and labels feature-specific processors", () => {
    const privacy = documentText(getLegalDocument("privacy", "en"));

    expect(privacy).toContain("Supabase");
    expect(privacy).toContain("Cloudflare R2");
    expect(privacy).toContain("Upstash");
    expect(privacy).toContain("Railway");
    expect(privacy).toContain("These processors receive data only when the related feature is enabled and used");
    expect(privacy).toContain(LEGAL_CONTACT.privacyEmail);
    expect(privacy).not.toContain("privacy@onlymypdf.com");
  });

  it("discloses actual essential storage and inactive optional tags", () => {
    const cookies = documentText(getLegalDocument("cookies", "en"));

    expect(cookies).toContain("pd_guest_session");
    expect(cookies).toContain("pd_locale");
    expect(cookies).toContain("pd_consent");
    expect(cookies).toContain("pd_step_up");
    expect(cookies).toContain("does not load an analytics tag");
    expect(cookies).toContain("does not load advertising or marketing tags");
  });

  it("states conversion, AI, signature, and certification limits", () => {
    const terms = documentText(getLegalDocument("terms", "en"));
    const trust = documentText(getLegalDocument("trust", "en"));

    expect(terms).toContain("Review every output");
    expect(terms).toContain("not a certificate-based digital signature");
    expect(trust).toContain("does not promise perfect conversion");
    expect(trust).toContain("does not currently claim SOC 2, ISO 27001, HIPAA, PCI DSS");
  });

  it("does not promise a contractual public SLA", () => {
    const sla = documentText(getLegalDocument("sla", "en"));

    expect(sla).toContain("not a contractual service-level agreement");
    expect(sla).toContain("current snapshot, not proof of historical uptime");
  });
});
