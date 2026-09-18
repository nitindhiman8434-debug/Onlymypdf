export const CONSENT_VERSION = "1.0";
export const TERMS_CONSENT_VERSION = "tos-2026-09-18";
export const CONSENT_STORAGE_KEY = "onlymypdf_cookie_consent";

export type CookieConsentState = {
  version: string;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export function parseConsentCookie(value: string | undefined): CookieConsentState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as CookieConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (parsed.essential !== true) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function defaultConsentReject(): CookieConsentState {
  return {
    version: CONSENT_VERSION,
    essential: true,
    analytics: false,
    marketing: false,
    decidedAt: new Date().toISOString(),
  };
}

export function defaultConsentAcceptAll(): CookieConsentState {
  return {
    version: CONSENT_VERSION,
    essential: true,
    analytics: true,
    marketing: true,
    decidedAt: new Date().toISOString(),
  };
}
