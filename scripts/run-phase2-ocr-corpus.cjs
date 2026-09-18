#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repo = process.cwd();
const envPath = path.join(repo, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (key !== "PDF2DOCX_PYTHON" || process.env[key]) continue;
    process.env[key] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const configured = (process.env.PDF2DOCX_PYTHON || "").trim();
const executable = configured || (process.platform === "win32" ? "py" : "python3");
const prefix = !configured && process.platform === "win32" ? ["-3"] : [];
const script = path.join(repo, "scripts", "phase2-ocr-corpus.py");
const result = spawnSync(executable, [...prefix, script, ...process.argv.slice(2)], {
  cwd: repo,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Unable to start Phase 2.3B OCR corpus: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
