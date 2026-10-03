import { describe, expect, it } from "vitest";
import { summarizeDocumentCorpus, type DocumentCorpusReport } from "./document-corpus";

const fixture = { caseId: "hindi", label: "Hindi memo", source: { markerCheck: { passed: true } } };
const report: DocumentCorpusReport = {
  generatedAt: "2026-10-03T00:00:00Z",
  mode: "conversion",
  cases: [fixture],
  results: [{ caseId: "hindi", tool: "pdf-to-word", status: "passed" }],
};

describe("public document corpus evidence", () => {
  it("keeps unexecuted routes outside the passing count", () => {
    expect(summarizeDocumentCorpus(report).counts).toEqual({
      passed: 1, failed: 0, error: 0, "not-tested": 2,
    });
  });

  it("never reuses a pass for a failed source fixture or generate-only run", () => {
    expect(summarizeDocumentCorpus({ ...report, mode: "generate-only" }).counts.passed).toBe(0);
    expect(summarizeDocumentCorpus({
      ...report, cases: [{ ...fixture, source: { markerCheck: { passed: false } } }],
    }).counts.passed).toBe(0);
  });

  it("reports explicit failures and errors without interpreting them as passes", () => {
    const measured = summarizeDocumentCorpus({ ...report, results: [
      ...report.results,
      { caseId: "hindi", tool: "pdf-to-excel", status: "failed" },
      { caseId: "hindi", tool: "pdf-to-ppt", status: "error" },
    ] });
    expect(measured.counts).toEqual({ passed: 1, failed: 1, error: 1, "not-tested": 0 });
  });

  it("rejects duplicate measurements and unknown statuses", () => {
    expect(() => summarizeDocumentCorpus({ ...report, cases: [fixture, fixture] })).toThrow("duplicate fixture IDs");
    expect(summarizeDocumentCorpus({ ...report, results: [...report.results, ...report.results] }).counts.error).toBe(1);
    expect(summarizeDocumentCorpus({ ...report, results: [
      { caseId: "hindi", tool: "pdf-to-word", status: "success" },
    ] }).counts.passed).toBe(0);
  });
});
