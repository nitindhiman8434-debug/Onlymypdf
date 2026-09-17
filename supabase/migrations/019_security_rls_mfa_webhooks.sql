-- Close the daily_usage_counters RLS gap, require AAL2 on user-owned
-- tables when MFA is enrolled, pin profile email, and add webhook
-- event-id dedupe plus one-active-subscription-per-user.

-- ---------------------------------------------------------------------------
-- 1. daily_usage_counters — service-role / SECURITY DEFINER only
-- ---------------------------------------------------------------------------
ALTER TABLE public.daily_usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny client access to daily_usage_counters"
  ON public.daily_usage_counters;

CREATE POLICY "Deny client access to daily_usage_counters"
  ON public.daily_usage_counters
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. MFA: AAL1 sessions cannot read/write user data once TOTP is enrolled
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.session_satisfies_mfa()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.mfa_factors
    WHERE user_id = auth.uid()
      AND status = 'verified'
  ) THEN
    RETURN true;
  END IF;

  RETURN COALESCE(auth.jwt() ->> 'aal', '') = 'aal2';
END;
$$;

REVOKE ALL ON FUNCTION public.session_satisfies_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.session_satisfies_mfa() TO anon, authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can view own jobs" ON tool_jobs;
DROP POLICY IF EXISTS "Users can view own files" ON uploaded_files;
DROP POLICY IF EXISTS "Users can view own usage" ON usage_logs;
DROP POLICY IF EXISTS "Users can view own ai usage" ON ai_usage_logs;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id AND public.session_satisfies_mfa());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id AND public.session_satisfies_mfa())
  WITH CHECK (auth.uid() = id AND public.session_satisfies_mfa());

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id AND public.session_satisfies_mfa());

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id AND public.session_satisfies_mfa());

CREATE POLICY "Users can view own jobs"
  ON tool_jobs FOR SELECT
  USING (auth.uid() = user_id AND public.session_satisfies_mfa());

CREATE POLICY "Users can view own files"
  ON uploaded_files FOR SELECT
  USING (auth.uid() = user_id AND public.session_satisfies_mfa());

CREATE POLICY "Users can view own usage"
  ON usage_logs FOR SELECT
  USING (auth.uid() = user_id AND public.session_satisfies_mfa());

CREATE POLICY "Users can view own ai usage"
  ON ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id AND public.session_satisfies_mfa());

-- ---------------------------------------------------------------------------
-- 3. Users cannot rewrite their own billing/identity email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_profile_privileged_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND auth.role() = 'authenticated' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profile_role_update_forbidden';
    END IF;
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'profile_plan_update_forbidden';
    END IF;
    IF NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN
      RAISE EXCEPTION 'profile_plan_expires_update_forbidden';
    END IF;
    IF NEW.total_files_processed IS DISTINCT FROM OLD.total_files_processed THEN
      RAISE EXCEPTION 'profile_stats_update_forbidden';
    END IF;
    IF NEW.ai_credits_used IS DISTINCT FROM OLD.ai_credits_used THEN
      RAISE EXCEPTION 'profile_stats_update_forbidden';
    END IF;
    IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
      RAISE EXCEPTION 'profile_block_update_forbidden';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'profile_email_update_forbidden';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 4. Webhook event-id dedupe
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny client access to webhook_events" ON public.webhook_events;

CREATE POLICY "Deny client access to webhook_events"
  ON public.webhook_events
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 5. At most one live subscription row per user
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_user
  ON public.subscriptions (user_id)
  WHERE status IN ('active', 'past_due');
