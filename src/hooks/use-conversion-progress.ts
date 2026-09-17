"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseConversionProgressOptions {
  /** Max simulated progress while waiting on server (default 92). */
  cap?: number;
  /** Tick interval in ms (default 450). */
  intervalMs?: number;
  /** After hitting cap, creep up to this value so the bar does not look frozen (default 99). */
  stallCap?: number;
  /** Ms between +1% creep ticks once cap is reached (default 3000). */
  stallIntervalMs?: number;
}

export function useConversionProgress({
  cap = 92,
  intervalMs = 450,
  stallCap = 99,
  stallIntervalMs = 3000,
}: UseConversionProgressOptions = {}) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallStartedRef = useRef(false);

  const stopStall = useCallback(() => {
    if (stallTimerRef.current) {
      clearInterval(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const startStall = useCallback(() => {
    if (stallStartedRef.current) return;
    stallStartedRef.current = true;
    stopStall();
    stallTimerRef.current = setInterval(() => {
      setProgress((current) => {
        if (current >= stallCap) return current;
        return current + 1;
      });
    }, stallIntervalMs);
  }, [stallCap, stallIntervalMs, stopStall]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopStall();
    stallStartedRef.current = false;
  }, [stopStall]);

  const reset = useCallback(() => {
    stop();
    setProgress(0);
  }, [stop]);

  const start = useCallback(() => {
    stop();
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress((current) => {
        if (current >= cap) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          startStall();
          return current;
        }
        const step = current < 40 ? 4 : current < 75 ? 2 : 1;
        const next = Math.min(cap, current + step);
        if (next >= cap) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          startStall();
        }
        return next;
      });
    }, intervalMs);
  }, [cap, intervalMs, stop, startStall]);

  const complete = useCallback(() => {
    stop();
    setProgress(100);
  }, [stop]);

  /** Server responded — jump ahead while the result file downloads. */
  const advanceTo = useCallback(
    (target: number) => {
      setProgress((current) => Math.max(current, Math.min(stallCap, target)));
    },
    [stallCap]
  );

  useEffect(() => () => stop(), [stop]);

  return { progress, start, stop, complete, reset, advanceTo };
}
