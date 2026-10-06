import Link from "next/link";
import { OCR_BENCHMARKS } from "@/config/ocr-benchmark";
import { APP_NAME, APP_URL } from "@/config/constants";

/** The same compact evidence drives visible results and search metadata. */
export function ocrBenchmarkDatasets() {
  return OCR_BENCHMARKS.map((result) => ({
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${APP_URL}/benchmarks#ocr-${result.id}`,
    name: `${result.title} — controlled local evidence`,
    description: `${result.summary} ${result.limits.join(" ")}`,
    url: `${APP_URL}/benchmarks#ocr-${result.id}`,
    dateModified: result.measuredOnIso,
    creator: { "@type": "Organization", name: APP_NAME, url: APP_URL },
    measurementTechnique: `Local HTTP conversion and artifact inspection. ${result.checks.join(" ")}`,
    variableMeasured: [
      { "@type": "PropertyValue", name: "Passed fixture checks", value: result.passed },
      { "@type": "PropertyValue", name: "Fixture cases in this test set", value: result.total },
    ],
  }));
}

export function OcrBenchmarkResults() {
  return (
    <section id="ocr-results" className="mt-12 scroll-mt-24" aria-labelledby="ocr-results-heading">
      <p className="text-xs font-bold uppercase tracking-wider text-pd-brand">Scanned document evidence</p>
      <h2 id="ocr-results-heading" className="mt-1 text-2xl font-bold text-pd-foreground">
        English OCR: text, page appearance and editable tables
      </h2>
      <p className="mt-3 max-w-4xl leading-relaxed text-pd-muted">
        These dated local tests use synthetic documents and actual OCR recognition, alongside
        selectable-text or borderless controls where stated. Each result covers its own test
        set; the counts are not an accuracy percentage or a combined score.
      </p>
      <p className="mt-3 max-w-4xl text-sm leading-relaxed text-pd-muted">
        Downloaded files were inspected and rendered independently. Dates below use UTC.
        Visual reviews were performed by an agent, not by customers. The historical
        page-retention stub above is separate from these OCR checks.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {OCR_BENCHMARKS.map((result) => (
          <article
            key={result.id}
            id={`ocr-${result.id}`}
            aria-labelledby={`ocr-${result.id}-heading`}
            className="flex min-w-0 scroll-mt-24 flex-col rounded-2xl border border-pd-border bg-pd-surface p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
              <span className={`rounded-full px-3 py-1 ${result.status === "passed"
                ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>
                {result.passed}/{result.total} fixture checks passed
              </span>
              <time dateTime={result.measuredOnIso} className="text-pd-muted">{result.measuredOn}</time>
            </div>
            <h3 id={`ocr-${result.id}-heading`} className="mt-4 text-lg font-bold text-pd-foreground">
              {result.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-pd-muted">{result.summary}</p>
            {result.status !== "passed" ? (
              <p className="mt-3 text-sm font-semibold text-amber-950">
                This report needs review: {result.counts.failed} failed, {result.counts.error} errors,
                {" "}{result.counts["not-tested"]} not verified.
              </p>
            ) : null}
            <h4 className="mt-5 text-sm font-bold text-pd-foreground">What was checked</h4>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-pd-muted">
              {result.checks.map((check) => <li key={check}>{check}</li>)}
            </ul>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
              <h4 className="font-bold">Limits of this result</h4>
              <ul className="mt-2 space-y-2">
                {result.limits.map((limit) => <li key={limit}>{limit}</li>)}
              </ul>
            </div>
            <div className="mt-auto pt-4">
              <Link href={result.toolHref} className="inline-flex min-h-11 items-center font-semibold text-pd-brand hover:underline">
                {result.toolLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-5 max-w-4xl text-sm leading-relaxed text-pd-muted">
        Passing these controlled examples does not establish accuracy on arbitrary scans,
        exact source typography, real-customer acceptance or production speed and capacity.
        Re-running a test set is regression evidence, not a new set of unique documents.
      </p>
    </section>
  );
}
