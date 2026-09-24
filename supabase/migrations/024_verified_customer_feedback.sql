-- Verified customer feedback is linked to a completed conversion owned by the user.
-- Nothing is published automatically; staff review and explicit publication consent are required.
CREATE TABLE IF NOT EXISTS public.customer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_job_id UUID NOT NULL REFERENCES public.tool_jobs(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  accuracy_rating SMALLINT NOT NULL CHECK (accuracy_rating BETWEEN 1 AND 5),
  speed_rating SMALLINT NOT NULL CHECK (speed_rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 20 AND 2000),
  publish_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tool_job_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_user_created
  ON public.customer_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_moderation
  ON public.customer_feedback(status, publish_consent, created_at DESC);

ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own customer feedback" ON public.customer_feedback;
CREATE POLICY "Users can view own customer feedback"
  ON public.customer_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can submit verified customer feedback" ON public.customer_feedback;
CREATE POLICY "Users can submit verified customer feedback"
  ON public.customer_feedback
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.tool_jobs job
      WHERE job.id = tool_job_id
        AND job.user_id = auth.uid()
        AND job.status = 'completed'
    )
  );

-- Feedback is created through the authenticated server API so clients cannot
-- spoof moderation state or rewrite a reviewed submission directly.
REVOKE INSERT, UPDATE ON public.customer_feedback FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can withdraw own customer feedback" ON public.customer_feedback;
CREATE POLICY "Users can withdraw own customer feedback"
  ON public.customer_feedback
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.customer_feedback IS
  'Consented feedback tied to a completed owned conversion. Publication requires publish_consent and staff moderation.';
