import { PRO_PRICING } from "@/config/constants";

/** Display-only currencies (checkout remains INR via Razorpay). */
export type DisplayCurrency = "INR" | "USD" | "EUR";

export const DISPLAY_CURRENCIES: DisplayCurrency[] = ["INR", "USD", "EUR"];

export const DISPLAY_CURRENCY_STORAGE_KEY = "onlymypdf-display-currency-v2";

/** Fixed marketing display prices (checkout always charges INR). */
const DISPLAY_MARKETING_USD = {
  monthly: 4,
  yearly: 32,
} as const;

const DISPLAY_MARKETING_EUR = {
  monthly: 4,
  yearly: 32,
} as const;

/** Fallback INR conversion when no fixed marketing price exists. */
const INR_TO_DISPLAY_RATE: Record<Exclude<DisplayCurrency, "INR">, number> = {
  USD: 1 / 83,
  EUR: 1 / 90,
};

const DISPLAY_CURRENCY_LOCALE: Record<DisplayCurrency, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
};

const PRO_MONTHLY_EQUIVALENT_INR = Math.round(PRO_PRICING.yearlyInr / 12);

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return DISPLAY_CURRENCIES.includes(value as DisplayCurrency);
}

function marketingDisplayAmount(
  amountInr: number,
  currency: Exclude<DisplayCurrency, "INR">
): number | null {
  if (amountInr === 0) return 0;

  if (currency === "USD") {
    if (amountInr === PRO_PRICING.monthlyInr) return DISPLAY_MARKETING_USD.monthly;
    if (amountInr === PRO_PRICING.yearlyInr) return DISPLAY_MARKETING_USD.yearly;
    if (amountInr === PRO_MONTHLY_EQUIVALENT_INR) {
      return Math.round((DISPLAY_MARKETING_USD.yearly / 12) * 100) / 100;
    }
  }

  if (currency === "EUR") {
    if (amountInr === PRO_PRICING.monthlyInr) return DISPLAY_MARKETING_EUR.monthly;
    if (amountInr === PRO_PRICING.yearlyInr) return DISPLAY_MARKETING_EUR.yearly;
    if (amountInr === PRO_MONTHLY_EQUIVALENT_INR) {
      return Math.round((DISPLAY_MARKETING_EUR.yearly / 12) * 100) / 100;
    }
  }

  return null;
}

export function convertInrForDisplay(
  amountInr: number,
  currency: DisplayCurrency
): number {
  if (currency === "INR") return amountInr;

  const marketing = marketingDisplayAmount(amountInr, currency);
  if (marketing !== null) return marketing;

  const converted = amountInr * INR_TO_DISPLAY_RATE[currency];
  return Math.round(converted * 100) / 100;
}

export function formatDisplayAmount(
  amountInr: number,
  currency: DisplayCurrency
): string {
  const value = convertInrForDisplay(amountInr, currency);
  return new Intl.NumberFormat(DISPLAY_CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "INR" ? 0 : 2,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  }).format(value);
}

export function inferDefaultDisplayCurrency(): DisplayCurrency {
  if (typeof navigator === "undefined") return "USD";

  const locale = navigator.language.toLowerCase();

  const eurPrefixes = [
    "de",
    "fr",
    "es",
    "it",
    "nl",
    "pt",
    "el",
    "fi",
    "sk",
    "sl",
    "et",
    "lv",
    "lt",
    "ga",
    "mt",
  ];
  if (eurPrefixes.some((p) => locale === p || locale.startsWith(`${p}-`))) {
    return "EUR";
  }

  return "USD";
}

export function readStoredDisplayCurrency(): DisplayCurrency | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
  return stored && isDisplayCurrency(stored) ? stored : null;
}
