/** Default preview session lifetime (minutes). */
const DEFAULT_PREVIEW_SESSION_TTL_MINUTES = 15;

/** Default max thumbnail width for convert-result previews (pixels). */
const DEFAULT_PREVIEW_THUMB_MAX_WIDTH = 960;

const ABSOLUTE_THUMB_MAX_WIDTH = 1200;

export function getPreviewSessionTtlMs(): number {
  const raw = process.env.PREVIEW_SESSION_TTL_MINUTES;
  const minutes = raw ? Number(raw) : DEFAULT_PREVIEW_SESSION_TTL_MINUTES;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return DEFAULT_PREVIEW_SESSION_TTL_MINUTES * 60 * 1000;
  }
  return Math.floor(minutes) * 60 * 1000;
}

/** Server + shared cap for preview thumbnail render width. */
export function getPreviewThumbMaxWidth(): number {
  const raw =
    process.env.PREVIEW_THUMB_MAX_WIDTH ??
    process.env.NEXT_PUBLIC_PREVIEW_THUMB_MAX_WIDTH;
  const parsed = raw ? Number(raw) : DEFAULT_PREVIEW_THUMB_MAX_WIDTH;
  if (!Number.isFinite(parsed) || parsed < 40) {
    return DEFAULT_PREVIEW_THUMB_MAX_WIDTH;
  }
  return Math.min(ABSOLUTE_THUMB_MAX_WIDTH, Math.floor(parsed));
}

/** Inlined in client bundles via NEXT_PUBLIC_PREVIEW_THUMB_MAX_WIDTH. */
export function getClientPreviewThumbMaxWidth(): number {
  const raw = process.env.NEXT_PUBLIC_PREVIEW_THUMB_MAX_WIDTH;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 40) {
      return Math.min(ABSOLUTE_THUMB_MAX_WIDTH, Math.floor(parsed));
    }
  }
  return DEFAULT_PREVIEW_THUMB_MAX_WIDTH;
}
