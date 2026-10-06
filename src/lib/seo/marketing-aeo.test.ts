import { describe, expect, it } from "vitest";
import { APP_URL } from "@/config/constants";
import { generateLlmsTxt } from "@/lib/seo/marketing-aeo";
import { GET as getLlms } from "@/app/llms.txt/route";
import { GET as getAi } from "@/app/ai.txt/route";

const guideUrl = `${APP_URL}/guides/scanned-pdf-to-word`;

describe("English guide discovery", () => {
  it("links the guide once alongside existing tool, benchmark and policy discovery", () => {
    const text = generateLlmsTxt();
    expect(text).toContain(`Scanned PDF to Word: OCR Guide — ${guideUrl}`);
    expect(text.split(guideUrl)).toHaveLength(2);
    expect(text).toContain("## Guides");
    expect(text).toContain(`${APP_URL}/pdf-to-word`);
    expect(text).toContain(`${APP_URL}/ocr-pdf`);
    expect(text).toContain(`${APP_URL}/benchmarks`);
    expect(text).toContain(`${APP_URL}/privacy`);
    expect(text).not.toContain(`${APP_URL}/hi/guides`);
    expect(text).not.toContain(`${APP_URL}/en/guides`);
  });

  it.each([
    { path: "/llms.txt", get: getLlms },
    { path: "/ai.txt", get: getAi },
  ])("serves the same canonical guide through $path", async ({ get }) => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await response.text();
    expect(text.split(guideUrl)).toHaveLength(2);
    expect(text).toContain(`Scanned PDF to Word: OCR Guide — ${guideUrl}`);
  });
});
