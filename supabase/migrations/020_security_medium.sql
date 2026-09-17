-- Invoice sequence, org audit logs, and unique webhook event retries stay
-- service-role only. Does not change conversion / tool processing.

-- ---------------------------------------------------------------------------
-- 1. Atomic GST invoice numbers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  year INTEGER PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny client access to invoice_counters" ON public.invoice_counters;

CREATE POLICY "Deny client access to invoice_counters"
  ON public.invoice_counters
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  seq INTEGER;
BEGIN
  INSERT INTO public.invoice_counters (year, last_seq)
  VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_seq = public.invoice_counters.last_seq + 1
  RETURNING last_seq INTO seq;

  RETURN 'OMP-' || y::TEXT || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Organization audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_org_created
  ON public.organization_audit_logs (organization_id, created_at DESC);

ALTER TABLE public.organization_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny client access to organization_audit_logs"
  ON public.organization_audit_logs;

CREATE POLICY "Deny client access to organization_audit_logs"
  ON public.organization_audit_logs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
