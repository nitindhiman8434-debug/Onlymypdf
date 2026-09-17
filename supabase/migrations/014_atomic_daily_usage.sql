-- Atomic daily usage reservation (prevents TOCTOU limit bypass).

CREATE TABLE IF NOT EXISTS public.daily_usage_counters (
  usage_key TEXT PRIMARY KEY,
  usage_date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.reserve_daily_usage_slot(
  p_key TEXT,
  p_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;
  v_count INTEGER;
BEGIN
  IF p_limit < 0 THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', -1, 'limit', -1);
  END IF;

  INSERT INTO public.daily_usage_counters AS d (usage_key, usage_date, count)
  VALUES (p_key, v_today, 1)
  ON CONFLICT (usage_key) DO UPDATE
  SET
    count = CASE
      WHEN d.usage_date = v_today THEN d.count + 1
      ELSE 1
    END,
    usage_date = v_today
  RETURNING count INTO v_count;

  IF v_count > p_limit THEN
    UPDATE public.daily_usage_counters
    SET count = GREATEST(0, count - 1)
    WHERE usage_key = p_key AND usage_date = v_today;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'limit', p_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(0, p_limit - v_count),
    'limit', p_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_organization_daily_usage(
  p_org_id UUID,
  p_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;
  v_count INTEGER;
  v_updated INTEGER;
BEGIN
  IF p_limit < 0 THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', -1, 'limit', -1);
  END IF;

  UPDATE public.organizations AS o
  SET
    daily_usage_count = CASE
      WHEN o.daily_usage_date = v_today THEN o.daily_usage_count + 1
      ELSE 1
    END,
    daily_usage_date = v_today,
    updated_at = NOW()
  WHERE o.id = p_org_id
    AND (
      CASE
        WHEN o.daily_usage_date = v_today THEN o.daily_usage_count
        ELSE 0
      END
    ) < p_limit
  RETURNING daily_usage_count INTO v_count;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    SELECT
      CASE
        WHEN daily_usage_date = v_today THEN daily_usage_count
        ELSE 0
      END
    INTO v_count
    FROM public.organizations
    WHERE id = p_org_id;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'limit', p_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(0, p_limit - v_count),
    'limit', p_limit
  );
END;
$$;
