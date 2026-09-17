import {
  CONSENT_STORAGE_KEY,
  type CookieConsentState,
} from "@/lib/privacy/consent";

export function persistConsentLocal(state: CookieConsentState) {
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `pd_consent=${encodeURIComponent(JSON.stringify(state))};path=/;max-age=31536000;SameSite=Lax${secure}`;
}

export async function syncConsentToServer(state: CookieConsentState) {
  await fetch("/api/privacy/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      analytics: state.analytics,
      marketing: state.marketing,
      consent_version: state.version,
    }),
  });
}

export function consentStateFromServer(record: {
  consent_version: string;
  analytics: boolean;
  marketing: boolean;
  created_at: string;
}): CookieConsentState {
  return {
    version: record.consent_version,
    essential: true,
    analytics: record.analytics,
    marketing: record.marketing,
    decidedAt: record.created_at,
  };
}

export async function hydrateConsentFromServerIfMissing() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(CONSENT_STORAGE_KEY)) return;

  try {
    const res = await fetch("/api/privacy/consent");
    if (!res.ok) return;
    const data = (await res.json()) as {
      consent?: {
        consent_version: string;
        analytics: boolean;
        marketing: boolean;
        created_at: string;
      } | null;
    };
    if (data.consent) {
      persistConsentLocal(consentStateFromServer(data.consent));
    }
  } catch {
    /* non-blocking */
  }
}

export async function applyConsent(state: CookieConsentState) {
  persistConsentLocal(state);
  try {
    await syncConsentToServer(state);
  } catch {
    /* non-blocking */
  }
}
