import { describe, expect, it } from "vitest";
import { mapPdfToWordError } from "@/lib/services/pdf-to-word.service";

describe("mapPdfToWordError", () => {
  it("maps filesystem errors to a safe conversion message", () => {
    expect(
      mapPdfToWordError(
        "ENOENT: no such file or directory, open 'C:\\\\Temp\\\\output.docx'"
      )
    ).toBe(
      "Conversion did not produce a Word file. Please try again or use a different PDF."
    );
  });

  it("preserves password errors", () => {
    expect(mapPdfToWordError("PASSWORD_REQUIRED")).toBe("PASSWORD_REQUIRED");
    expect(mapPdfToWordError("WRONG_PASSWORD")).toBe("WRONG_PASSWORD");
  });
});
