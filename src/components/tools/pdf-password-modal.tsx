"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Eye, EyeOff, X } from "lucide-react";
import { useFocusTrap } from "@/lib/a11y/use-focus-trap";

interface PdfPasswordModalProps {
  fileName: string;
  errorMessage?: string;
  loading?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PdfPasswordModal({
  fileName,
  errorMessage,
  loading,
  onSubmit,
  onCancel,
}: PdfPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap(true);
  const titleId = "pdf-password-modal-title";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const cancelInProgressRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const handleBackdropCancel = useCallback(() => {
    if (cancelInProgressRef.current || loading) return;
    cancelInProgressRef.current = true;
    onCancelRef.current();
    queueMicrotask(() => {
      cancelInProgressRef.current = false;
    });
  }, [loading]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleBackdropCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleBackdropCancel]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (password.trim()) onSubmit(password);
    },
    [password, onSubmit]
  );

  const shortName = fileName.length > 32 ? `${fileName.slice(0, 29)}…` : fileName;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropCancel}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleBackdropCancel}
          aria-label="Close password dialog"
          className="absolute right-3 top-3 rounded-full p-1 text-pd-muted hover:bg-slate-100 hover:text-pd-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pd-brand-muted">
            <Lock className="h-5 w-5 text-pd-brand" aria-hidden="true" />
          </div>
          <div>
            <h3 id={titleId} className="text-lg font-bold text-pd-foreground">
              Enter password
            </h3>
            <p className="text-sm text-pd-muted">
              Type password to open <strong>{shortName}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="pdf-password-input" className="sr-only">
            PDF password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pd-muted" aria-hidden="true" />
            <input
              id="pdf-password-input"
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-pd-foreground placeholder:text-pd-muted focus:border-pd-brand focus:outline-none focus:ring-2 focus:ring-pd-brand/20 disabled:opacity-60"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-pd-muted hover:text-pd-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {errorMessage && (
            <p className="mt-2 text-sm font-medium text-red-600" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleBackdropCancel}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-pd-foreground hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="rounded-lg bg-pd-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-pd-brand/90 disabled:opacity-60"
            >
              {loading ? "Unlocking…" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
