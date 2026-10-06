import Link from "next/link";
import { APP_NAME, APP_URL } from "@/config/constants";
import { SCANNER_BENCHMARK } from "@/config/scanner-benchmark";

type ScannerBenchmark = typeof SCANNER_BENCHMARK;

/** Publish only the compact, verified evidence used by the visible section. */
export function scannerBenchmarkDataset(result: ScannerBenchmark = SCANNER_BENCHMARK) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${APP_URL}/benchmarks#scanner-results`,
    name: "PDF Scanner — controlled local image-to-PDF evidence",
    description: `${result.positivePassed}/${result.positiveTotal} image-to-PDF conversion cases passed; ${result.negativePassed}/${result.negativeTotal} invalid-input rejection checks passed. ${result.outputPages} PDF output pages; ${result.renderedPages} independently rendered pages. ${result.status === "passed" ? "The recorded checks passed." : "This report needs review."} ${result.limits.join(" ")}`,
    url: `${APP_URL}/benchmarks#scanner-results`,
    dateModified: result.measuredOnIso,
    creator: { "@type": "Organization", name: APP_NAME, url: APP_URL },
    measurementTechnique: result.method,
    variableMeasured: [
      { "@type": "PropertyValue", name: "Passed image-to-PDF conversion cases", value: result.positivePassed },
      { "@type": "PropertyValue", name: "Image-to-PDF conversion cases tested", value: result.positiveTotal },
      { "@type": "PropertyValue", name: "Passed invalid-input rejection checks", value: result.negativePassed },
      { "@type": "PropertyValue", name: "Invalid-input rejection checks tested", value: result.negativeTotal },
      { "@type": "PropertyValue", name: "PDF output pages", value: result.outputPages },
      { "@type": "PropertyValue", name: "Independently rendered PDF pages", value: result.renderedPages },
    ],
  };
}

function ScannerCases({
  cases,
}: {
  cases: ScannerBenchmark["cases"];
}) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {cases.map((result) => (
        <article
          key={result.id}
          id={`scanner-${result.id}`}
          aria-labelledby={`scanner-${result.id}-heading`}
          className="min-w-0 scroll-mt-24 rounded-2xl border border-pd-border bg-pd-surface p-5 sm:p-6"
        >
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${result.status === "passed"
            ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>
            {result.status === "passed"
              ? result.kind === "negative" ? "Rejected as expected" : "Passed"
              : result.status === "failed" ? "Failed check" : "Not verified"}
          </span>
          <h4 id={`scanner-${result.id}-heading`} className="mt-3 font-bold text-pd-foreground">
            {result.title}
          </h4>
          {result.kind === "positive" ? (
            <p className="mt-2 text-sm text-pd-muted">
              {result.status === "passed"
                ? `${result.pageCount} PDF output ${result.pageCount === 1 ? "page" : "pages"}`
                : "Output pages not verified"}
            </p>
          ) : null}
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-pd-muted">
            {result.checks.map((check) => <li key={check}>{check}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function ScannerBenchmarkResults({
  result = SCANNER_BENCHMARK,
}: {
  result?: ScannerBenchmark;
}) {
  return (
    <section id="scanner-results" className="mt-12 scroll-mt-24" aria-labelledby="scanner-results-heading">
      <p className="text-xs font-bold uppercase tracking-wider text-pd-brand">Image-to-PDF evidence</p>
      <h2 id="scanner-results-heading" className="mt-1 text-2xl font-bold text-pd-foreground">
        PDF Scanner: image pages, filters and input limits
      </h2>
      <p className="mt-3 max-w-4xl leading-relaxed text-pd-muted">
        These controlled local tests check image-to-PDF output and rejected inputs separately.
        The Scanner creates image-based PDF pages; these results do not establish searchable
        text or editable Word output.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className={`rounded-full px-3 py-1 font-semibold ${result.status === "passed"
          ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>
          {result.status === "passed" ? "Recorded checks passed" : "This report needs review"}
        </span>
        <p className="text-pd-muted">
          Measured <time dateTime={result.measuredOnIso}>{result.measuredOn}</time>.
        </p>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-pd-border bg-pd-surface p-4">
          <dt className="text-sm text-pd-muted">Image-to-PDF conversion cases passed</dt>
          <dd className="mt-1 text-xl font-bold text-pd-foreground">{result.positivePassed}/{result.positiveTotal}</dd>
        </div>
        <div className="rounded-xl border border-pd-border bg-pd-surface p-4">
          <dt className="text-sm text-pd-muted">Invalid-input rejection checks passed</dt>
          <dd className="mt-1 text-xl font-bold text-pd-foreground">{result.negativePassed}/{result.negativeTotal}</dd>
        </div>
        <div className="rounded-xl border border-pd-border bg-pd-surface p-4">
          <dt className="text-sm text-pd-muted">PDF output pages</dt>
          <dd className="mt-1 text-xl font-bold text-pd-foreground">{result.outputPages}</dd>
        </div>
        <div className="rounded-xl border border-pd-border bg-pd-surface p-4">
          <dt className="text-sm text-pd-muted">Independently rendered PDF pages</dt>
          <dd className="mt-1 text-xl font-bold text-pd-foreground">{result.renderedPages}</dd>
        </div>
      </dl>

      <h3 className="mt-7 text-lg font-bold text-pd-foreground">Image-to-PDF conversion cases</h3>
      <ScannerCases cases={result.cases.filter((item) => item.kind === "positive")} />

      <h3 className="mt-7 text-lg font-bold text-pd-foreground">Invalid-input rejection checks</h3>
      <p className="mt-2 text-sm leading-relaxed text-pd-muted">
        These checks verify that invalid requests are rejected. They are not additional successful conversions.
      </p>
      <ScannerCases cases={result.cases.filter((item) => item.kind === "negative")} />

      <div className="mt-6 rounded-2xl border border-pd-border bg-pd-surface p-5 sm:p-6">
        <h3 className="font-bold text-pd-foreground">How the Scanner results were checked</h3>
        <p className="mt-2 text-sm leading-relaxed text-pd-muted">{result.method}</p>
      </div>
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:p-6">
        <h3 className="font-bold">Limits of the Scanner result</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {result.limits.map((limit) => <li key={limit}>{limit}</li>)}
        </ul>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/pdf-scanner" className="inline-flex min-h-11 items-center font-semibold text-pd-brand hover:underline">
          Try PDF Scanner
        </Link>
        <Link href="/guides/scanned-pdf-to-word" className="inline-flex min-h-11 items-center font-semibold text-pd-brand hover:underline">
          Read the scanned PDF to Word guide
        </Link>
      </div>
    </section>
  );
}
