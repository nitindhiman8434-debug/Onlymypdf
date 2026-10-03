export type ConversionBenchmarkResult = {
  tool: "PDF to Word" | "PDF to Excel" | "PDF to PowerPoint";
  slug: "pdf-to-word" | "pdf-to-excel" | "pdf-to-ppt";
  outputBytes: number;
  elapsedMs: number | null;
  packageParts: number | null;
  openable: boolean;
  editableFixtureTextFound: boolean;
};

export const CONVERSION_BENCHMARK = {
  reportId: "phase-3.1-local-2026-10-03",
  measuredOn: "3 October 2026",
  measuredOnIso: "2026-10-03",
  environment: "OnlyMyPDF local preview on Windows using loopback HTTP and Next.js 16.3.6",
  fixture: "Controlled two-page PDF with selectable text and a small table",
  inputBytes: 2311,
  results: [
    {
      tool: "PDF to Word",
      slug: "pdf-to-word",
      outputBytes: 37721,
      elapsedMs: null,
      packageParts: null,
      openable: true,
      editableFixtureTextFound: true,
    },
    {
      tool: "PDF to Excel",
      slug: "pdf-to-excel",
      outputBytes: 8706,
      elapsedMs: 2805,
      packageParts: 3,
      openable: true,
      editableFixtureTextFound: true,
    },
    {
      tool: "PDF to PowerPoint",
      slug: "pdf-to-ppt",
      outputBytes: 33303,
      elapsedMs: 2164,
      packageParts: 2,
      openable: true,
      editableFixtureTextFound: true,
    },
  ] satisfies readonly ConversionBenchmarkResult[],
  pageCompleteness: {
    singleConversion: "3/3 pages",
    inProcessChunk: "2/2 pages",
    subprocessChunk: "2/2 pages",
    searchableOcrBranch: "3/3 pages",
  },
  boundaries: [
    "This is a controlled local release check, not a universal conversion-accuracy score.",
    "The sample is too small to establish p95 speed, public capacity, uptime, or provider cost.",
    "Scanned PDFs, complex layouts, unusual fonts, charts, and very large files can produce different results.",
    "Public HTTPS load, deployed retention, and invoice-based cost measurements remain open release gates.",
  ],
} as const;

