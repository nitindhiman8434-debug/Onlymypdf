/**
 * Patches hero-product-ai.webp branding:
 * - sidebar: OnlyMyPDF wordmark + AI PDF Summarizer subtitle
 * - browser tab: OnlyMyPDF - AI PDF Summarizer
 * Run: node scripts/patch-hero-ai-brand.mjs
 */
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const imagePath = join(root, "public", "images", "hero-product-ai.webp");

const img = await loadImage(imagePath);
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0);

const sidebarBg = ctx.getImageData(50, 220, 1, 1).data;
const sidebarColor = `rgb(${sidebarBg[0]},${sidebarBg[1]},${sidebarBg[2]})`;

// Sidebar: logo, wordmark, subtitle row.
ctx.fillStyle = sidebarColor;
ctx.fillRect(10, 98, 185, 46);

ctx.fillStyle = "#ffffff";
ctx.font = `700 18px "Segoe UI", system-ui, sans-serif`;
ctx.textBaseline = "middle";
ctx.fillText("OnlyMyPDF", 40, 112);

ctx.font = `400 11px "Segoe UI", system-ui, sans-serif`;
ctx.fillStyle = "rgba(255,255,255,0.72)";
ctx.fillText("AI PDF Summarizer", 40, 132);

// Browser tab title — clone chrome row above text, then redraw title.
const tabX = 92;
const tabY = 15;
const tabW = 205;
const tabH = 11;
const cloneY = 14;

for (let dy = 0; dy < tabH; dy++) {
  for (let dx = 0; dx < tabW; dx++) {
    const sx = tabX + dx;
    const sample = ctx.getImageData(sx, cloneY, 1, 1).data;
    ctx.fillStyle = `rgb(${sample[0]},${sample[1]},${sample[2]})`;
    ctx.fillRect(sx, tabY + dy, 1, 1);
  }
}

ctx.fillStyle = "#e8eaed";
ctx.font = `400 10px "Segoe UI", system-ui, sans-serif`;
ctx.textBaseline = "middle";
ctx.fillText("OnlyMyPDF - AI PDF Summarizer", 94, 20.5);

writeFileSync(imagePath, canvas.toBuffer("image/webp", 90));
console.log("patched", imagePath);
