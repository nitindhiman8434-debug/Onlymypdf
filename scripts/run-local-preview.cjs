#!/usr/bin/env node

const path = require("node:path");
const { spawn } = require("node:child_process");

// Only this child process uses the offline development profile. .env.local is
// untouched, and Next's dotenv loader keeps these explicit process overrides.
const offlineKeys = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  "FILE_STORAGE_PROVIDER",
  "NEXT_PUBLIC_FILE_STORAGE_PROVIDER",
  "INLINE_CONVERSION_WORKER",
];

const env = { ...process.env };
for (const key of offlineKeys) env[key] = "";
env.NEXT_PUBLIC_SUPABASE_URL = "your_supabase_url";
env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "your_supabase_anon_key";
env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3001";
env.ONLYMYPDF_LOCAL_PREVIEW = "1";
env.BILLING_MODE = "disabled";

const child = spawn(
  process.execPath,
  [
    "--max-old-space-size=4096",
    path.resolve(__dirname, "../node_modules/next/dist/bin/next"),
    "dev",
    "--webpack",
    "-p",
    "3001",
    "-H",
    "127.0.0.1",
  ],
  { cwd: path.resolve(__dirname, ".."), env, stdio: "inherit" }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
