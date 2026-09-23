import { afterEach, describe, expect, it, vi } from "vitest";
import { getConversionWorkerRuntime } from "./conversion-worker-runtime";

describe("conversion worker runtime", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to a dedicated worker", () => {
    vi.stubEnv("CONVERSION_WORKER_RUNTIME", undefined);
    expect(getConversionWorkerRuntime()).toBe("dedicated");
  });

  it("selects the scale-to-zero scheduled runtime explicitly", () => {
    vi.stubEnv("CONVERSION_WORKER_RUNTIME", "scheduled");
    expect(getConversionWorkerRuntime()).toBe("scheduled");
  });

  it("fails closed to the dedicated runtime for unknown values", () => {
    vi.stubEnv("CONVERSION_WORKER_RUNTIME", "unexpected");
    expect(getConversionWorkerRuntime()).toBe("dedicated");
  });
});
