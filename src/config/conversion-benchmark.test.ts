import { describe, expect, it } from "vitest";
import { CONVERSION_BENCHMARK } from "@/config/conversion-benchmark";

describe("CONVERSION_BENCHMARK", () => {
  it("publishes one verified result for each Office conversion route", () => {
    expect(CONVERSION_BENCHMARK.results.map((result) => result.slug)).toEqual([
      "pdf-to-word",
      "pdf-to-excel",
      "pdf-to-ppt",
    ]);

    for (const result of CONVERSION_BENCHMARK.results) {
      expect(result.openable).toBe(true);
      expect(result.editableFixtureTextFound).toBe(true);
      expect(result.outputBytes).toBeGreaterThan(0);
    }
  });

  it("keeps local evidence separate from public production claims", () => {
    expect(CONVERSION_BENCHMARK.environment).toContain("local preview");
    expect(CONVERSION_BENCHMARK.boundaries.join(" ")).toContain("Public HTTPS");
    expect(CONVERSION_BENCHMARK.boundaries.join(" ")).not.toContain("100% accurate");
  });
});

