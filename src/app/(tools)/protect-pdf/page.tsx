'use client';

import { useState, useRef, useCallback } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatFileSize } from '@/lib/utils/file';
import { ToolPageShell } from '@/components/layout/tool-page-shell';
import { mapFaqs, mapRelatedTools } from '@/components/tools/tool-helpers';
import {
  ToolDropzone,
  ToolErrorBanner,
  ToolPrimaryButton,
  ToolSuccessPanel,
} from '@/components/tools/tool-ui';
import { useToolErrors } from '@/hooks/use-tool-errors';

const RELATED_TOOLS = [
  { name: 'Unlock PDF', href: '/unlock-pdf' },
  { name: 'Sign PDF', href: '/sign-pdf' },
  { name: 'Merge PDF', href: '/merge-pdf' },
  { name: 'Compress PDF', href: '/compress-pdf' },
];

const FAQS = [
  { q: 'How secure is the password protection?', a: 'The generated PDF uses AES-256 password encryption. Use a unique, strong password and share it separately.' },
  { q: 'Can I remove the password later?', a: 'Yes! Use our Unlock PDF tool to remove the password protection. You will need the correct password to do so.' },
  { q: 'What makes a strong password?', a: 'A strong password is at least 8 characters long and includes a mix of uppercase letters, lowercase letters, numbers, and special characters.' },
  { q: 'Will password protection change the PDF content?', a: 'No. Password protection only adds an encryption layer. Your PDF content, formatting, and images remain exactly the same.' },
];

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return 'weak';
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  if (password.length >= 8 && score >= 3) return 'strong';
  if (password.length >= 6 && score >= 2) return 'medium';
  return 'weak';
}

const strengthConfig: Record<PasswordStrength, { label: string; color: string; bg: string; width: string }> = {
  weak: { label: 'Weak', color: 'text-red-600', bg: 'bg-red-500', width: 'w-1/3' },
  medium: { label: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-500', width: 'w-2/3' },
  strong: { label: 'Strong', color: 'text-green-600', bg: 'bg-green-500', width: 'w-full' },
};

export default function ProtectPdfPage() {
  const { resolveApiError, resolveCatchError } = useToolErrors();
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit = files.length > 0 && password.length > 0 && passwordsMatch && !processing;

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length > 0) {
      setFiles([pdfFiles[0]]);
      setError(null);
      setCompleted(false);
      setResultUrl(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleProcess = async () => {
    if (!canSubmit) return;
    setProcessing(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 120_000);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('password', password);

      const res = await fetch('/api/tools/protect-pdf', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(resolveApiError(err, 'errors.processingFailed'));
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/pdf')) {
        throw new Error(resolveApiError('Server did not return a PDF file.', 'errors.processingFailed'));
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error(resolveApiError('Protected PDF is empty.', 'errors.processingFailed'));
      }

      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultFilename(files[0].name.replace(/\.pdf$/i, '-protected.pdf'));
      setResultSize(blob.size);
      setCompleted(true);
      const { notifyActivityUpdated } = await import("@/lib/client/activity-events");
      notifyActivityUpdated();
    } catch (err) {
      setError(
        resolveCatchError(err, { timeoutKey: 'toolPage.errors.protectionTimeout' })
      );
    } finally {
      window.clearTimeout(timeoutId);
      setProcessing(false);
    }
  };

  return (
    <ToolPageShell
      title="Protect PDF"
      description="Add password protection to your PDF"
      relatedTools={mapRelatedTools(RELATED_TOOLS)}
      faqs={mapFaqs(FAQS)}
    >
      {completed && resultUrl ? (
        <ToolSuccessPanel
          title="PDF Protected Successfully!"
          description="Your password-protected PDF is ready to download."
          downloadUrl={resultUrl}
          downloadFilename={resultFilename || 'protected.pdf'}
          downloadLabel="Download Protected PDF"
          resultSizeBytes={resultSize}
          resetLabel="Protect another file"
          onReset={() => {
            setCompleted(false);
            setFiles([]);
            setResultUrl(null);
            setResultSize(0);
            setPassword('');
            setConfirmPassword('');
          }}
        />
      ) : (
        <>
          <ToolDropzone
            hint="or drop files here"
            formatNote="PDF only"
            dragOver={dragOver}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onChooseFiles={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            fileInputAccept=".pdf"
            onFileInputChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          

          {files.length > 0 && (
            <>
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-pd-brand-muted p-3">
                <Lock className="h-4 w-4 shrink-0 text-pd-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-pd-foreground">{files[0].name}</p>
                  <p className="text-xs text-pd-muted">{formatFileSize(files[0].size)}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="protect-pdf-password" className="mb-2 block text-sm font-semibold text-pd-foreground">Password</label>
                  <div className="relative">
                    <input
                      id="protect-pdf-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a password"
                      className="w-full rounded-xl border border-pd-border px-4 py-3 pr-12 focus:border-pd-brand focus:outline-none focus:ring-2 focus:ring-pd-brand/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-pd-muted transition-colors hover:text-pd-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-pd-border">
                          <div className={cn('h-full rounded-full transition-all duration-300', strengthConfig[passwordStrength].bg, strengthConfig[passwordStrength].width)} />
                        </div>
                        <span className={cn('text-xs font-medium', strengthConfig[passwordStrength].color)}>
                          {strengthConfig[passwordStrength].label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="protect-pdf-confirm-password" className="mb-2 block text-sm font-semibold text-pd-foreground">Confirm Password</label>
                  <div className="relative">
                    <input
                      id="protect-pdf-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 pr-12 focus:outline-none focus:ring-2',
                        confirmPassword && !passwordsMatch
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                          : 'border-pd-border focus:border-pd-brand focus:ring-pd-brand/20'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-pd-muted transition-colors hover:text-pd-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="mt-1 text-xs text-red-600" role="alert">Passwords do not match</p>
                  )}
                </div>
              </div>
            </>
          )}

          {error && <ToolErrorBanner message={error} />}

          <ToolPrimaryButton
            onClick={handleProcess}
            disabled={!canSubmit}
            loading={processing}
            loadingLabel="Protecting your PDF..."
          >
            Protect PDF
          </ToolPrimaryButton>
        </>
      )}
    </ToolPageShell>
  );
}
