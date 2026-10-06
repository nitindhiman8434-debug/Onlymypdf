import wordReport from "../../quality/phase3-english-word/latest-report.json";
import geometryReport from "../../quality/phase3-ocr-geometry/final.json";
import tableReport from "../../quality/phase3-english-table/final-strict-report.json";
import multiTableReport from "../../quality/phase3-english-multitable/final-report.json";
import geometryRender from "../../quality/phase3-ocr-geometry/independent-render-report.json";
import tableVisual from "../../quality/phase3-english-table/visual-review-final-strict.json";
import multiTableVisual from "../../quality/phase3-english-multitable/visual-review.json";

// Server-page data only: do not pass the private reports to a client component.
type EvidenceObject = Record<string, unknown>;
export type OcrBenchmarkKind = "word" | "geometry" | "ruled-table";
export type OcrBenchmarkStatus = "passed" | "failed" | "error" | "not-tested";

function object(value: unknown): EvidenceObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as EvidenceObject : {};
}

function list(value: unknown): EvidenceObject[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function hasFailedGate(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasFailedGate);
  if (value !== null && typeof value === "object") {
    const gate = object(value);
    return gate.passed === false || Object.values(gate).some(hasFailedGate);
  }
  return false;
}

/** Both retained ISO timestamps and the geometry runner's compact UTC timestamp. */
export function ocrBenchmarkDate(generatedAt: unknown) {
  if (typeof generatedAt !== "string") throw new Error("Missing OCR evidence date");
  const compact = generatedAt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{0,6})Z$/);
  const timestamp = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}.${compact[7].padEnd(3, "0").slice(0, 3)}Z`
    : generatedAt;
  const calendar = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (!calendar) throw new Error("Invalid OCR evidence date");
  const [, year, month, day] = calendar;
  const calendarDay = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number.isFinite(calendarDay.getTime())
      || calendarDay.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    throw new Error("Invalid OCR evidence date");
  }
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) throw new Error("OCR evidence date needs a timezone");
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid OCR evidence date");
  return {
    measuredOnIso: date.toISOString().slice(0, 10),
    measuredOn: `${new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }).format(date)} (UTC)`,
  };
}

/** Recalculate from individual measurements, never a report's optimistic summary. */
export function summarizeOcrBenchmark(reportValue: unknown, kind: OcrBenchmarkKind) {
  const report = object(reportValue);
  const fixtures = list(report.cases);
  const ids = fixtures.map((fixture) => fixture.caseId);
  if (ids.some((id) => typeof id !== "string" || !id)
      || new Set(ids).size !== ids.length) {
    throw new Error("OCR evidence contains missing or duplicate fixture IDs");
  }
  const measured = kind === "geometry"
    ? report.mode === "http-conversion" : report.generateOnly === false;
  const results = kind === "geometry" ? fixtures : list(report.results);
  const counts: Record<OcrBenchmarkStatus, number> = {
    passed: 0, failed: 0, error: 0, "not-tested": 0,
  };
  for (const fixture of fixtures) {
    let status: OcrBenchmarkStatus = "not-tested";
    const matches = results.filter((result) => result.caseId === fixture.caseId);
    if (measured && matches.length > 1) status = "error";
    if (measured && matches.length === 1) {
      const result = matches[0];
      if (result.status === "failed" || result.status === "error") status = result.status;
      if (result.status === "passed") {
        const sourcePassed = kind === "geometry"
          ? object(fixture.fixture).literalSourceTextValidated === true
          : object(fixture.source).passed === true;
        const document = object(result.document);
        const gatesPassed = kind === "geometry"
          ? object(result.validation).passed === true && result.contentTypeMatched === true
          : result.tool === "pdf-to-word" && document.passed === true
            && document.validZip === true && object(document.content).passed === true
            && object(document.layout).passed === true && object(result.rendered).passed === true
            && (kind !== "ruled-table" || object(document.nativeTables).passed === true);
        status = sourcePassed && gatesPassed && !hasFailedGate(result)
          && !hasFailedGate(kind === "geometry" ? fixture.fixture : fixture.source)
          && result.httpStatus === 200
          && typeof result.outputBytes === "number" && result.outputBytes > 0
          ? "passed" : "failed";
      }
    }
    counts[status]++;
  }
  return {
    ...ocrBenchmarkDate(report.generatedAt),
    passed: counts.passed,
    total: fixtures.length,
    counts,
    status: fixtures.length > 0 && counts.passed === fixtures.length
      ? "passed" as const : "needs-review" as const,
  };
}

export type OcrBenchmark = ReturnType<typeof summarizeOcrBenchmark> & {
  id: string;
  phase: string;
  title: string;
  summary: string;
  checks: readonly string[];
  limits: readonly string[];
  toolHref: "/pdf-to-word" | "/ocr-pdf";
  toolLabel: string;
  visualPages?: number;
};

export const OCR_GEOMETRY_INDEPENDENT_PAGES = geometryRender.allPassed === true
  && geometryRender.pages.every((page) => page.identicalVisiblePixels === true)
  ? geometryRender.pages.length : 0;

export const OCR_BENCHMARKS: readonly OcrBenchmark[] = [
  {
    id: "english-word",
    phase: "3.2D",
    title: "English text and document order",
    ...summarizeOcrBenchmark(wordReport, "word"),
    summary: "Four controlled documents: a selectable memo, a scanned memo, a scanned invoice and a two-page scan.",
    checks: [
      "Complete editable text, word spacing, numbers and paragraph order.",
      "Invoice descriptions remain associated with their quantities and prices.",
      "Independent LibreOffice rendering checks complete text and the expected one- or two-page output.",
    ],
    limits: [
      "This text-focused check does not require native editable invoice table cells.",
      "Exact fonts, arbitrary layouts and pixel-identical positioning were not established.",
    ],
    toolHref: "/pdf-to-word", toolLabel: "Try PDF to Word",
  },
  {
    id: "ocr-page-geometry",
    phase: "3.2E",
    title: "Searchable PDF page sizes",
    ...summarizeOcrBenchmark(geometryReport, "geometry"),
    summary: "Five controlled cases covering Letter, fractional A4, landscape, mixed rotated/cropped pages and an already searchable PDF.",
    checks: [
      "Page count, visible physical dimensions, complete searchable text and word bounds.",
      "Existing searchable pages retain their original page boxes and rotation metadata.",
      OCR_GEOMETRY_INDEPENDENT_PAGES > 0
        ? `Independent Poppler rendering found identical visible pixels on ${OCR_GEOMETRY_INDEPENDENT_PAGES} output pages at ${geometryRender.dpi} DPI.`
        : "Independent Poppler pixel comparison needs review; no pixel-match claim is available.",
    ],
    limits: [
      "Clean synthetic English pages only; noisy scans and handwriting were not tested.",
      "OCR may normalize page-box or rotation metadata while keeping the visible physical page unchanged.",
    ],
    toolHref: "/ocr-pdf", toolLabel: "Try OCR PDF",
  },
  {
    id: "single-ruled-table",
    phase: "3.2F",
    title: "One ruled table per page",
    ...summarizeOcrBenchmark(tableReport, "ruled-table"),
    summary: "Three positive invoice cases, including wrapped descriptions and a two-page document, plus one borderless memo control.",
    checks: [
      "Complete native Word table cells, exact IDs, quantities and amounts.",
      "Wrapped descriptions remain in their own cells; the borderless memo remains prose.",
      "Independent LibreOffice rendering and separate agent review cover five output pages.",
    ],
    limits: [
      "The positive fixtures use clean, fully ruled four-column tables with a header and three item rows.",
      "Heading weight, row heights, spacing and wrap locations differ from the sources; review is not human sign-off.",
    ],
    toolHref: "/pdf-to-word", toolLabel: "Try PDF to Word",
    ...(tableVisual.status === "passed" && tableVisual.summary.allPixelsIdentical === true
      ? { visualPages: tableVisual.summary.comparedPages } : {}),
  },
  {
    id: "two-ruled-tables",
    phase: "3.2G",
    title: "Two separate tables on one page",
    ...summarizeOcrBenchmark(multiTableReport, "ruled-table"),
    summary: "Three positive one-page scans—portrait, wrapped descriptions and landscape—plus one borderless two-group memo control.",
    checks: [
      "Two separate native Word tables retain every cell, repeated header, ID and amount.",
      "Complete text before, between and after the tables remains in document order.",
      "Independent LibreOffice rendering, direct document XML checks and agent review cover all four output pages.",
    ],
    limits: [
      "Only two vertically separated, fully ruled four-column tables were measured.",
      "Merged cells, side-by-side tables, broken rules, skew and arbitrary borderless invoices are outside this result.",
      "Typography, spacing and wrap locations differ from the source; review is not human sign-off.",
    ],
    toolHref: "/pdf-to-word", toolLabel: "Try PDF to Word",
    ...(multiTableVisual.status === "passed" && multiTableVisual.blockingFindings.length === 0
      ? { visualPages: multiTableVisual.pagesInspected } : {}),
  },
];

export const OCR_BENCHMARK_LATEST_DATE_ISO = OCR_BENCHMARKS
  .map((benchmark) => benchmark.measuredOnIso).sort().at(-1)!;
