const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { localOcrEnvironment } = require("./local-ocr-runtime.cjs");
const repo = path.resolve("test-runtime");

test("missing project runtime leaves environment unchanged", () => {
  assert.deepEqual(localOcrEnvironment(repo, { PATH: "original" }, () => false), { PATH: "original" });
});

test("complete local runtime is passed only to child environment", () => {
  const input = { PATH: "original" };
  const result = localOcrEnvironment(repo, input, () => true);
  assert.equal(result.TESSERACT_PATH, path.join(repo, ".local-tools", "tesseract", "tesseract.exe"));
  assert.equal(result.TESSDATA_PREFIX, path.join(repo, ".local-tools", "tesseract", "tessdata"));
  assert.deepEqual(input, { PATH: "original" });
  assert.equal(result.PATH, "original");
});

test("explicit external OCR configuration is preserved", () => {
  const input = { TESSERACT_PATH: "external-tesseract", TESSDATA_PREFIX: "external-data" };
  assert.deepEqual(localOcrEnvironment(repo, input, () => true), input);
});

test("explicit language data is not replaced", () => {
  assert.equal(localOcrEnvironment(repo, { TESSDATA_PREFIX: "custom-data" }, () => true).TESSDATA_PREFIX, "custom-data");
});

test("incomplete local language packs are not advertised as a complete runtime", () => {
  const result = localOcrEnvironment(repo, {}, (file) => !file.endsWith("hin.traineddata"));
  assert.ok(result.TESSERACT_PATH);
  assert.equal(result.TESSDATA_PREFIX, undefined);
});
