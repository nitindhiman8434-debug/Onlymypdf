import puppeteer, { type Browser } from "puppeteer";

let browserInstance: Browser | null = null;
let browserUses = 0;
const MAX_USES_BEFORE_RESTART = 40;

const BASE_LAUNCH_ARGS = [
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-first-run",
  "--disable-extensions",
  "--font-render-hinting=none",
  "--disable-background-networking",
  "--js-flags=--max-old-space-size=2048",
];

/**
 * This browser renders untrusted uploaded HTML, so the Chromium sandbox stays
 * on by default — without it a renderer bug reaches the host directly. Set
 * PUPPETEER_DISABLE_SANDBOX=1 only where the container itself is the boundary
 * (e.g. running as root in a disposable, network-isolated image).
 */
export function resolvePuppeteerLaunchArgs(
  env: Record<string, string | undefined> = process.env
): string[] {
  if (env.PUPPETEER_DISABLE_SANDBOX === "1") {
    if (env.NODE_ENV === "production" && env.PUPPETEER_HARDENED_CONTAINER !== "1") {
      throw new Error(
        "PUPPETEER_DISABLE_SANDBOX=1 is blocked in production unless PUPPETEER_HARDENED_CONTAINER=1 confirms a disposable, network-isolated container boundary."
      );
    }
    return ["--no-sandbox", "--disable-setuid-sandbox", ...BASE_LAUNCH_ARGS];
  }
  return BASE_LAUNCH_ARGS;
}

export async function getPuppeteerBrowser(): Promise<Browser> {
  if (browserInstance?.connected) {
    browserUses += 1;
    if (browserUses <= MAX_USES_BEFORE_RESTART) {
      return browserInstance;
    }
    await browserInstance.close().catch(() => {});
    browserInstance = null;
    browserUses = 0;
  }

  browserInstance = await puppeteer.launch({
    headless: true,
    args: resolvePuppeteerLaunchArgs(),
  });
  browserUses = 1;
  return browserInstance;
}

export async function closePuppeteerBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
    browserUses = 0;
  }
}
