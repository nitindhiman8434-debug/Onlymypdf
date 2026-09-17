/** External status page (Better Stack, Instatus, Statuspage, etc.) */
export function getExternalStatusPageUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_STATUS_PAGE_URL?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function isExternalStatusPageConfigured(): boolean {
  return getExternalStatusPageUrl() != null;
}
