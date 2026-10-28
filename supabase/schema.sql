-- =============================================================================
-- The Skin Tree: Single Database Architecture with Strict Schema Separation
-- Schemas:
--   1. booking  - Scheduling, Slots, Contacts, Staff, Audit Log
--   2. clinical - Highly Confidential Patient Charts, Consultations, Medications
-- =============================================================================

-- Ensure pgcrypto extension exists in extensions schema
create extension if not exists pgcrypto with schema extensions;

-- Create dedicated schemas
create schema if not exists booking;
create schema if not exists clinical;

-- -----------------------------------------------------------------------------
-- Step 2: Define Three Distinct Database Roles
-- (Passwords are set separately via alter role <name> password '...';)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select from pg_roles where rolname = 'web_api') then
    create role web_api noinherit login;
  end if;
  if not exists (select from pg_roles where rolname = 'admin_booking') then
    create role admin_booking noinherit login;
  end if;
  if not exists (select from pg_roles where rolname = 'admin_clinical') then
    create role admin_clinical noinherit login;
  end if;
end $$;

-- Revoke all default privileges from public, anon, and authenticated
revoke all on schema booking from public, anon, authenticated;
revoke all on schema clinical from public, anon, authenticated;

alter default privileges in schema booking revoke all on tables from public, anon, authenticated;
alter default privileges in schema booking revoke all on functions from public, anon, authenticated;
alter default privileges in schema booking revoke all on sequences from public, anon, authenticated;

alter default privileges in schema clinical revoke all on tables from public, anon, authenticated;
alter default privileges in schema clinical revoke all on functions from public, anon, authenticated;
alter default privileges in schema clinical revoke all on sequences from public, anon, authenticated;

-- Common updated_at trigger function
create or replace function booking.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function clinical.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =============================================================================
-- SCHEMA: booking
-- =============================================================================

create table if not exists booking.clinic_settings (
  id int primary key default 1 check (id = 1),
  min_advance_hours int not null default 12,
  max_advance_days int not null default 60,
  max_active_per_phone int not null default 2
);
insert into booking.clinic_settings (id, min_advance_hours, max_advance_days, max_active_per_phone)
values (1, 12, 60, 2)
on conflict (id) do nothing;

create table if not exists booking.weekly_slots (
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  slot_time time not null,
  primary key (weekday, slot_time)
);
-- Mon to Sat: 6 slots per day (Sunday closed)
insert into booking.weekly_slots (weekday, slot_time)
select d, t::time
from generate_series(1, 6) d,
  unnest(array['09:00','10:00','11:30','13:00','14:30','16:00']) t
on conflict do nothing;

create table if not exists booking.contacts (
  patient_ref uuid primary key default extensions.gen_random_uuid(),
  full_name text not null,
  name_key text generated always as (lower(btrim(full_name))) stored,
  phone text not null check (phone ~ '^\+[0-9]{10,15}$'),
  email text,
  reminder_consent boolean not null default false,
  consent_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone, name_key)
);

create trigger trg_booking_contacts_updated_at
  before update on booking.contacts
  for each row execute function booking.set_updated_at();

create table if not exists booking.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  patient_ref uuid not null references booking.contacts(patient_ref) on delete restrict,
  treatment text not null,
  slot_date date not null,
  slot_time time not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled','completed','no_show')),
  source text not null check (source in ('website_form','ai_chat','admin_manual')),
  notes text,
  staff_notes text,
  manage_token text not null unique default encode(extensions.gen_random_bytes(24),'hex'),
  idempotency_key text unique,
  consent_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Concurrency race-condition double booking guard
create unique index if not exists one_active_booking_per_slot
  on booking.bookings (slot_date, slot_time) where status in ('pending','confirmed');
create index if not exists bookings_date_status_idx on booking.bookings (slot_date, status);
create index if not exists bookings_patient_idx on booking.bookings (patient_ref);

create trigger trg_booking_bookings_updated_at
  before update on booking.bookings
  for each row execute function booking.set_updated_at();

