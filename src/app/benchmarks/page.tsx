import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  Gauge,
  Presentation,
  Table2,
  TriangleAlert,
} from "lucide-react";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";
import { CONVERSION_BENCHMARK } from "@/config/conversion-benchmark";
import { APP_NAME, APP_URL } from "@/config/constants";
import { breadcrumbJsonLd, faqPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { DocumentCorpusResults } from "./document-corpus-results";

const TITLE = "PDF Conversion Benchmark: Word, Excel and PowerPoint";
const DESCRIPTION =
  "See OnlyMyPDF's reproducible local PDF-to-Office benchmark, artifact checks, page-completeness results, test method, and honest limitations.";

export const metadata: Metadata = buildPageMetadata({
  title: `${TITLE} | ${APP_NAME}`,
  description: DESCRIPTION,
  path: "/benchmarks",
});

const ICONS = {
  "pdf-to-word": FileText,
  "pdf-to-excel": Table2,
  "pdf-to-ppt": Presentation,
} as const;

const FAQS = [
  {
    question: "Does this benchmark prove 100% PDF conversion accuracy?",
    answer:
      "No. The baseline checks one controlled two-page fixture. The separate language and document corpus reports both passing and failing checks on more varied files. Neither establishes universal conversion accuracy.",
  },
  {
    question: "What does openable output mean?",
    answer:
      "The downloaded Office package passed ZIP integrity checks and contained the expected format parts. The benchmark also searched the output for known editable fixture text.",
  },
  {
    question: "Are these production speed measurements?",
    answer:
      "No. They are individual localhost samples, not latency percentiles or public-load results. Production speed depends on document complexity, queueing, compute resources, and network conditions.",
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function BenchmarksPage() {
  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: TITLE,
    description: DESCRIPTION,
    url: `${APP_URL}/benchmarks`,
    dateModified: CONVERSION_BENCHMARK.measuredOnIso,
    creator: { "@type": "Organization", name: APP_NAME, url: APP_URL },
    measurementTechnique:
      "Local HTTP conversion followed by Office ZIP integrity, expected editable-text, and page-completeness checks",
    variableMeasured: [
      "Output openability",
      "Editable fixture text",
      "Output file size",
      "Single-sample elapsed time",
      "Page completeness",
    ],
  };

  return (
    <>
      <JsonLd
        data={[
          datasetJsonLd,
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Benchmarks", path: "/benchmarks" },
          ]),
          faqPageJsonLd(FAQS)!,
        ]}
      />
      <MarketingPageShell
        title={TITLE}
        description="Reproducible evidence from a controlled release check, with the limits stated beside the results."
        eyebrow="Conversion evidence"
        heroStyle="centered"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Benchmarks" }]}
      >
        <section id="aeo-summary" aria-labelledby="benchmark-summary-heading">
          <div className="rounded-2xl border border-pd-border bg-pd-surface p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                Two-page baseline passed
              </span>
              <span className="rounded-full bg-pd-brand-muted px-3 py-1 text-pd-brand">
                Measured {CONVERSION_BENCHMARK.measuredOn}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                Local evidence
              </span>
            </div>
            <h2 id="benchmark-summary-heading" className="mt-5 text-2xl font-bold text-pd-foreground">
              What this benchmark establishes
            </h2>
            <p id="aeo-short-answer" className="mt-3 max-w-4xl leading-relaxed text-pd-muted">
              A controlled two-page PDF produced openable DOCX, XLSX, and PPTX downloads. Each
              output contained the expected editable fixture text, and the Word page-completeness
              regression retained every tested page. This result is reproducible local evidence;
              it is not a promise that every PDF converts perfectly.
            </p>
            <a href="#document-corpus" className="mt-4 inline-flex min-h-11 items-center font-semibold text-pd-brand hover:underline">
              See the expanded language and document results
            </a>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="results-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-pd-brand">Artifact results</p>
              <h2 id="results-heading" className="mt-1 text-2xl font-bold text-pd-foreground">
                Three Office outputs inspected
              </h2>
            </div>
            <p className="hidden text-sm text-pd-muted sm:block">
              Input: {formatBytes(CONVERSION_BENCHMARK.inputBytes)}
            </p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {CONVERSION_BENCHMARK.results.map((result) => {
              const Icon = ICONS[result.slug];
              return (
                <article key={result.slug} className="rounded-2xl border border-pd-border bg-pd-surface p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pd-brand-muted text-pd-brand">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-pd-foreground">{result.tool}</h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4 border-b border-pd-border pb-3">
                      <dt className="text-pd-muted">Output size</dt>
                      <dd className="font-semibold text-pd-foreground">{formatBytes(result.outputBytes)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-pd-border pb-3">
                      <dt className="text-pd-muted">Package</dt>
                      <dd className="font-semibold text-emerald-800">Openable</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-pd-border pb-3">
                      <dt className="text-pd-muted">Known text</dt>
                      <dd className="font-semibold text-emerald-800">Editable</dd>
                    </div>
                    {result.elapsedMs !== null ? (
                      <div className="flex justify-between gap-4">
                        <dt className="text-pd-muted">Single sample</dt>
                        <dd className="font-semibold text-pd-foreground">
                          {(result.elapsedMs / 1000).toFixed(2)} s
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <Link
                    href={`/${result.slug}`}
                    className="mt-5 inline-flex min-h-11 items-center font-semibold text-pd-brand hover:underline"
                  >
                    Open {result.tool} tool
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2" aria-label="Method and scope">
          <div className="rounded-2xl border border-pd-border bg-pd-surface p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Gauge className="h-6 w-6 text-pd-brand" aria-hidden="true" />
              <h2 className="text-xl font-bold text-pd-foreground">How the check works</h2>
            </div>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed text-pd-muted">
              <li><strong className="text-pd-foreground">1. Convert:</strong> send the tracked fixture through the real localhost HTTP route.</li>
              <li><strong className="text-pd-foreground">2. Inspect:</strong> verify MIME type, Office ZIP integrity, package parts, and known editable text.</li>
              <li><strong className="text-pd-foreground">3. Regress:</strong> exercise single, in-process chunk, subprocess chunk, and searchable OCR page paths.</li>
              <li><strong className="text-pd-foreground">4. Report:</strong> publish passes and boundaries together so the numbers are not overstated.</li>
            </ol>
            <p className="mt-5 rounded-xl bg-pd-background p-4 text-sm text-pd-muted">
              Environment: {CONVERSION_BENCHMARK.environment}. Fixture: {CONVERSION_BENCHMARK.fixture}.
            </p>
          </div>

          <div className="rounded-2xl border border-pd-border bg-pd-surface p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-700" aria-hidden="true" />
              <h2 className="text-xl font-bold text-pd-foreground">Word page completeness</h2>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              {Object.entries(CONVERSION_BENCHMARK.pageCompleteness).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-pd-background p-4">
                  <dt className="capitalize text-pd-muted">{key.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className="mt-1 font-bold text-emerald-800">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-sm leading-relaxed text-pd-muted">
              The searchable OCR branch used a known searchable input stub. It verifies routing and
              page retention, but does not measure Tesseract recognition accuracy.
            </p>
          </div>
        </section>

        <DocumentCorpusResults />

        <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8" aria-labelledby="limits-heading">
          <div className="flex items-center gap-3">
            <TriangleAlert className="h-6 w-6 text-amber-800" aria-hidden="true" />
            <h2 id="limits-heading" className="text-xl font-bold text-amber-950">What this report does not prove</h2>
          </div>
          <ul className="mt-5 grid gap-3 text-sm leading-relaxed text-amber-950 sm:grid-cols-2">
            {CONVERSION_BENCHMARK.boundaries.map((boundary) => (
              <li key={boundary} className="rounded-xl border border-amber-200 bg-white/70 p-4">{boundary}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-bold text-pd-foreground">Benchmark questions</h2>
          <div className="mt-5 space-y-4">
            {FAQS.map((faq) => (
              <article key={faq.question} className="rounded-2xl border border-pd-border bg-pd-surface p-6">
                <h3 className="font-bold text-pd-foreground">{faq.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pd-muted">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </MarketingPageShell>
    </>
  );
}
