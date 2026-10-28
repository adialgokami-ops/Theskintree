-- =============================================================================
-- The Skin Tree - Lazy Pending Booking Expiry Migration
-- Migration ID: 20261028_lazy_pending_expiry
-- Target: Supabase PostgreSQL (Postgres 15+)
--
-- Features:
-- 1. Adds cancellation_reason column to booking.bookings
-- 2. booking.calculate_booking_expiry(created_at, slot_date, slot_time):
--    Calculates expiry timestamp as min(clock_start + 2 hours, slot_start - 1 hour).
--    If created outside clinic hours (Mon-Sat 09:00-16:00 IST) or on Sunday,
--    the 2-hour clock starts at 09:00 IST of the next clinic opening day.
-- 3. booking.expire_pending_bookings():
--    Lazily cancels expired pending bookings (setting status = 'cancelled' and
--    cancellation_reason = 'unconfirmed_expired') inside active transactions.
-- 4. Automatically frees slots without changing the one_active_booking_per_slot
--    partial unique index.
-- 5. Integrated into booking.public_get_slots, booking._create_booking_core,
--    and booking.admin_get_slots so expiration is evaluated immediately before
--    slots are calculated or new bookings inserted.
-- =============================================================================

BEGIN;

-- 1. Add cancellation_reason to booking.bookings if not already present
ALTER TABLE booking.bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 2. Pure SQL function to calculate exact booking expiry timestamp
CREATE OR REPLACE FUNCTION booking.calculate_booking_expiry(
  p_created_at timestamptz,
  p_slot_date date,
  p_slot_time time
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created_ist timestamp;
  v_dow int;
  v_time time;
  v_date date;
  v_clock_start_ist timestamp;
  v_clock_expiry timestamptz;
  v_appt_cutoff timestamptz;
BEGIN
  -- Convert created_at to Asia/Kolkata local timestamp
  v_created_ist := p_created_at AT TIME ZONE 'Asia/Kolkata';
  v_dow := pg_catalog.extract(dow from v_created_ist)::int; -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  v_time := v_created_ist::time;
  v_date := v_created_ist::date;

  -- Working hours: Monday to Saturday 09:00 - 16:00 IST (Sunday closed)
  IF v_dow BETWEEN 1 AND 6 AND v_time >= '09:00:00'::time AND v_time < '16:00:00'::time THEN
    -- Created during clinic working hours: clock starts immediately
    v_clock_start_ist := v_created_ist;
  ELSIF v_dow BETWEEN 1 AND 6 AND v_time < '09:00:00'::time THEN
    -- Operating day early morning (before 09:00): starts today at 09:00 IST
    v_clock_start_ist := v_date + '09:00:00'::time;
  ELSIF v_dow BETWEEN 1 AND 5 AND v_time >= '16:00:00'::time THEN
    -- Mon-Fri evening (after 16:00): starts next operating day at 09:00 IST
    v_clock_start_ist := (v_date + interval '1 day')::date + '09:00:00'::time;
  ELSIF v_dow = 6 AND v_time >= '16:00:00'::time THEN
    -- Saturday evening (after 16:00): Sunday closed, starts Monday at 09:00 IST
    v_clock_start_ist := (v_date + interval '2 days')::date + '09:00:00'::time;
  ELSE
    -- Sunday (v_dow = 0): Sunday closed, starts Monday at 09:00 IST
    v_clock_start_ist := (v_date + interval '1 day')::date + '09:00:00'::time;
  END IF;

  -- 2-hour confirmation window from clock start
  v_clock_expiry := (v_clock_start_ist + interval '2 hours') AT TIME ZONE 'Asia/Kolkata';

  -- Appointment start minus 1 hour cutoff
  v_appt_cutoff := ((p_slot_date + p_slot_time) AT TIME ZONE 'Asia/Kolkata') - interval '1 hour';

  -- Booking expires at whichever cutoff arrives earlier
  RETURN LEAST(v_clock_expiry, v_appt_cutoff);
END;
$$;

-- 3. Lazy expiration execution function
CREATE OR REPLACE FUNCTION booking.expire_pending_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    SELECT id
    FROM booking.bookings
    WHERE status = 'pending'
      AND pg_catalog.now() >= booking.calculate_booking_expiry(created_at, slot_date, slot_time)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE booking.bookings b
  SET
    status = 'cancelled',
    cancellation_reason = 'unconfirmed_expired',
    updated_at = pg_catalog.now()
  FROM expired
  WHERE b.id = expired.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4. Update booking._create_booking_core to lazily expire pending bookings first
CREATE OR REPLACE FUNCTION booking._create_booking_core(
  p_name text,
  p_phone text,
  p_email text,
  p_treatment text,
  p_date date,
  p_time time,
  p_source text,
  p_notes text,
  p_idempotency_key text,
  p_reminder_consent boolean,
  p_admin boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_patient_ref uuid;
  v_booking_id uuid;
  v_manage_token text;
  v_settings record;
  v_now_ist timestamp;
  v_today_ist date;
  v_time_ist time;
  v_slot_dt timestamp;
  v_weekday smallint;
  v_existing_id uuid;
  v_existing_token text;
  v_active_count int;
BEGIN
  -- 0. Lazily expire unconfirmed pending bookings inside this transaction
  PERFORM booking.expire_pending_bookings();

  -- Time conversions (IST)
  v_now_ist := pg_catalog.now() AT TIME ZONE 'Asia/Kolkata';
  v_today_ist := v_now_ist::date;
  v_time_ist := v_now_ist::time;
  v_slot_dt := p_date + p_time;

  -- Advance window check (public bookings only)
  IF NOT p_admin THEN
    SELECT * INTO v_settings FROM booking.clinic_settings WHERE id = 1;

    IF v_slot_dt - v_now_ist < (v_settings.min_advance_hours || ' hours')::interval THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TOO_SOON');
    END IF;

    IF p_date > v_today_ist + v_settings.max_advance_days THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TOO_FAR');
    END IF;

    IF p_date < v_today_ist OR (p_date = v_today_ist AND p_time <= v_time_ist) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'PAST_SLOT');
    END IF;
  END IF;

  -- Weekday check (0 = Sunday closed)
  v_weekday := pg_catalog.extract(dow from p_date)::smallint;
  IF NOT EXISTS (
    SELECT 1 FROM booking.weekly_slots
    WHERE weekday = v_weekday AND slot_time = p_time
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OUTSIDE_HOURS');
  END IF;

  -- Check slot blocks
  IF EXISTS (
    SELECT 1 FROM booking.slot_blocks
    WHERE slot_date = p_date AND (slot_time IS NULL OR slot_time = p_time)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SLOT_BLOCKED');
  END IF;

  -- Check existing active booking (pending or confirmed)
  IF EXISTS (
    SELECT 1 FROM booking.bookings
    WHERE slot_date = p_date AND slot_time = p_time
      AND status IN ('pending', 'confirmed')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, manage_token INTO v_existing_id, v_existing_token
    FROM booking.bookings
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'id', v_existing_id, 'manage_token', v_existing_token, 'idempotent', true);
    END IF;
  END IF;

  -- Per-phone active reservation limit (public only)
  IF NOT p_admin THEN
    SELECT count(*) INTO v_active_count
    FROM booking.bookings b
    JOIN booking.contacts c ON b.patient_ref = c.patient_ref
    WHERE c.phone = p_phone AND b.status IN ('pending', 'confirmed');

    IF v_active_count >= v_settings.max_active_per_phone THEN
      RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED');
    END IF;
  END IF;

  -- Upsert contact
  INSERT INTO booking.contacts (
    full_name, phone, email, reminder_consent, consent_updated_at
  )
  VALUES (
    pg_catalog.btrim(p_name), p_phone, pg_catalog.nullif(pg_catalog.btrim(p_email), ''), p_reminder_consent,
    CASE WHEN p_reminder_consent THEN pg_catalog.now() ELSE NULL END
  )
  ON CONFLICT (phone, name_key) DO UPDATE
  SET
    email = pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(EXCLUDED.email), ''), booking.contacts.email),
    reminder_consent = CASE
      WHEN EXCLUDED.reminder_consent THEN true
      ELSE booking.contacts.reminder_consent
    END,
    consent_updated_at = CASE
      WHEN EXCLUDED.reminder_consent AND NOT booking.contacts.reminder_consent THEN pg_catalog.now()
      ELSE booking.contacts.consent_updated_at
    END,
    updated_at = pg_catalog.now()
  RETURNING patient_ref INTO v_patient_ref;

  -- Insert booking (public bookings insert as 'pending', admin as 'confirmed')
  INSERT INTO booking.bookings (
    patient_ref, treatment, slot_date, slot_time, status,
    source, notes, idempotency_key, consent_at
  )
  VALUES (
    v_patient_ref, pg_catalog.btrim(p_treatment), p_date, p_time,
    CASE WHEN p_admin THEN 'confirmed' ELSE 'pending' END,
    p_source, pg_catalog.nullif(pg_catalog.btrim(p_notes), ''), p_idempotency_key,
    CASE WHEN p_reminder_consent THEN pg_catalog.now() ELSE NULL END
  )
  RETURNING id, manage_token INTO v_booking_id, v_manage_token;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_booking_id,
    'manage_token', v_manage_token
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
END;
$$;

-- 5. Update booking.public_get_slots to lazily expire pending bookings first
CREATE OR REPLACE FUNCTION booking.public_get_slots(
  p_from date,
  p_days int
)
RETURNS TABLE (
  slot_date date,
  slot_time time,
  available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings record;
  v_now_ist timestamp;
  v_today_ist date;
  v_time_ist time;
  v_max_days int;
BEGIN
  -- 0. Lazily expire unconfirmed pending bookings inside this transaction
  PERFORM booking.expire_pending_bookings();

  v_now_ist := pg_catalog.now() AT TIME ZONE 'Asia/Kolkata';
  v_today_ist := v_now_ist::date;
  v_time_ist := v_now_ist::time;

  SELECT * INTO v_settings FROM booking.clinic_settings WHERE id = 1;
  v_max_days := pg_catalog.least(pg_catalog.coalesce(p_days, 14), 30);

  RETURN QUERY
  WITH dates AS (
    SELECT (p_from + i)::date AS d,
           pg_catalog.extract(dow from (p_from + i))::smallint AS dow
    FROM pg_catalog.generate_series(0, v_max_days - 1) i
  ),
  grid AS (
    SELECT dates.d AS s_date, ws.slot_time AS s_time
    FROM dates
    JOIN booking.weekly_slots ws ON ws.weekday = dates.dow
  )
  SELECT
    grid.s_date AS slot_date,
    grid.s_time AS slot_time,
    (
      -- Not blocked
      NOT EXISTS (
        SELECT 1 FROM booking.slot_blocks sb
        WHERE sb.slot_date = grid.s_date AND (sb.slot_time IS NULL OR sb.slot_time = grid.s_time)
      )
      -- Not booked (active pending or confirmed)
      AND NOT EXISTS (
        SELECT 1 FROM booking.bookings b
        WHERE b.slot_date = grid.s_date AND b.slot_time = grid.s_time
          AND b.status IN ('pending', 'confirmed')
      )
      -- Within booking advance window
      AND (grid.s_date + grid.s_time) - v_now_ist >= (v_settings.min_advance_hours || ' hours')::interval
      AND grid.s_date <= v_today_ist + v_settings.max_advance_days
      AND (grid.s_date > v_today_ist OR (grid.s_date = v_today_ist AND grid.s_time > v_time_ist))
    )::boolean AS available
  FROM grid
  ORDER BY grid.s_date, grid.s_time;
END;
$$;

-- 6. Update booking.admin_get_slots to lazily expire pending bookings first
CREATE OR REPLACE FUNCTION booking.admin_get_slots(
  p_from date,
  p_days int
)
RETURNS TABLE (
  slot_date date,
  slot_time time,
  state text,
  booking_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now_ist timestamp;
  v_today_ist date;
  v_time_ist time;
  v_max_days int;
BEGIN
  -- 0. Lazily expire unconfirmed pending bookings inside this transaction
  PERFORM booking.expire_pending_bookings();

  v_now_ist := pg_catalog.now() AT TIME ZONE 'Asia/Kolkata';
  v_today_ist := v_now_ist::date;
  v_time_ist := v_now_ist::time;
  v_max_days := pg_catalog.least(pg_catalog.coalesce(p_days, 7), 30);

  RETURN QUERY
  WITH dates AS (
    SELECT (p_from + i)::date AS d,
           pg_catalog.extract(dow from (p_from + i))::smallint AS dow
    FROM pg_catalog.generate_series(0, v_max_days - 1) i
  ),
  grid AS (
    SELECT dates.d AS s_date, ws.slot_time AS s_time
    FROM dates
    JOIN booking.weekly_slots ws ON ws.weekday = dates.dow
  )
  SELECT
    grid.s_date AS slot_date,
    grid.s_time AS slot_time,
    CASE
      -- Past slot
      WHEN grid.s_date < v_today_ist OR (grid.s_date = v_today_ist AND grid.s_time <= v_time_ist) THEN 'past'
      -- Blocked
      WHEN EXISTS (
        SELECT 1 FROM booking.slot_blocks sb
        WHERE sb.slot_date = grid.s_date AND (sb.slot_time IS NULL OR sb.slot_time = grid.s_time)
      ) THEN 'blocked'
      -- Booked
      WHEN EXISTS (
        SELECT 1 FROM booking.bookings b
        WHERE b.slot_date = grid.s_date AND b.slot_time = grid.s_time
          AND b.status IN ('pending', 'confirmed')
      ) THEN 'booked'
      -- Available
      ELSE 'available'
    END AS state,
    (
      SELECT b.id FROM booking.bookings b
      WHERE b.slot_date = grid.s_date AND b.slot_time = grid.s_time
        AND b.status IN ('pending', 'confirmed')
      LIMIT 1
    ) AS booking_id
  FROM grid
  ORDER BY grid.s_date, grid.s_time;
END;
$$;

-- 7. Grant least-privilege execute permissions
REVOKE ALL ON FUNCTION booking.calculate_booking_expiry(timestamptz, date, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION booking.calculate_booking_expiry(timestamptz, date, time) TO web_api, admin_booking, admin_clinical;

REVOKE ALL ON FUNCTION booking.expire_pending_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION booking.expire_pending_bookings() TO web_api, admin_booking, admin_clinical;

COMMIT;
