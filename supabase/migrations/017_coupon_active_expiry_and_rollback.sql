-- Harden coupon redemption:
--  1. increment_coupon_usage now respects is_active + validity window.
--  2. decrement_coupon_usage enables rollback when fulfillment fails after increment.
--  3. payments.coupon_redeemed_at makes coupon redemption idempotent per payment.

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE coupon_codes
  SET times_used = times_used + 1
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_uses = -1 OR times_used < max_uses);
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_coupon_usage(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE coupon_codes
  SET times_used = GREATEST(times_used - 1, 0)
  WHERE code = UPPER(TRIM(p_code));
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS coupon_redeemed_at TIMESTAMPTZ;
