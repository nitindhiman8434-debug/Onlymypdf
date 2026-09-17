-- Phase 1 dependable-beta conversion evidence and cleanup monitoring.
-- All tables are service-role only. No file names, file contents, IPs, or owner
-- identifiers are stored in conversion_events.

CREATE TABLE IF NOT EXISTS public.conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  engine TEXT,
  input_bytes BIGINT,
  output_bytes BIGINT,
  queue_time_ms INTEGER,
  processing_time_ms INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  output_valid BOOLEAN,
  validation JSONB,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversion_events_created
  ON public.conversion_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_events_tool_created
  ON public.conversion_events (tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_events_status_created
  ON public.conversion_events (status, created_at DESC);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny client access to conversion_events" ON public.conversion_events;
CREATE POLICY "Deny client access to conversion_events"
  ON public.conversion_events FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.cleanup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  files_deleted INTEGER NOT NULL DEFAULT 0,
  files_failed INTEGER NOT NULL DEFAULT 0,
  temp_sessions_deleted INTEGER NOT NULL DEFAULT 0,
  temp_sessions_failed INTEGER NOT NULL DEFAULT 0,
  conversion_jobs_deleted INTEGER NOT NULL DEFAULT 0,
  conversion_jobs_failed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_code TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cleanup_runs_started
  ON public.cleanup_runs (started_at DESC);

ALTER TABLE public.cleanup_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny client access to cleanup_runs" ON public.cleanup_runs;
CREATE POLICY "Deny client access to cleanup_runs"
  ON public.cleanup_runs FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.tool_jobs
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queue_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_validation JSONB,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

-- Signed API downloads are the only supported access path.
UPDATE storage.buckets SET public = false WHERE id = 'pdf-files';
