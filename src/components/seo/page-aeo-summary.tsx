import { SITE_AEO, PRICING_AEO } from "@/lib/seo/marketing-aeo";

type PageAeoSummaryProps = {
  variant: "home" | "pricing" | "faq" | "about" | "convert" | "all-tools";
};

const VARIANT_COPY: Record<
  PageAeoSummaryProps["variant"],
  { shortAnswer: string; extra?: string; keyFacts?: readonly string[] }
> = {
  home: {
    shortAnswer: SITE_AEO.shortAnswer,
    extra: SITE_AEO.definition,
    keyFacts: SITE_AEO.keyFacts,
  },
  pricing: {
    shortAnswer: PRICING_AEO.shortAnswer,
    keyFacts: PRICING_AEO.keyFacts,
  },
  faq: {
    shortAnswer:
      "OnlyMyPDF FAQ covers pricing, security, file limits, supported formats, and how each PDF tool works. Public service requires HTTPS/TLS. Stored account files have a 2-hour Free or 24-hour Pro expiry; temporary links may expire sooner, and cleanup may be delayed by retries. Free users get 5 core-tool uses per day.",
    extra:
      "Browse categories: General, Tools, Privacy & Security, Account & Billing, and Technical support.",
  },
  about: {
    shortAnswer:
      "OnlyMyPDF is an online PDF toolkit for merging, converting, compressing, editing, signing, and securing documents without desktop software. Free and Pro limits are published on the Pricing page.",
  },
  convert: {
    shortAnswer:
      "OnlyMyPDF Convert hub links PDF to Word, Excel, PowerPoint and reverse converters (Word/Excel/PPT/JPG/HTML/TXT to PDF). Conversions run online; public service requires HTTPS/TLS, and tool-specific limits apply.",
  },
  "all-tools": {
    shortAnswer:
      "OnlyMyPDF offers 20+ online PDF tools to organize, convert, edit, sign, protect, scan, and summarize documents. Core tools have a Free daily allowance. Signing requires Pro; signed-in Free users get 1 AI summary per day. Tool-specific limits apply.",
  },
};

export function PageAeoSummary({ variant }: PageAeoSummaryProps) {
  const copy = VARIANT_COPY[variant];

  return (
    <section
      id="aeo-summary"
      aria-label="Page summary for search and AI assistants"
      className="border-t border-pd-border bg-pd-background"
    >
      <div className="pd-container max-w-3xl py-8 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-wider text-pd-muted">
          About OnlyMyPDF
        </p>
        <p
          id="aeo-short-answer"
          className="mt-2 text-sm leading-relaxed text-pd-muted"
        >
          {copy.shortAnswer}
        </p>
        {copy.extra ? (
          <p className="mt-2 text-sm leading-relaxed text-pd-muted">{copy.extra}</p>
        ) : null}
        {copy.keyFacts && copy.keyFacts.length > 0 ? (
          <>
            <h2 className="mt-4 text-sm font-semibold text-pd-foreground">Key facts</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-pd-muted">
              {copy.keyFacts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
