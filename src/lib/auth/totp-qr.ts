/** Render Supabase TOTP QR SVG as a safe img src (no dangerouslySetInnerHTML). */
export function totpQrSvgToDataUrl(svg: string): string {
  const trimmed = svg.trim();
  const base64 =
    typeof btoa === "function"
      ? btoa(trimmed)
      : Buffer.from(trimmed, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
