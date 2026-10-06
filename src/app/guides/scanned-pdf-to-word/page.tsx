import type { Metadata } from "next";
import Link from "next/link";
import { FilePenLine, ScanText } from "lucide-react";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";
import { OCR_BENCHMARKS } from "@/config/ocr-benchmark";
import { SCANNED_PDF_GUIDE as GUIDE, scannedPdfGuideArticle } from "@/config/scanned-pdf-guide";
import { breadcrumbJsonLd, faqPageJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: GUIDE.title, description: GUIDE.description, path: GUIDE.path,
});

const tableEvidence = OCR_BENCHMARKS.filter((result) =>
  result.id === "single-ruled-table" || result.id === "two-ruled-tables");

const SECTIONS = [
  ["choose-output", "Choose your output"],
  ["conversion-steps", "Follow the steps"],
  ["table-support", "Understand table support"],
  ["review-output", "Review your result"],
  ["common-problems", "Troubleshoot"],
] as const;

export default function ScannedPdfGuidePage() {
  return (
    <>
      <JsonLd data={[
        scannedPdfGuideArticle(),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: GUIDE.title, path: GUIDE.path }]),
        faqPageJsonLd([...GUIDE.faqs])!,
      ]} />
      <MarketingPageShell
        title={GUIDE.title}
        description="A practical guide to choosing your output, converting an English scan and checking the result."
        eyebrow="Scanned document guide"
        heroStyle="centered"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Scanned PDF guide" }]}
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-pd-muted">
            By OnlyMyPDF · Published <time dateTime={GUIDE.publishedOnIso}>{GUIDE.publishedOn}</time>
          </p>
          <section id="aeo-summary" aria-labelledby="guide-answer-heading" className="mt-5 rounded-2xl border border-pd-border bg-pd-surface p-6 sm:p-8">
            <h2 id="guide-answer-heading" className="text-xl font-bold text-pd-foreground">Which tool do you need?</h2>
            <p id="aeo-short-answer" className="mt-3 leading-relaxed text-pd-muted">{GUIDE.shortAnswer}</p>
            <p className="mt-3 text-sm leading-relaxed text-pd-muted">
              OCR means optical character recognition: reading text from a page image. A PDF
              can contain both an image and recognized text, so check what you can already
              select and copy before choosing a tool.
            </p>
          </section>

          <nav aria-label="In this guide" className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-pd-brand">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center hover:underline">{label}</a>
            ))}
          </nav>

          <section id="choose-output" aria-labelledby="choose-heading" className="mt-10 scroll-mt-24">
            <h2 id="choose-heading" className="text-2xl font-bold text-pd-foreground">Start with the file you want to keep</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <article className="flex min-w-0 flex-col rounded-2xl border border-pd-border bg-pd-surface p-6">
                <FilePenLine className="h-7 w-7 text-pd-brand" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold text-pd-foreground">I need to edit the document</h3>
                <p className="mt-3 text-sm leading-relaxed text-pd-muted">
                  Choose PDF to Word for a DOCX file. Edit recognized words and supported table
                  cells in a document editor. Review the layout: line breaks, fonts and page
                  count can change.
                </p>
                <Link href="/pdf-to-word" className="mt-auto inline-flex min-h-11 items-center pt-4 font-semibold text-pd-brand hover:underline">Open PDF to Word</Link>
              </article>
              <article className="flex min-w-0 flex-col rounded-2xl border border-pd-border bg-pd-surface p-6">
                <ScanText className="h-7 w-7 text-pd-brand" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold text-pd-foreground">I need to search and copy text</h3>
                <p className="mt-3 text-sm leading-relaxed text-pd-muted">
                  Choose OCR PDF for a searchable PDF. The output stays a PDF with recognized
                  text. It is useful when you want to keep the scanned page appearance while
                  finding words; check both the appearance and copied text.
                </p>
                <Link href="/ocr-pdf" className="mt-auto inline-flex min-h-11 items-center pt-4 font-semibold text-pd-brand hover:underline">Open OCR PDF</Link>
              </article>
            </div>
            <p className="mt-4 rounded-xl bg-pd-brand-muted p-5 text-sm leading-relaxed text-pd-foreground">
              Starting with photos? <Link href="/pdf-scanner" className="font-semibold text-pd-brand underline">PDF Scanner</Link>{" "}
              can create an image-based PDF from images or camera captures. It does not add
              searchable text. Use that PDF in OCR PDF or PDF to Word for your chosen output.
            </p>
          </section>

          <section id="conversion-steps" aria-labelledby="steps-heading" className="mt-12 scroll-mt-24">
            <h2 id="steps-heading" className="text-2xl font-bold text-pd-foreground">Convert your scanned PDF</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {[
                { title: "For an editable Word file", steps: GUIDE.wordSteps },
                { title: "For a searchable PDF", steps: GUIDE.pdfSteps },
              ].map((flow) => (
                <div key={flow.title} className="min-w-0 rounded-2xl border border-pd-border bg-pd-surface p-6">
                  <h3 className="text-lg font-bold text-pd-foreground">{flow.title}</h3>
                  <ol className="mt-4 list-decimal space-y-5 pl-5 text-sm leading-relaxed text-pd-muted">
                    {flow.steps.map((step) => (
                      <li key={step.name} className="pl-1"><strong className="text-pd-foreground">{step.name}.</strong> {step.text}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          <section id="table-support" aria-labelledby="tables-heading" className="mt-12 scroll-mt-24">
            <h2 id="tables-heading" className="text-2xl font-bold text-pd-foreground">What about scanned tables?</h2>
            <p className="mt-3 leading-relaxed text-pd-muted">
              In the local English test sets, clean ruled tables became native Word cells.
              The examples include wrapped descriptions and two separate tables stacked on
              one page, with text before, between and after them.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {tableEvidence.map((result) => (
                <article key={result.id} className="min-w-0 rounded-xl border border-pd-border bg-pd-surface p-5">
                  <h3 className="font-bold text-pd-foreground">{result.title}</h3>
                  <p className="mt-2 text-sm font-semibold text-pd-brand">{result.passed}/{result.total} controlled cases passed</p>
                  <p className="mt-2 text-sm leading-relaxed text-pd-muted">{result.summary}</p>
                  <p className="mt-2 text-xs text-pd-muted">Measured <time dateTime={result.measuredOnIso}>{result.measuredOn}</time></p>
                  <Link href={`/benchmarks#ocr-${result.id}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-pd-brand hover:underline">
                    View this table test and its limits
                  </Link>
                </article>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
              <p>
                These synthetic examples use complete four-column grids with a header and
                three item rows. Borderless memo controls stayed as prose. This does not
                establish conversion of arbitrary borderless tables, merged cells,
                side-by-side tables, skewed or damaged grids, or three tables on a page.
              </p>
              <p className="mt-3">
                Pass counts are not an accuracy percentage or customer acceptance. Source
                fonts and spacing were not reproduced exactly. Read the{" "}
                <Link href="/benchmarks#ocr-results" className="font-semibold underline">full OCR evidence</Link>{" "}
                for dated results, controls and review methods.
              </p>
            </div>
          </section>

          <section id="review-output" aria-labelledby="review-heading" className="mt-12 scroll-mt-24">
            <h2 id="review-heading" className="text-2xl font-bold text-pd-foreground">Check the download against your original</h2>
            <p className="mt-3 leading-relaxed text-pd-muted">A file opening successfully is only the first check. Use a short representative document before converting a larger set.</p>
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {GUIDE.reviewChecks.map((check) => (
                <li key={check.title} className="rounded-xl border border-pd-border bg-pd-surface p-5">
                  <h3 className="font-bold text-pd-foreground">{check.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-pd-muted">{check.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section id="common-problems" aria-labelledby="problems-heading" className="mt-12 scroll-mt-24">
            <h2 id="problems-heading" className="text-2xl font-bold text-pd-foreground">If the result needs improvement</h2>
            <div className="mt-5 space-y-4">
              {GUIDE.problems.map((problem) => (
                <article key={problem.title} className="rounded-xl border border-pd-border bg-pd-surface p-5">
                  <h3 className="font-bold text-pd-foreground">{problem.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-pd-muted">{problem.text}</p>
                </article>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-pd-muted">
              Why input quality matters: Tesseract documents how noise and tilted text can
              reduce recognition quality. See its{" "}
              <a href={GUIDE.sourceUrl} className="font-semibold text-pd-brand underline">official scan-quality guidance</a>.
              These preparation tips do not guarantee a particular result.
            </p>
          </section>

          <section aria-labelledby="guide-faq-heading" className="mt-12">
            <h2 id="guide-faq-heading" className="text-2xl font-bold text-pd-foreground">Scanned PDF questions</h2>
            <div className="mt-5 space-y-4">
              {GUIDE.faqs.map((faq) => (
                <article key={faq.question} className="rounded-xl border border-pd-border bg-pd-surface p-5">
                  <h3 className="font-bold text-pd-foreground">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-pd-muted">{faq.answer}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </MarketingPageShell>
    </>
  );
}
