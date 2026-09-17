-- Track captured-but-unfulfilled payments so ops can refund or grant access manually.
-- Written only by the service role from the Razorpay webhook path.

CREATE TABLE IF NOT EXISTS payment_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id text,
  razorpay_payment_id text NOT NULL UNIQUE,
  amount_paise bigint,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'unresolved'
    CHECK (status IN ('unresolved', 'resolved')),
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_reconciliation_status_idx
  ON payment_reconciliation (status, created_at DESC);

ALTER TABLE payment_reconciliation ENABLE ROW LEVEL SECURITY;

-- No client access at all; service role bypasses RLS.
DROP POLICY IF EXISTS "Deny client select payment_reconciliation" ON payment_reconciliation;
DROP POLICY IF EXISTS "Deny client insert payment_reconciliation" ON payment_reconciliation;
DROP POLICY IF EXISTS "Deny client update payment_reconciliation" ON payment_reconciliation;
DROP POLICY IF EXISTS "Deny client delete payment_reconciliation" ON payment_reconciliation;

CREATE POLICY "Deny client select payment_reconciliation" ON payment_reconciliation
  FOR SELECT TO authenticated USING (false);
CREATE POLICY "Deny client insert payment_reconciliation" ON payment_reconciliation
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client update payment_reconciliation" ON payment_reconciliation
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client delete payment_reconciliation" ON payment_reconciliation
  FOR DELETE TO authenticated USING (false);
