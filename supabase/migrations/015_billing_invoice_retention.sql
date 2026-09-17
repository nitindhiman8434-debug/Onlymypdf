-- Retain anonymized GST invoices after account deletion (align with payments retention).

ALTER TABLE billing_invoices ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_user_id_fkey;
ALTER TABLE billing_invoices ADD CONSTRAINT billing_invoices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
