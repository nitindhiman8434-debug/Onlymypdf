/**
 * Creates placeholder brand/hero images so Next.js Image src paths resolve.
 * Run: node scripts/create-placeholder-assets.mjs
 */
import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync, existsSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

const BRAND = "#2563eb";
const BRAND_DARK = "#1d4ed8";
const SURFACE = "#f8fafc";
const MUTED = "#64748b";

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function drawHero(canvas, title, subtitle) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#eff6ff");
  grad.addColorStop(1, "#dbeafe");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  roundRect(ctx, 48, 48, width - 96, height - 96, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = BRAND;
  ctx.font = "bold 42px system-ui, sans-serif";
  ctx.fillText("OnlyMyPDF", 80, 120);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText(title, 80, 200);

  ctx.fillStyle = MUTED;
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(subtitle, 80, 250);

  ctx.fillStyle = BRAND_DARK;
  roundRect(ctx, 80, 300, 220, 52, 12);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText("Try it free", 110, 334);

  ctx.fillStyle = "#e2e8f0";
  roundRect(ctx, 360, 140, width - 440, height - 220, 16);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText("PDF workspace preview", 400, 280);
}

function drawLogo(canvas, label, variant) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.fillStyle = SURFACE;
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.28;

  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, "#3b82f6");
  grad.addColorStop(1, BRAND_DARK);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy - (variant === "stacked" ? 40 : 0), r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(r * 0.9)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OM", cx, cy - (variant === "stacked" ? 40 : 0));

  const textY = variant === "stacked" ? cy + r * 0.55 : cy;
  ctx.fillStyle = BRAND;
  ctx.font = `bold ${variant === "horizontal" ? 28 : 32}px system-ui, sans-serif`;
  ctx.fillText("OnlyMyPDF", cx, textY);

  if (variant === "horizontal") {
    ctx.fillStyle = MUTED;
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(label, cx + 80, cy + 4);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function savePng(canvas, outPath) {
  ensureDir(outPath);
  writeFileSync(outPath, canvas.toBuffer("image/png"));
  console.log("wrote", outPath);
}

function saveWebp(canvas, outPath) {
  ensureDir(outPath);
  try {
    writeFileSync(outPath, canvas.toBuffer("image/webp"));
    console.log("wrote", outPath);
  } catch {
    const pngPath = outPath.replace(/\.webp$/, ".png");
    writeFileSync(pngPath, canvas.toBuffer("image/png"));
    console.log("wrote", pngPath, "(webp fallback)");
  }
}

const heroMain = createCanvas(1200, 750);
drawHero(heroMain, "Merge, split & convert PDFs", "Fast, secure, browser-based tools");
saveWebp(heroMain, join(publicDir, "images", "hero-product-main.webp"));

const heroAi = createCanvas(1200, 750);
const heroAiOut = join(publicDir, "images", "hero-product-ai.webp");
if (!existsSync(heroAiOut) || statSync(heroAiOut).size < 20_000) {
  drawHero(heroAi, "AI PDF Summarizer", "Key points from long documents in seconds");
  saveWebp(heroAi, heroAiOut);
} else {
  console.log("skip", heroAiOut, "(real asset already present)");
}

const logos = [
  ["logo-a-horizontal-clean.png", 420, 120, "horizontal"],
  ["logo-b-stacked-clean.png", 200, 220, "stacked"],
  ["logo-c-embossed-clean.png", 248, 280, "stacked"],
  ["logo-d-gradient-clean.png", 202, 220, "stacked"],
  ["logo-d-icon-header.png", 111, 111, "icon"],
];

for (const [name, w, h, variant] of logos) {
  const c = createCanvas(w, h);
  if (variant === "icon") {
    const ctx = c.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#3b82f6");
    grad.addColorStop(1, BRAND_DARK);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(w * 0.32)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OM", w / 2, h / 2);
  } else {
    drawLogo(c, "PDF tools online", variant);
  }
  savePng(c, join(publicDir, "logos", "clean", name));
}
