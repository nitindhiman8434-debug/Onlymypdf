#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { localOcrEnvironment } = require("./local-ocr-runtime.cjs");

const repo = path.resolve(__dirname, "..");
const env = localOcrEnvironment(repo);
const envPath = path.join(repo, ".env.local");
if (!env.PDF2DOCX_PYTHON && fs.existsSync(envPath)) {
  const match = fs.readFileSync(envPath, "utf8").match(/^\s*PDF2DOCX_PYTHON=(.*)$/m);
  if (match) env.PDF2DOCX_PYTHON = match[1].trim().replace(/^['"]|['"]$/g, "");
}
const executable = env.PDF2DOCX_PYTHON || (process.platform === "win32" ? "py" : "python3");
const prefix = !env.PDF2DOCX_PYTHON && process.platform === "win32" ? ["-3"] : [];
const result = spawnSync(executable, [...prefix, path.join(__dirname, "phase3-ocr-http-corpus.py"), ...process.argv.slice(2)], {
  cwd: repo, env, stdio: "inherit",
});
if (result.error) console.error(`Unable to start local OCR checks: ${result.error.message}`);
process.exit(result.status ?? 1);