create table if not exists booking.slot_blocks (
  id uuid primary key default extensions.gen_random_uuid(),
  slot_date date not null,
  slot_time time, -- null = whole day
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists slot_blocks_date_idx on booking.slot_blocks (slot_date);

create table if not exists booking.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin','doctor','reception')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists booking.audit_log (
  id bigint generated always as identity primary key,
  staff_id uuid,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on booking.audit_log (created_at desc);

-- =============================================================================
-- SCHEMA: clinical
-- =============================================================================

create table if not exists clinical.clinical_patients (
  patient_ref uuid primary key references booking.contacts(patient_ref) on delete restrict,
  skin_type text,
  allergies text,
  medical_history text,
  emergency_contact text,
  notes text,
  date_of_birth date,
  gender text default 'unspecified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_clinical_patients_updated_at
  before update on clinical.clinical_patients
  for each row execute function clinical.set_updated_at();

create table if not exists clinical.consultations (
  id uuid primary key default extensions.gen_random_uuid(),
  patient_ref uuid not null references clinical.clinical_patients(patient_ref) on delete cascade,
  doctor_id uuid,
  consultation_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  chief_complaint text not null,
  examination_findings text,
  diagnosis text,
  clinical_notes text,
  plan text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consultations_patient_idx on clinical.consultations (patient_ref);
create index if not exists consultations_follow_up_idx on clinical.consultations (follow_up_date);

create trigger trg_clinical_consultations_updated_at
  before update on clinical.consultations
  for each row execute function clinical.set_updated_at();

create table if not exists clinical.medications (
  id uuid primary key default extensions.gen_random_uuid(),
  patient_ref uuid not null references clinical.clinical_patients(patient_ref) on delete cascade,
  consultation_id uuid references clinical.consultations(id) on delete set null,
  prescribed_by uuid,
  name text not null,
  dosage text not null,
  frequency text not null,
  duration_days int,
  instructions text,
  start_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  status text not null default 'active'
    check (status in ('active','completed','discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists medications_patient_idx on clinical.medications (patient_ref);
create index if not exists medications_status_idx on clinical.medications (status);

create trigger trg_clinical_medications_updated_at
  before update on clinical.medications
  for each row execute function clinical.set_updated_at();

create table if not exists clinical.reminder_log (
  id uuid primary key default extensions.gen_random_uuid(),
  patient_ref uuid not null references clinical.clinical_patients(patient_ref) on delete cascade,
  channel text not null check (channel in ('whatsapp','email','sms')),
  reminder_type text not null check (reminder_type in ('appointment','followup','medication')),
  template_name text,
  status text not null default 'sent' check (status in ('sent','delivered','failed')),
  payload jsonb,
  sent_at timestamptz not null default now()
);

create table if not exists clinical.access_log (
  id bigint generated always as identity primary key,
  staff_id uuid,
  staff_role text not null,
  patient_ref uuid not null,
  action text not null,
  resource text not null,
  metadata jsonb,
  accessed_at timestamptz not null default now()
);
create index if not exists access_log_patient_idx on clinical.access_log (patient_ref);

-- =============================================================================
-- Row Level Security (RLS) Configuration
-- =============================================================================

alter table booking.clinic_settings enable row level security;
alter table booking.weekly_slots enable row level security;
alter table booking.contacts enable row level security;
alter table booking.bookings enable row level security;
alter table booking.slot_blocks enable row level security;
alter table booking.staff enable row level security;
alter table booking.audit_log enable row level security;

alter table clinical.clinical_patients enable row level security;
alter table clinical.consultations enable row level security;
alter table clinical.medications enable row level security;
alter table clinical.reminder_log enable row level security;
alter table clinical.access_log enable row level security;

-- Policies on booking schema:
-- admin_booking has full DML (subject to SQL privilege constraints)
-- admin_clinical has SELECT-only
drop policy if exists admin_booking_clinic_settings on booking.clinic_settings;
create policy admin_booking_clinic_settings on booking.clinic_settings for all to admin_booking using (true) with check (true);
create policy admin_clinical_clinic_settings on booking.clinic_settings for select to admin_clinical using (true);

drop policy if exists admin_booking_weekly_slots on booking.weekly_slots;
create policy admin_booking_weekly_slots on booking.weekly_slots for all to admin_booking using (true) with check (true);
create policy admin_clinical_weekly_slots on booking.weekly_slots for select to admin_clinical using (true);

drop policy if exists admin_booking_contacts on booking.contacts;
create policy admin_booking_contacts on booking.contacts for all to admin_booking using (true) with check (true);
create policy admin_clinical_contacts on booking.contacts for select to admin_clinical using (true);

drop policy if exists admin_booking_bookings on booking.bookings;
create policy admin_booking_bookings on booking.bookings for all to admin_booking using (true) with check (true);
create policy admin_clinical_bookings on booking.bookings for select to admin_clinical using (true);

drop policy if exists admin_booking_slot_blocks on booking.slot_blocks;
create policy admin_booking_slot_blocks on booking.slot_blocks for all to admin_booking using (true) with check (true);
create policy admin_clinical_slot_blocks on booking.slot_blocks for select to admin_clinical using (true);

drop policy if exists admin_booking_staff on booking.staff;
create policy admin_booking_staff on booking.staff for all to admin_booking using (true) with check (true);
create policy admin_clinical_staff on booking.staff for select to admin_clinical using (true);

drop policy if exists admin_booking_audit_log on booking.audit_log;
create policy admin_booking_audit_log on booking.audit_log for all to admin_booking using (true) with check (true);
create policy admin_clinical_audit_log on booking.audit_log for select to admin_clinical using (true);

-- Policies on clinical schema:
-- ONLY admin_clinical has access
drop policy if exists admin_clinical_patients_policy on clinical.clinical_patients;
create policy admin_clinical_patients_policy on clinical.clinical_patients for all to admin_clinical using (true) with check (true);

drop policy if exists admin_clinical_consultations_policy on clinical.consultations;
create policy admin_clinical_consultations_policy on clinical.consultations for all to admin_clinical using (true) with check (true);

drop policy if exists admin_clinical_medications_policy on clinical.medications;
create policy admin_clinical_medications_policy on clinical.medications for all to admin_clinical using (true) with check (true);

drop policy if exists admin_clinical_reminder_log_policy on clinical.reminder_log;
create policy admin_clinical_reminder_log_policy on clinical.reminder_log for all to admin_clinical using (true) with check (true);

drop policy if exists admin_clinical_access_log_policy on clinical.access_log;
create policy admin_clinical_access_log_policy on clinical.access_log for all to admin_clinical using (true) with check (true);

-- =============================================================================
-- FUNCTIONS (SECURITY DEFINER, fully qualified, search_path = '')
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Internal Core Booking Logic (_create_booking_core)
-- Granted to NOBODY. Only called internally by public/admin wrappers.
-- -----------------------------------------------------------------------------
create or replace function booking._create_booking_core(
  p_name text,
  p_phone text,
  p_email text,
  p_treatment text,
  p_date date,
  p_time time,
  p_notes text,
  p_source text,
  p_idempotency_key text,
  p_reminder_consent boolean,
  p_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings record;
  v_now_ist timestamp;
  v_today_ist date;
  v_time_ist time;
  v_slot_dt timestamp;
  v_weekday smallint;
  v_patient_ref uuid;
  v_booking_id uuid;
  v_manage_token text;
  v_existing_id uuid;
  v_existing_token text;
  v_active_count int;
begin
  -- Concurrency serialized per phone number
  perform pg_advisory_xact_lock(hashtext(p_phone));

  -- Time evaluation strictly in Asia/Kolkata
  v_now_ist := now() at time zone 'Asia/Kolkata';
  v_today_ist := v_now_ist::date;
  v_time_ist := v_now_ist::time;
  v_slot_dt := (p_date + p_time);

  select * into v_settings from booking.clinic_settings where id = 1;

  -- Validation: lead times and horizons (applies to public bookings)
  if not p_admin then
    if v_slot_dt - v_now_ist < (v_settings.min_advance_hours || ' hours')::interval then
      return jsonb_build_object('ok', false, 'code', 'TOO_SOON');
    end if;

    if p_date > v_today_ist + v_settings.max_advance_days then
      return jsonb_build_object('ok', false, 'code', 'TOO_FAR');
    end if;

    if p_date < v_today_ist or (p_date = v_today_ist and p_time <= v_time_ist) then
      return jsonb_build_object('ok', false, 'code', 'PAST_SLOT');
    end if;
  end if;

  -- Weekday check (0 = Sunday)
  v_weekday := extract(dow from p_date)::smallint;
  if not exists (
    select 1 from booking.weekly_slots
    where weekday = v_weekday and slot_time = p_time
  ) then
    return jsonb_build_object('ok', false, 'code', 'OUTSIDE_HOURS');
  end if;

  -- Check slot blocks
  if exists (
    select 1 from booking.slot_blocks
    where slot_date = p_date and (slot_time is null or slot_time = p_time)
  ) then
    return jsonb_build_object('ok', false, 'code', 'SLOT_BLOCKED');
  end if;

  -- Check existing active booking
  if exists (
    select 1 from booking.bookings
    where slot_date = p_date and slot_time = p_time
      and status in ('pending', 'confirmed')
  ) then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
  end if;

  -- Idempotency check
  if p_idempotency_key is not null then
    select id, manage_token into v_existing_id, v_existing_token
    from booking.bookings
    where idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object('ok', true, 'id', v_existing_id, 'manage_token', v_existing_token, 'idempotent', true);
    end if;
  end if;

  -- Per-phone active reservation limit (public only)
  if not p_admin then
    select count(*) into v_active_count
    from booking.bookings b
    join booking.contacts c on b.patient_ref = c.patient_ref
    where c.phone = p_phone and b.status in ('pending', 'confirmed');

    if v_active_count >= v_settings.max_active_per_phone then
      return jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED');
    end if;
  end if;

  -- Upsert contact
  insert into booking.contacts (
    full_name, phone, email, reminder_consent, consent_updated_at
  )
  values (
    btrim(p_name), p_phone, nullif(btrim(p_email), ''), p_reminder_consent,
    case when p_reminder_consent then now() else null end
  )
  on conflict (phone, name_key) do update
  set
    email = coalesce(nullif(btrim(excluded.email), ''), booking.contacts.email),
    reminder_consent = case
      when excluded.reminder_consent then true
      else booking.contacts.reminder_consent
    end,
    consent_updated_at = case
      when excluded.reminder_consent and not booking.contacts.reminder_consent then now()
      else booking.contacts.consent_updated_at
    end,
    updated_at = now()
  returning patient_ref into v_patient_ref;

  -- Insert booking
  insert into booking.bookings (
    patient_ref, treatment, slot_date, slot_time, status,
    source, notes, idempotency_key, consent_at
  )
  values (
    v_patient_ref, btrim(p_treatment), p_date, p_time,
    case when p_admin then 'confirmed' else 'pending' end,
    p_source, nullif(btrim(p_notes), ''), p_idempotency_key,
    case when p_reminder_consent then now() else null end
  )
  returning id, manage_token into v_booking_id, v_manage_token;

  return jsonb_build_object(
    'ok', true,
    'id', v_booking_id,
    'manage_token', v_manage_token
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
end;
$$;

revoke all on function booking._create_booking_core(text, text, text, text, date, time, text, text, text, boolean, boolean) from public, anon, authenticated, web_api, admin_booking, admin_clinical;

-- -----------------------------------------------------------------------------
-- 2. PUBLIC FUNCTIONS (Granted to web_api ONLY)
-- -----------------------------------------------------------------------------

-- public_get_slots: Returns available boolean only. NEVER reveals reason.
create or replace function booking.public_get_slots(
  p_from date,
  p_days int
)
returns table(
  slot_date date,
  slot_time time,
  available boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings record;
  v_now_ist timestamp;
  v_today_ist date;
  v_time_ist time;
  v_max_days int;
begin
  v_now_ist := now() at time zone 'Asia/Kolkata';
  v_today_ist := v_now_ist::date;
  v_time_ist := v_now_ist::time;

  select * into v_settings from booking.clinic_settings where id = 1;
  v_max_days := least(coalesce(p_days, 14), 30);

  return query
  with dates as (
    select (p_from + i)::date as d,
           extract(dow from (p_from + i))::smallint as dow
    from generate_series(0, v_max_days - 1) i
  ),
  grid as (
    select dates.d as s_date, ws.slot_time as s_time
    from dates
    join booking.weekly_slots ws on ws.weekday = dates.dow
  )
  select
    grid.s_date as slot_date,
    grid.s_time as slot_time,
    (
      -- Not blocked
      not exists (
        select 1 from booking.slot_blocks sb
        where sb.slot_date = grid.s_date and (sb.slot_time is null or sb.slot_time = grid.s_time)
      )
      -- Not booked
      and not exists (
        select 1 from booking.bookings b
        where b.slot_date = grid.s_date and b.slot_time = grid.s_time
          and b.status in ('pending', 'confirmed')
      )
      -- Within booking advance window
      and (grid.s_date + grid.s_time) - v_now_ist >= (v_settings.min_advance_hours || ' hours')::interval
      and grid.s_date <= v_today_ist + v_settings.max_advance_days
      and (grid.s_date > v_today_ist or (grid.s_date = v_today_ist and grid.s_time > v_time_ist))
    )::boolean as available
  from grid
  order by grid.s_date, grid.s_time;
end;
$$;

-- public_create_booking: NO admin flag, restricts source, calls core with p_admin=false
create or replace function booking.public_create_booking(
  p_name text,
  p_phone text,
  p_email text,
  p_treatment text,
  p_date date,
  p_time time,
  p_source text,
  p_notes text default null,
  p_consent boolean default false,
  p_idem text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_source not in ('website_form', 'ai_chat') then
    raise exception 'Invalid source: %', p_source;
  end if;

  return booking._create_booking_core(
    p_name => p_name,
    p_phone => p_phone,
    p_email => p_email,
    p_treatment => p_treatment,
    p_date => p_date,
    p_time => p_time,
    p_notes => p_notes,
    p_source => p_source,
    p_idempotency_key => p_idem,
    p_reminder_consent => coalesce(p_consent, false),
    p_admin => false
  );
end;
$$;

-- public_manage_get: Returns first_name, treatment, slot_date, slot_time, status ONLY.
create or replace function booking.public_manage_get(
  p_token text
)
returns table(
  first_name text,
  treatment text,
  slot_date date,
  slot_time time,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    split_part(c.full_name, ' ', 1) as first_name,
    b.treatment,
    b.slot_date,
    b.slot_time,
    b.status
  from booking.bookings b
  join booking.contacts c on b.patient_ref = c.patient_ref
  where b.manage_token = p_token;
end;
$$;

-- public_manage_cancel: Cancels appointment via token
create or replace function booking.public_manage_cancel(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
begin
  select id into v_booking_id
  from booking.bookings
  where manage_token = p_token and status in ('pending', 'confirmed');

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  update booking.bookings
  set status = 'cancelled', updated_at = now()
  where id = v_booking_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- public_manage_reschedule: Reschedules with 2-hour cutoff rule
create or replace function booking.public_manage_reschedule(
  p_token text,
  p_new_date date,
  p_new_time time
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_settings record;
  v_now_ist timestamp;
  v_today_ist date;
  v_time_ist time;
  v_cur_slot_dt timestamp;
  v_new_slot_dt timestamp;
  v_weekday smallint;
begin
  select * into v_booking
  from booking.bookings
  where manage_token = p_token and status in ('pending', 'confirmed');

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_now_ist := now() at time zone 'Asia/Kolkata';
  v_today_ist := v_now_ist::date;
  v_time_ist := v_now_ist::time;
  v_cur_slot_dt := (v_booking.slot_date + v_booking.slot_time);
  v_new_slot_dt := (p_new_date + p_new_time);

  -- 2-hour cutoff rule: cannot reschedule within 2 hours of current slot
  if v_cur_slot_dt - v_now_ist < interval '2 hours' then
    return jsonb_build_object('ok', false, 'code', 'TOO_LATE');
  end if;

  select * into v_settings from booking.clinic_settings where id = 1;

  if v_new_slot_dt - v_now_ist < (v_settings.min_advance_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'code', 'TOO_SOON');
  end if;

  if p_new_date > v_today_ist + v_settings.max_advance_days then
    return jsonb_build_object('ok', false, 'code', 'TOO_FAR');
  end if;

  if p_new_date < v_today_ist or (p_new_date = v_today_ist and p_new_time <= v_time_ist) then
    return jsonb_build_object('ok', false, 'code', 'PAST_SLOT');
  end if;

  v_weekday := extract(dow from p_new_date)::smallint;
  if not exists (
    select 1 from booking.weekly_slots
    where weekday = v_weekday and slot_time = p_new_time
  ) then
    return jsonb_build_object('ok', false, 'code', 'OUTSIDE_HOURS');
  end if;

  if exists (
    select 1 from booking.slot_blocks
    where slot_date = p_new_date and (slot_time is null or slot_time = p_new_time)
  ) then
    return jsonb_build_object('ok', false, 'code', 'SLOT_BLOCKED');
  end if;

  if exists (
    select 1 from booking.bookings
    where slot_date = p_new_date and slot_time = p_new_time
      and status in ('pending', 'confirmed')
      and id <> v_booking.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
  end if;

  update booking.bookings
  set slot_date = p_new_date, slot_time = p_new_time, updated_at = now()
  where id = v_booking.id;

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. ADMIN FUNCTIONS (Granted to admin_booking, and admin_clinical where needed)
-- -----------------------------------------------------------------------------

-- admin_get_slots: Full operational state (available, booked, blocked, past, plus booking id)
create or replace function booking.admin_get_slots(
  p_from date,
  p_days int
)
returns table(
  slot_date date,
  slot_time time,
  state text,
  booking_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now_ist timestamp;
  v_max_days int;
begin
  v_now_ist := now() at time zone 'Asia/Kolkata';
  v_max_days := least(coalesce(p_days, 7), 30);

  return query
  with dates as (
    select (p_from + i)::date as d,
           extract(dow from (p_from + i))::smallint as dow
    from generate_series(0, v_max_days - 1) i
  ),
  grid as (
    select dates.d as s_date, ws.slot_time as s_time
    from dates
    join booking.weekly_slots ws on ws.weekday = dates.dow
  )
  select
    grid.s_date as slot_date,
    grid.s_time as slot_time,
    case
      when b.id is not null then 'booked'
      when sb.id is not null then 'blocked'
      when (grid.s_date + grid.s_time) < v_now_ist then 'past'
      else 'available'
    end as state,
    b.id as booking_id
  from grid
  left join booking.bookings b
    on b.slot_date = grid.s_date and b.slot_time = grid.s_time
   and b.status in ('pending', 'confirmed')
  left join booking.slot_blocks sb
    on sb.slot_date = grid.s_date and (sb.slot_time is null or sb.slot_time = grid.s_time)
  order by grid.s_date, grid.s_time;
end;
$$;

-- admin_create_booking: Calls core with p_admin = true
create or replace function booking.admin_create_booking(
  p_name text,
  p_phone text,
  p_email text,
  p_treatment text,
  p_date date,
  p_time time,
  p_notes text default null,
  p_staff_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
  v_booking_id uuid;
begin
  v_res := booking._create_booking_core(
    p_name => p_name,
    p_phone => p_phone,
    p_email => p_email,
    p_treatment => p_treatment,
    p_date => p_date,
    p_time => p_time,
    p_notes => p_notes,
    p_source => 'admin_manual',
    p_idempotency_key => null,
    p_reminder_consent => false,
    p_admin => true
  );

  if (v_res->>'ok')::boolean and p_staff_notes is not null then
    v_booking_id := (v_res->>'id')::uuid;
    update booking.bookings set staff_notes = p_staff_notes where id = v_booking_id;
  end if;

  return v_res;
end;
$$;

-- admin_reschedule_booking: Overrides 2-hour restriction for staff
create or replace function booking.admin_reschedule_booking(
  p_booking_id uuid,
  p_new_date date,
  p_new_time time
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_weekday smallint;
begin
  if not exists (select 1 from booking.bookings where id = p_booking_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_weekday := extract(dow from p_new_date)::smallint;
  if not exists (
    select 1 from booking.weekly_slots
    where weekday = v_weekday and slot_time = p_new_time
  ) then
    return jsonb_build_object('ok', false, 'code', 'OUTSIDE_HOURS');
  end if;

  if exists (
    select 1 from booking.slot_blocks
    where slot_date = p_new_date and (slot_time is null or slot_time = p_new_time)
  ) then
    return jsonb_build_object('ok', false, 'code', 'SLOT_BLOCKED');
  end if;

  if exists (
    select 1 from booking.bookings
    where slot_date = p_new_date and slot_time = p_new_time
      and status in ('pending', 'confirmed')
      and id <> p_booking_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
  end if;

  update booking.bookings
  set slot_date = p_new_date, slot_time = p_new_time, updated_at = now()
  where id = p_booking_id;

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
end;
$$;

-- admin_cancel_booking
create or replace function booking.admin_cancel_booking(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from booking.bookings where id = p_booking_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  update booking.bookings
  set status = 'cancelled', updated_at = now()
  where id = p_booking_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- =============================================================================
-- ROLE PRIVILEGES ASSIGNMENT
-- =============================================================================

-- Revoke all function execution from public, anon, authenticated across both schemas
revoke execute on all functions in schema booking from public, anon, authenticated;
revoke execute on all functions in schema clinical from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- web_api privileges:
-- USAGE on schema booking. NO privileges on any table.
-- EXECUTE ONLY on the 5 public functions. NO access to clinical schema.
-- -----------------------------------------------------------------------------
grant usage on schema booking to web_api;

grant execute on function booking.public_get_slots(date, int) to web_api;
grant execute on function booking.public_create_booking(text, text, text, text, date, time, text, text, boolean, text) to web_api;
grant execute on function booking.public_manage_get(text) to web_api;
grant execute on function booking.public_manage_cancel(text) to web_api;
grant execute on function booking.public_manage_reschedule(text, date, time) to web_api;

-- Explicitly revoke table privileges from web_api (defense in depth)
revoke all on all tables in schema booking from web_api;
revoke all on all tables in schema clinical from web_api;
revoke usage on schema clinical from web_api;

-- -----------------------------------------------------------------------------
-- admin_booking privileges:
-- USAGE on schema booking.
-- DML on booking tables except: NO DELETE on bookings or contacts.
-- audit_log is INSERT+SELECT only (append-only).
-- EXECUTE on admin_* functions. NO USAGE on schema clinical.
-- -----------------------------------------------------------------------------
grant usage on schema booking to admin_booking;

grant select, insert, update on booking.clinic_settings to admin_booking;
grant select, insert, update, delete on booking.weekly_slots to admin_booking;
grant select, insert, update on booking.contacts to admin_booking;
grant select, insert, update on booking.bookings to admin_booking;
grant select, insert, update, delete on booking.slot_blocks to admin_booking;
grant select, insert, update on booking.staff to admin_booking;
grant select, insert on booking.audit_log to admin_booking;

grant execute on function booking.admin_get_slots(date, int) to admin_booking;
grant execute on function booking.admin_create_booking(text, text, text, text, date, time, text, text) to admin_booking;
grant execute on function booking.admin_reschedule_booking(uuid, date, time) to admin_booking;
grant execute on function booking.admin_cancel_booking(uuid) to admin_booking;

revoke usage on schema clinical from admin_booking;
revoke all on all tables in schema clinical from admin_booking;

-- -----------------------------------------------------------------------------
-- admin_clinical privileges:
-- USAGE on schema booking (SELECT-only on booking tables).
-- USAGE on schema clinical.
-- DML on clinical tables except access_log and reminder_log which are INSERT+SELECT only.
-- -----------------------------------------------------------------------------
grant usage on schema booking to admin_clinical;
grant select on booking.clinic_settings, booking.weekly_slots, booking.contacts,
  booking.bookings, booking.slot_blocks, booking.staff, booking.audit_log to admin_clinical;
grant execute on function booking.admin_get_slots(date, int) to admin_clinical;

grant usage on schema clinical to admin_clinical;
grant select, insert, update, delete on clinical.clinical_patients to admin_clinical;
grant select, insert, update, delete on clinical.consultations to admin_clinical;
grant select, insert, update, delete on clinical.medications to admin_clinical;
grant select, insert on clinical.reminder_log to admin_clinical;
grant select, insert on clinical.access_log to admin_clinical;
