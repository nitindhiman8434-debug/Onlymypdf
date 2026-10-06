import scannerReport from "../../quality/phase3-scanner/first-report.json";

// Server-page evidence projection. Never pass the retained report to a client.
type Evidence = Record<string, unknown>;
type CaseKind = "positive" | "negative";
type CaseStatus = "passed" | "failed" | "not-tested";
type CaseDefinition = {
  id: string; title: string; kind: CaseKind; filter: string; inputs: number;
  checks: readonly string[];
};

const CASES: readonly CaseDefinition[] = [
  { id: "original-color-png", title: "Original color image", kind: "positive", filter: "original", inputs: 1,
    checks: ["Compare decoded output pixels with the independent source image."] },
  { id: "bw-gray-levels", title: "Black & White filter", kind: "positive", filter: "bw", inputs: 1,
    checks: ["Compare against an independent threshold of 128, with only black and white output pixels."] },
  { id: "enhanced-low-contrast", title: "Enhanced low-contrast image", kind: "positive", filter: "enhanced", inputs: 1,
    checks: ["Measure the change in contrast and check that gray patches remain in order."] },
  { id: "exif-6-upright-jpeg", title: "Phone-style photo orientation", kind: "positive", filter: "original", inputs: 1,
    checks: ["Compare an EXIF orientation-6 JPEG against independently rotated source pixels. This is a file test, not a camera-device test."] },
  { id: "ten-mixed-pages-in-order", title: "Ten images in page order", kind: "positive", filter: "original", inputs: 10,
    checks: ["Compare each output page with its numbered source across JPG, PNG and WebP inputs."] },
  { id: "reject-eleven-images", title: "Eleven-image batch", kind: "negative", filter: "original", inputs: 11, checks: [] },
  { id: "reject-unknown-filter", title: "Unknown filter", kind: "negative", filter: "unknown-filter", inputs: 1, checks: [] },
  { id: "reject-no-images", title: "Empty upload", kind: "negative", filter: "original", inputs: 0, checks: [] },
  { id: "reject-non-image", title: "Non-image file", kind: "negative", filter: "original", inputs: 1, checks: [] },
  { id: "reject-truncated-image", title: "Truncated image", kind: "negative", filter: "original", inputs: 1, checks: [] },
  { id: "reject-entire-mixed-corrupt-batch", title: "Valid image plus corrupt image", kind: "negative", filter: "original", inputs: 2, checks: [] },
];

function object(value: unknown): Evidence {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Evidence : {};
}
function list(value: unknown): Evidence[] {
  return Array.isArray(value) ? value.map(object) : [];
}
function strings(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0) ? value : [];
}
function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function hasFailedGate(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasFailedGate);
  if (value !== null && typeof value === "object") {
    const gate = object(value);
    return gate.passed === false || Object.values(gate).some(hasFailedGate);
  }
  return false;
}

function measuredDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error("Scanner evidence needs an ISO date with a timezone");
  }
  const date = new Date(value);
  const calendar = value.slice(0, 10);
  if (!Number.isFinite(date.getTime()) || new Date(`${calendar}T00:00:00Z`).toISOString().slice(0, 10) !== calendar) {
    throw new Error("Invalid scanner evidence date");
  }
  return {
    measuredAtIso: date.toISOString(), measuredOnIso: date.toISOString().slice(0, 10),
    measuredOn: `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)} (UTC)`,
  };
}

function validPixels(page: Evidence, filter: string): boolean {
  const pixel = object(page.pixelCheck);
  if (pixel.passed !== true) return false;
  if (filter === "bw") {
    return pixel.threshold === 128 && pixel.differentChannels === 0
      && Array.isArray(pixel.pixelLevels) && pixel.pixelLevels.length === 2
      && pixel.pixelLevels[0] === 0 && pixel.pixelLevels[1] === 255;
  }
  if (filter === "enhanced") {
    const patches = pixel.orderedPatchMeans;
    return finiteNumber(pixel.sourceP95P5Range) && positiveNumber(pixel.outputP95P5Range)
      && pixel.outputP95P5Range > pixel.sourceP95P5Range
      && positiveNumber(pixel.meanAbsoluteChannelDifference)
      && Array.isArray(patches) && patches.length === 4
      && patches.every((value, index) => finiteNumber(value) && (index === 0 || value > patches[index - 1]));
  }
  const tolerance = object(pixel.tolerance);
  return finiteNumber(pixel.meanAbsoluteChannelDifference) && pixel.meanAbsoluteChannelDifference >= 0
    && finiteNumber(pixel.maximumChannelDifference) && pixel.maximumChannelDifference >= 0
    && pixel.maximumChannelDifference <= (tolerance.singleChannelDifferenceMax === 8 ? 8 : 0)
    && pixel.meanAbsoluteChannelDifference <= (tolerance.meanAbsoluteChannelDifferenceMax === 1 ? 1 : 0);
}

