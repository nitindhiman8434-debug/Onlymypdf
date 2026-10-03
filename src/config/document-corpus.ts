export const CORPUS_TOOLS = [
  { id: "pdf-to-word", label: "Word" },
  { id: "pdf-to-excel", label: "Excel" },
  { id: "pdf-to-ppt", label: "PowerPoint" },
] as const;

export type CorpusStatus = "passed" | "failed" | "error" | "not-tested";

export interface DocumentCorpusReport {
  generatedAt: string;
  mode: string;
  cases: Array<{
    caseId: string;
    label: string;
    source?: { markerCheck?: { passed: boolean } };
  }>;
  results: Array<{ caseId: string; tool: string; status: string }>;
}

/** Missing, duplicate or unverified measurements must never become a public pass. */
export function summarizeDocumentCorpus(report: DocumentCorpusReport) {
  if (new Set(report.cases.map((fixture) => fixture.caseId)).size !== report.cases.length) {
    throw new Error("Document corpus contains duplicate fixture IDs");
  }
  const rows = report.cases.map((fixture) => ({
    caseId: fixture.caseId,
    label: fixture.label,
    results: CORPUS_TOOLS.map((tool) => {
      const matches = report.results.filter(
        (result) => result.caseId === fixture.caseId && result.tool === tool.id,
      );
      let status: CorpusStatus = "not-tested";
      if (report.mode === "conversion" && fixture.source?.markerCheck?.passed) {
        if (matches.length === 1) {
          const observed = matches[0].status;
          if (observed === "passed" || observed === "failed" || observed === "error") {
            status = observed;
          }
        } else if (matches.length > 1) {
          status = "error";
        }
      }
      return { tool: tool.id, status };
    }),
  }));
  const counts: Record<CorpusStatus, number> = {
    passed: 0, failed: 0, error: 0, "not-tested": 0,
  };
  for (const row of rows) {
    for (const result of row.results) counts[result.status]++;
  }
  return { rows, counts, total: rows.length * CORPUS_TOOLS.length };
}
