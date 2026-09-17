-- Payment claim recovery needs a timestamp that changes with every status
-- transition. Without it, the cleanup cron cannot identify stale claims.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.payments
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_processing_updated_at
  ON public.payments (updated_at)
  WHERE status = 'processing';