function validOutput(result: Evidence, definition: CaseDefinition, sources: Evidence[]): boolean {
  const validation = object(result.validation);
  const pages = list(validation.pages);
  const sourceMatches = sources.filter((source) => source.caseId === definition.id);
  const files = list(sourceMatches[0]?.files);
  const renders = strings(result.renderedPreviewPaths);
  return result.httpStatus === 200 && result.contentType === "application/pdf"
    && positiveNumber(result.outputBytes) && validation.passed === true
    && validation.pageCount === definition.inputs && pages.length === definition.inputs
    && sourceMatches.length === 1 && files.length === definition.inputs
    && new Set(files.map((file) => file.path)).size === files.length
    && renders.length === definition.inputs && new Set(renders).size === renders.length
    && pages.every((page, index) => page.passed === true && page.page === index + 1
      && typeof files[index].path === "string" && page.sourcePath === files[index].path
      && finiteNumber(page.widthPoints) && Math.abs(page.widthPoints - 595.28) < 0.02
      && finiteNumber(page.heightPoints) && Math.abs(page.heightPoints - 841.89) < 0.02
      && page.selectableTextCharacters === 0 && validPixels(page, definition.filter))
    && !hasFailedGate(result);
}

/** Fixed denominators keep missing or duplicate measurements from becoming passes. */
export function summarizeScannerBenchmark(value: unknown) {
  const report = object(value);
  const results = list(report.results);
  const sources = list(report.sources);
  const measured = report.schemaVersion === 1 && report.phase === "3.4" && report.generateOnly === false;
  const cases = CASES.map((definition) => {
    const matches = results.filter((result) => result.caseId === definition.id);
    const result = matches[0];
    let status: CaseStatus = "not-tested";
    if (measured && matches.length > 0) {
      const common = matches.length === 1 && result.kind === definition.kind
        && result.filter === definition.filter && result.inputFiles === definition.inputs && result.status === "passed";
      const gates = definition.kind === "positive" ? validOutput(result, definition, sources)
        : result.httpStatus === 400 && result.contentType === "application/json"
          && result.noPdfArtifact === true && positiveNumber(result.outputBytes) && !hasFailedGate(result);
      status = common && gates ? "passed" : "failed";
    }
    const checks = definition.kind === "negative"
      ? ["Reject with HTTP 400 JSON and no PDF artifact."] : [...definition.checks];
    if (status === "passed" && definition.filter === "enhanced") {
      const pixel = object(list(object(result.validation).pages)[0].pixelCheck);
      checks.push(`On this synthetic fixture, the 5th-to-95th percentile gray range increased from ${pixel.sourceP95P5Range} to ${pixel.outputP95P5Range}. This does not establish readability on every photo.`);
    }
    return { id: definition.id, title: definition.title, kind: definition.kind, status,
      pageCount: status === "passed" && definition.kind === "positive" ? definition.inputs : 0, checks };
  });
  const positive = cases.filter((item) => item.kind === "positive");
  const negative = cases.filter((item) => item.kind === "negative");
  const unexpected = results.some((result) => !CASES.some((definition) => definition.id === result.caseId));
  const outputPages = positive.reduce((total, item) => total + item.pageCount, 0);
  return {
    ...measuredDate(report.generatedAt), cases,
    positivePassed: positive.filter((item) => item.status === "passed").length, positiveTotal: positive.length,
    negativePassed: negative.filter((item) => item.status === "passed").length, negativeTotal: negative.length,
    outputPages, renderedPages: outputPages,
    status: !unexpected && cases.every((item) => item.status === "passed") ? "passed" as const : "needs-review" as const,
    method: "Local HTTP requests with synthetic images; independent Pillow source comparisons, PDF structure and geometry checks, and Poppler rendering at 96 DPI. Invalid uploads are tested separately from successful conversions.",
    limits: [
      "Static synthetic JPG, PNG and WebP inputs only. These pass counts are not a universal accuracy percentage or real-customer acceptance result.",
      "Original comparisons allow small independent JPEG-decoder rounding differences; B&W and Enhanced intentionally change pixels.",
      "The output is an image-based PDF without OCR. Physical cameras, handwriting, animated images, automatic crop and perspective correction were not certified.",
      "Filters can lose faint text or shading. The Enhanced result measures one low-contrast fixture, not a guarantee of better readability.",
      "Ten tested images do not establish ten maximum-size images, production speed, memory capacity, cost or public availability.",
    ],
  };
}

export const SCANNER_BENCHMARK = summarizeScannerBenchmark(scannerReport);
