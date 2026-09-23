-- Durable PDF-to-Word jobs backed by Supabase Queues (PGMQ).
-- Only the service role can read job payloads or call queue wrappers.

CREATE EXTENSION IF NOT EXISTS pgmq;

DO $$
BEGIN
  PERFORM pgmq.create('pdf_to_word_jobs');
EXCEPTION
  WHEN duplicate_table OR unique_violation THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.conversion_job_records (
  job_id UUID PRIMARY KEY,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'done', 'error')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversion_job_records_status_started
  ON public.conversion_job_records (status, started_at);
CREATE INDEX IF NOT EXISTS idx_conversion_job_records_expires
  ON public.conversion_job_records (expires_at);

ALTER TABLE public.conversion_job_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversion_job_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversion_job_records TO service_role;

CREATE TABLE IF NOT EXISTS public.conversion_worker_heartbeat (
  worker_name TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.conversion_worker_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversion_worker_heartbeat FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversion_worker_heartbeat TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_pdf_to_word_job(p_job_id UUID)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT send
  FROM pgmq.send('pdf_to_word_jobs', jsonb_build_object('job_id', p_job_id), 0);
$$;

CREATE OR REPLACE FUNCTION public.claim_pdf_to_word_job(p_visibility_seconds INTEGER DEFAULT 900)
RETURNS TABLE(msg_id BIGINT, job_id UUID, read_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT message.msg_id,
         (message.message ->> 'job_id')::UUID,
         message.read_ct
  FROM pgmq.read('pdf_to_word_jobs', GREATEST(1, p_visibility_seconds), 1) AS message;
$$;

CREATE OR REPLACE FUNCTION public.delete_pdf_to_word_queue_message(p_msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pgmq.delete('pdf_to_word_jobs', p_msg_id);
$$;

CREATE OR REPLACE FUNCTION public.pdf_to_word_queue_depth()
RETURNS TABLE(pending BIGINT, processing BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*) FILTER (WHERE status = 'queued')::BIGINT,
         COUNT(*) FILTER (WHERE status = 'running')::BIGINT
  FROM public.conversion_job_records
  WHERE expires_at > NOW();
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_conversion_queue_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.conversion_job_records WHERE expires_at <= NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_pdf_to_word_job(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_pdf_to_word_job(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_pdf_to_word_queue_message(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pdf_to_word_queue_depth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_conversion_queue_jobs() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_pdf_to_word_job(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_pdf_to_word_job(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_pdf_to_word_queue_message(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.pdf_to_word_queue_depth() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_conversion_queue_jobs() TO service_role;

-- Fixed-window distributed API rate limits. The RPC is atomic per bucket.
CREATE TABLE IF NOT EXISTS public.runtime_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.runtime_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.runtime_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.runtime_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_runtime_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_count INTEGER;
  current_reset TIMESTAMPTZ;
BEGIN
  IF p_max_requests < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit settings';
  END IF;

  INSERT INTO public.runtime_rate_limits (bucket_key, request_count, reset_at)
  VALUES (p_key, 1, NOW() + make_interval(secs => p_window_seconds))
  ON CONFLICT (bucket_key) DO UPDATE
  SET request_count = CASE
        WHEN public.runtime_rate_limits.reset_at <= NOW() THEN 1
        ELSE public.runtime_rate_limits.request_count + 1
      END,
      reset_at = CASE
        WHEN public.runtime_rate_limits.reset_at <= NOW()
          THEN NOW() + make_interval(secs => p_window_seconds)
        ELSE public.runtime_rate_limits.reset_at
      END
  RETURNING request_count, reset_at INTO current_count, current_reset;

  allowed := current_count <= p_max_requests;
  remaining := GREATEST(0, p_max_requests - current_count);
  retry_after_seconds := CASE
    WHEN allowed THEN 0
    ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (current_reset - NOW())))::INTEGER)
  END;
  RETURN NEXT;
END;
$$;

-- Distributed leases cap heavy conversions across web and worker instances.
CREATE TABLE IF NOT EXISTS public.runtime_heavy_job_leases (
  lease_id UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.runtime_heavy_job_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.runtime_heavy_job_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.runtime_heavy_job_leases TO service_role;

CREATE OR REPLACE FUNCTION public.try_acquire_heavy_job_lease(
  p_lease_id UUID,
  p_max_jobs INTEGER,
  p_lease_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('onlymypdf-heavy-job-semaphore'));
  DELETE FROM public.runtime_heavy_job_leases WHERE expires_at <= NOW();
  SELECT COUNT(*) INTO active_count FROM public.runtime_heavy_job_leases;
  IF active_count >= GREATEST(1, p_max_jobs) THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.runtime_heavy_job_leases (lease_id, expires_at)
  VALUES (p_lease_id, NOW() + make_interval(secs => GREATEST(1, p_lease_seconds)));
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_heavy_job_lease(p_lease_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.runtime_heavy_job_leases WHERE lease_id = p_lease_id;
$$;

-- Owner-bound direct-upload grants must be consumed exactly once.
CREATE TABLE IF NOT EXISTS public.runtime_one_time_claims (
  claim_key TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.runtime_one_time_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.runtime_one_time_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.runtime_one_time_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_runtime_one_time_key(p_key TEXT, p_ttl_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  DELETE FROM public.runtime_one_time_claims
    WHERE claim_key = p_key AND expires_at <= NOW();
  INSERT INTO public.runtime_one_time_claims (claim_key, expires_at)
  VALUES (p_key, NOW() + make_interval(secs => GREATEST(1, p_ttl_seconds)))
  ON CONFLICT (claim_key) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count = 1;
END;
$$;

-- Short-lived PDF preview metadata; PDF bytes remain in private Storage.
CREATE TABLE IF NOT EXISTS public.pdf_session_records (
  session_id UUID PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdf_session_records_expires
  ON public.pdf_session_records (expires_at);
ALTER TABLE public.pdf_session_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdf_session_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_session_records TO service_role;

REVOKE ALL ON FUNCTION public.check_runtime_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.try_acquire_heavy_job_lease(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_heavy_job_lease(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_runtime_one_time_key(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_runtime_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_heavy_job_lease(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_heavy_job_lease(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_runtime_one_time_key(TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_runtime_records()
RETURNS TABLE(rate_limits INTEGER, leases INTEGER, claims INTEGER, pdf_sessions INTEGER, jobs INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.runtime_rate_limits WHERE reset_at <= NOW();
  GET DIAGNOSTICS rate_limits = ROW_COUNT;
  DELETE FROM public.runtime_heavy_job_leases WHERE expires_at <= NOW();
  GET DIAGNOSTICS leases = ROW_COUNT;
  DELETE FROM public.runtime_one_time_claims WHERE expires_at <= NOW();
  GET DIAGNOSTICS claims = ROW_COUNT;
  DELETE FROM public.pdf_session_records WHERE expires_at <= NOW();
  GET DIAGNOSTICS pdf_sessions = ROW_COUNT;
  DELETE FROM public.conversion_job_records WHERE expires_at <= NOW();
  GET DIAGNOSTICS jobs = ROW_COUNT;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_runtime_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_runtime_records() TO service_role;
