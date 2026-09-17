"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DISPLAY_CURRENCY_STORAGE_KEY,
  formatDisplayAmount,
  inferDefaultDisplayCurrency,
  readStoredDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/pricing/display-currency";

export function useDisplayCurrency() {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredDisplayCurrency();
    setCurrencyState(stored ?? inferDefaultDisplayCurrency());
    setHydrated(true);
  }, []);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
    localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, next);
  }, []);

  const formatInr = useCallback(
    (amountInr: number) => formatDisplayAmount(amountInr, currency),
    [currency]
  );

  return {
    currency,
    setCurrency,
    formatInr,
    hydrated,
    isInr: currency === "INR",
  };
}
