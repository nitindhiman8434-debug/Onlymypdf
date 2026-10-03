import report from "../../../quality/phase3-document-corpus/latest-report.json";
import { CORPUS_TOOLS, summarizeDocumentCorpus, type CorpusStatus } from "@/config/document-corpus";

const STATUS: Record<CorpusStatus, { label: string; className: string }> = {
  passed: { label: "Passed", className: "bg-emerald-100 text-emerald-900" },
  failed: { label: "Needs improvement", className: "bg-amber-100 text-amber-950" },
  error: { label: "Test error", className: "bg-rose-100 text-rose-900" },
  "not-tested": { label: "Not verified", className: "bg-slate-100 text-slate-800" },
};

export function DocumentCorpusResults() {
  const { rows, counts, total } = summarizeDocumentCorpus(report);
  const measuredOn = new Date(report.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

  return (
    <section id="document-corpus" className="mt-12" aria-labelledby="corpus-heading">
      <p className="text-xs font-bold uppercase tracking-wider text-pd-brand">Language and document checks</p>
      <h2 id="corpus-heading" className="mt-1 text-2xl font-bold text-pd-foreground">
        Beyond the two-page baseline
      </h2>
      <p className="mt-3 max-w-4xl leading-relaxed text-pd-muted">
        {rows.length} synthetic PDFs test Hindi, bilingual text, French accents, German numbers,
        mixed page sizes, and dense columns. Each output is checked for its Office package
        structure and occurrences of selected editable text and numeric values, after Unicode
        NFC and whitespace normalization. Specified Excel cells also check numeric meaning
        and leading-zero identifiers.
      </p>
      <p className="mt-3 text-sm text-pd-muted">
        Local measurement: {measuredOn}. {counts.passed}/{total} checks passed;{" "}
        {counts.failed} need improvement, {counts.error} test errors, {counts["not-tested"]} not verified.
        This is a test pass count, not an accuracy percentage.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <article key={row.caseId} className="rounded-2xl border border-pd-border bg-pd-surface p-5 sm:p-6">
            <h3 className="font-bold text-pd-foreground">{row.label}</h3>
            <dl className="mt-4 space-y-3 text-sm">
              {row.results.map((result, index) => (
                <div key={result.tool} className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-pd-muted">{CORPUS_TOOLS[index].label}</dt>
                  <dd className={`rounded-full px-3 py-1 font-semibold ${STATUS[result.status].className}`}>
                    {STATUS[result.status].label}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
        <p>
          A file can open successfully and still fail these checks. “Needs improvement” means
          at least one strict output expectation was unmet. This can include missing or duplicated
          text, different number representations, or text preserved only in slide notes. Excel
          recovery copies are measured separately from primary cells; a backup copy cannot
          satisfy a specified primary-cell check.
        </p>
        <p className="mt-3">
          These are selectable-text PDFs, not OCR tests. Selected text checks do not establish
          correct table structure, reading order, layout, or suitability for every language.
          Hindi fixtures use simple text; complex conjuncts remain untested.
          Excel source-text recovery can satisfy text coverage without proving correct table placement.
          No public load, large-file speed, or real customer results are measured here.
        </p>
      </div>
    </section>
  );
}
