-- Idempotency marker for one-time payment fulfillment.
--
-- `last_fulfilled_payment_id` records which payment last extended the
-- subscription period. It is written in the SAME single-row UPDATE that sets the
-- period, so the marker and the extension are atomic. A crash + webhook retry (or
-- a cron stale-processing reset) therefore cannot stack a second billing period
-- onto the same payment.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_fulfilled_payment_id UUID;
