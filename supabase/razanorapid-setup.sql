-- =====================================================================
-- Razano Rapid web app (razanorapid.in) — backend
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run (it updates functions, never deletes data).
--
-- Security model: the browser only has the anon key. Tables have RLS ON
-- with no policies and no grants, so they are unreachable directly.
-- Everything goes through SECURITY DEFINER functions (rr_*) that check
-- a session token. Internal helpers live in schema rr_private, which is
-- not exposed to the API.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists rr_private;
revoke all on schema rr_private from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema rr_private from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.rr_config (
  key   text primary key,
  value jsonb not null
);
insert into public.rr_config(key, value) values
  ('service_sectors', '[47,48,49,50,51,52,53,54,55,56,57]'),
  ('nurse_incentive', '40'),
  ('slot_first_hour', '7'),
  ('slot_last_hour',  '21')
on conflict (key) do nothing;

create table if not exists public.rr_users (
  id              uuid primary key default gen_random_uuid(),
  role            text not null default 'customer' check (role in ('customer','nurse','admin')),
  name            text not null,
  phone           text not null unique,
  email           text unique,
  pass_hash       text not null,
  active          boolean not null default true,
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  -- nurse profile
  qualification   text,
  reg_no          text,
  photo           text,
  vehicle         text,
  verified        boolean not null default false,
  on_duty         boolean not null default false,
  sectors         int[],
  lat             double precision,
  lng             double precision,
  loc_at          timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.rr_sessions (
  token      text primary key,
  user_id    uuid not null references public.rr_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days'
);
create index if not exists rr_sessions_user on public.rr_sessions(user_id);

create table if not exists public.rr_patients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.rr_users(id) on delete cascade,
  name       text not null,
  age        int,
  gender     text,
  relation   text,
  notes      text,
  deleted    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists rr_patients_user on public.rr_patients(user_id);

create table if not exists public.rr_addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.rr_users(id) on delete cascade,
  label      text,
  line1      text not null,
  line2      text,
  sector     int,
  landmark   text,
  lat        double precision,
  lng        double precision,
  deleted    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists rr_addresses_user on public.rr_addresses(user_id);

create table if not exists public.rr_services (
  code        text primary key,
  name        text not null,
  description text not null,
  price       int  not null,
  minutes     int  not null,
  icon        text not null,
  needs_rx    boolean not null default false,
  popular     boolean not null default false,
  sort        int not null default 100,
  active      boolean not null default true
);
insert into public.rr_services(code,name,description,price,minutes,icon,needs_rx,popular,sort) values
 ('vitals',      'Vitals Complete Check',          'BP, blood sugar (glucometer) & SpO2 check with digital log', 199, 15, 'vital_signs', false, true,  10),
 ('nebulisation','Nebulisation Session',           'Nebuliser setup with sterile sealed mask; family provides prescribed medicine', 199, 20, 'air', false, false, 20),
 ('injection',   'Injection Administration',       'IM / subcutaneous injection with sterile syringe, swab & safe disposal', 249, 15, 'vaccines', true, false, 30),
 ('insulin',     'Insulin Dose + Sugar Log',       'Insulin as prescribed, with glucometer reading logged', 249, 15, 'bloodtype', true, false, 40),
 ('dressing',    'Simple Sterile Dressing',        'Minor cuts, stage-1 bedsores, sterile gauze dressing', 299, 25, 'healing', false, false, 50),
 ('pillbox',     'Pill-box Setup / Training',      '7-day medicine box organisation or insulin pen training for family', 299, 30, 'medication', false, false, 60),
 ('wound',       'Post-Op / Diabetic Foot Dressing','Post-op, bedsore or diabetic-foot wound cleaning & sterile dressing', 399, 35, 'footprint', false, false, 70),
 ('catheter',    'Catheter / Colostomy Bag Care',  'Catheter care, bag change, aseptic cleaning & stoma hygiene', 399, 30, 'water_damage', false, false, 80),
 ('sutures',     'Stitch or Staple Removal',       'Sterile stitch / staple removal as advised by your doctor, with wound check', 449, 25, 'content_cut', false, false, 90),
 ('discharge',   'Discharge Visit',                'First home visit after hospital discharge: vitals, wound check, medicines sorted', 499, 45, 'home_health', false, false, 100)
on conflict (code) do nothing;

create sequence if not exists public.rr_booking_seq start 1001;

create table if not exists public.rr_bookings (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique default ('RR-' || nextval('public.rr_booking_seq')),
  customer_id      uuid not null references public.rr_users(id),
  patient_id       uuid references public.rr_patients(id),
  patient          jsonb not null,
  address_id       uuid references public.rr_addresses(id),
  address          jsonb not null,
  sector           int,
  lat              double precision,
  lng              double precision,
  contact_phone    text not null,
  services         jsonb not null,
  total            int not null,
  needs_rx         boolean not null default false,
  mode             text not null check (mode in ('now','scheduled')),
  scheduled_at     timestamptz not null,
  status           text not null default 'waiting'
                   check (status in ('waiting','assigned','accepted','arrived','in_progress','completed','cancelled')),
  nurse_id         uuid references public.rr_users(id),
  assigned_at      timestamptz,
  accepted_at      timestamptz,
  arrived_at       timestamptz,
  started_at       timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text,
  cancelled_by     text,
  injection_skipped boolean not null default false,
  pay_method       text not null default 'after' check (pay_method in ('now','after')),
  pay_status       text not null default 'unpaid' check (pay_status in ('unpaid','claimed','paid')),
  pay_ref          text,
  paid_via         text,
  paid_at          timestamptz,
  vitals           jsonb,
  procedure_note   text,
  consumables      text,
  nurse_notes      text,
  rating           int check (rating between 1 and 5),
  rating_tags      jsonb,
  rating_comment   text,
  rated_at         timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists rr_bookings_customer on public.rr_bookings(customer_id, created_at desc);
create index if not exists rr_bookings_nurse    on public.rr_bookings(nurse_id, status);
create index if not exists rr_bookings_status   on public.rr_bookings(status, scheduled_at);

create table if not exists public.rr_rx (
  booking_id  uuid primary key references public.rr_bookings(id) on delete cascade,
  image       text,
  uploaded_by text,
  uploaded_at timestamptz,
  checks      jsonb not null default '[false,false,false,false,false]',
  status      text not null default 'pending' check (status in ('pending','clear','doctor_ok','doctor_no')),
  doctor_name text,
  doctor_note text,
  decided_at  timestamptz
);

-- Lock tables away from the API roles
alter table public.rr_config    enable row level security;
alter table public.rr_users     enable row level security;
alter table public.rr_sessions  enable row level security;
alter table public.rr_patients  enable row level security;
alter table public.rr_addresses enable row level security;
alter table public.rr_services  enable row level security;
alter table public.rr_bookings  enable row level security;
alter table public.rr_rx        enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.rr_config, public.rr_users, public.rr_sessions, public.rr_patients,
             public.rr_addresses, public.rr_services, public.rr_bookings, public.rr_rx from anon, authenticated';
    execute 'revoke all on sequence public.rr_booking_seq from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Private helpers (not callable from the browser)
-- ---------------------------------------------------------------------
create or replace function rr_private.err(msg text) returns void
language plpgsql as $$ begin raise exception using message = msg, errcode = 'P0001'; end $$;

create or replace function rr_private.cfg(k text) returns jsonb
language sql stable as $$ select value from public.rr_config where key = k $$;

create or replace function rr_private.phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p,''), '\D', '', 'g');
begin
  if length(d) > 10 then d := right(d, 10); end if;
  if d !~ '^[6-9][0-9]{9}$' then
    perform rr_private.err('Enter a valid 10-digit mobile number');
  end if;
  return d;
end $$;

create or replace function rr_private.me(p_token text) returns public.rr_users
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users;
begin
  select usr.* into u from public.rr_sessions s join public.rr_users usr on usr.id = s.user_id
   where s.token = p_token and s.expires_at > now() and usr.active;
  if u.id is null then perform rr_private.err('AUTH_REQUIRED'); end if;
  return u;
end $$;

create or replace function rr_private.need(p_token text, p_roles text[]) returns public.rr_users
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token);
begin
  if not (u.role = any(p_roles)) then perform rr_private.err('Not allowed for this account'); end if;
  return u;
end $$;

create or replace function rr_private.new_session(p_user uuid) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.rr_sessions(token, user_id) values (t, p_user);
  return t;
end $$;

create or replace function rr_private.user_json(u public.rr_users) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', u.id, 'role', u.role, 'name', u.name, 'phone', u.phone, 'email', u.email,
    'qualification', u.qualification, 'reg_no', u.reg_no, 'vehicle', u.vehicle,
    'verified', u.verified, 'on_duty', u.on_duty, 'sectors', to_jsonb(u.sectors),
    'photo', u.photo, 'active', u.active, 'created_at', u.created_at)
$$;

create or replace function rr_private.in_area(p_sector int) returns boolean
language sql stable as $$
  select p_sector is not null and rr_private.cfg('service_sectors') @> to_jsonb(p_sector)
$$;

create or replace function rr_private.covers(n public.rr_users, p_sector int) returns boolean
language sql immutable as $$
  select n.sectors is null or cardinality(n.sectors) = 0 or p_sector = any(n.sectors)
$$;

create or replace function rr_private.km(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select case when lat1 is null or lat2 is null or lng1 is null or lng2 is null then null else
    6371 * 2 * asin(sqrt(power(sin(radians(lat2-lat1)/2),2) + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lng2-lng1)/2),2)))
  end
$$;

-- Nurse is busy if something is in hand or due within 30 minutes
create or replace function rr_private.busy(p_nurse uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.rr_bookings b where b.nurse_id = p_nurse and (
     b.status in ('accepted','arrived','in_progress')
     or (b.status = 'assigned' and (b.mode = 'now' or b.scheduled_at <= now() + interval '30 minutes'))))
$$;

-- Best free on-duty nurse for an immediate visit
create or replace function rr_private.free_nurse(p_sector int, p_lat float8, p_lng float8) returns public.rr_users
language sql stable as $$
  select n.* from public.rr_users n
   where n.role = 'nurse' and n.active and n.on_duty and rr_private.covers(n, p_sector)
     and not rr_private.busy(n.id)
   order by case when n.loc_at > now() - interval '15 minutes'
                 then coalesce(rr_private.km(n.lat, n.lng, p_lat, p_lng), 50) else 50 end, random()
   limit 1
$$;

create or replace function rr_private.eta(n public.rr_users, p_lat float8, p_lng float8) returns int
language sql stable as $$
  select case
    when n.loc_at > now() - interval '15 minutes' and rr_private.km(n.lat, n.lng, p_lat, p_lng) is not null
      then greatest(8, least(45, ceil(rr_private.km(n.lat, n.lng, p_lat, p_lng) * 1.4 / 20 * 60)::int + 5))
    else 20 end
$$;

create or replace function rr_private.nurse_count(p_sector int) returns int
language sql stable as $$
  select count(*)::int from public.rr_users n
   where n.role = 'nurse' and n.active and rr_private.covers(n, p_sector)
$$;

-- Free 30-minute slots: today (from 60 min ahead) and the next 2 days, IST
create or replace function rr_private.slots(p_sector int) returns jsonb
language sql stable as $$
  with cap as (select greatest(rr_private.nurse_count(p_sector), 1) c),
  base as (select date_trunc('day', now() at time zone 'Asia/Kolkata') d0),
  s as (
    select ((base.d0 + make_interval(days => dd) + make_interval(hours => hh) + make_interval(mins => mm))
             at time zone 'Asia/Kolkata') as ts
      from base,
           generate_series(0, 2) dd,
           generate_series((rr_private.cfg('slot_first_hour'))::text::int, (rr_private.cfg('slot_last_hour'))::text::int) hh,
           (values (0), (30)) v(mm)
  )
  select coalesce(jsonb_agg(s.ts order by s.ts), '[]'::jsonb)
    from s, cap
   where s.ts >= now() + interval '60 minutes'
     and (select count(*) from public.rr_bookings b
           where b.status <> 'cancelled' and b.scheduled_at >= s.ts
             and b.scheduled_at < s.ts + interval '30 minutes') < cap.c
$$;

create or replace function rr_private.nurse_public(p_nurse uuid, p_with_loc boolean) returns jsonb
language sql stable as $$
  select case when n.id is null then null else jsonb_build_object(
    'id', n.id, 'name', n.name, 'qualification', n.qualification, 'reg_no', n.reg_no,
    'photo', n.photo, 'phone', n.phone, 'vehicle', n.vehicle, 'verified', n.verified,
    'rating_avg', (select round(avg(b.rating)::numeric, 1) from public.rr_bookings b where b.nurse_id = n.id and b.rating is not null),
    'rating_count', (select count(*) from public.rr_bookings b where b.nurse_id = n.id and b.rating is not null),
    'visits', (select count(*) from public.rr_bookings b where b.nurse_id = n.id and b.status = 'completed'),
    'lat', case when p_with_loc then n.lat end,
    'lng', case when p_with_loc then n.lng end,
    'loc_at', case when p_with_loc then n.loc_at end) end
  from (select 1) x left join public.rr_users n on n.id = p_nurse
$$;

create or replace function rr_private.booking_json(b public.rr_bookings, p_viewer text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', b.id, 'ref', b.ref, 'status', b.status, 'mode', b.mode, 'scheduled_at', b.scheduled_at,
    'created_at', b.created_at, 'assigned_at', b.assigned_at, 'accepted_at', b.accepted_at,
    'arrived_at', b.arrived_at, 'started_at', b.started_at, 'completed_at', b.completed_at,
    'cancelled_at', b.cancelled_at, 'cancel_reason', b.cancel_reason, 'cancelled_by', b.cancelled_by,
    'patient', b.patient, 'address', b.address, 'sector', b.sector, 'lat', b.lat, 'lng', b.lng,
    'contact_phone', b.contact_phone, 'services', b.services, 'total', b.total,
    'needs_rx', b.needs_rx, 'injection_skipped', b.injection_skipped,
    'pay_method', b.pay_method, 'pay_status', b.pay_status, 'pay_ref', b.pay_ref,
    'paid_via', b.paid_via, 'paid_at', b.paid_at,
    'vitals', b.vitals, 'procedure_note', b.procedure_note, 'consumables', b.consumables,
    'nurse_notes', b.nurse_notes, 'rating', b.rating, 'rating_tags', b.rating_tags,
    'rating_comment', b.rating_comment,
    'nurse', rr_private.nurse_public(b.nurse_id, b.status in ('accepted','arrived') or p_viewer = 'admin'),
    'rx', (select jsonb_build_object('status', r.status, 'has_image', r.image is not null,
              'checks', r.checks, 'doctor_name', r.doctor_name, 'doctor_note', r.doctor_note,
              'uploaded_by', r.uploaded_by, 'uploaded_at', r.uploaded_at, 'decided_at', r.decided_at)
             from public.rr_rx r where r.booking_id = b.id),
    'customer', case when p_viewer in ('nurse','admin') then
       (select jsonb_build_object('name', c.name, 'phone', c.phone) from public.rr_users c where c.id = b.customer_id) end,
    'incentive', case when p_viewer in ('nurse','admin') then (rr_private.cfg('nurse_incentive'))::text::int end
  )
$$;

-- Give a booking to the best nurse (or leave it waiting)
create or replace function rr_private.assign(p_booking uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.rr_bookings; n public.rr_users;
begin
  select * into b from public.rr_bookings where id = p_booking for update;
  if b.id is null or b.status not in ('waiting','assigned') then return; end if;

  if b.mode = 'now' then
    select * into n from rr_private.free_nurse(b.sector, b.lat, b.lng);
    if n.id is null then  -- everyone busy: queue with the on-duty nurse who has least on hand
      select u.* into n from public.rr_users u
       where u.role = 'nurse' and u.active and u.on_duty and rr_private.covers(u, b.sector)
       order by (select count(*) from public.rr_bookings x where x.nurse_id = u.id
                  and x.status in ('assigned','accepted','arrived','in_progress')), random()
       limit 1;
    end if;
  else
    select u.* into n from public.rr_users u
     where u.role = 'nurse' and u.active and rr_private.covers(u, b.sector)
     order by (select count(*) from public.rr_bookings x where x.nurse_id = u.id and x.status <> 'cancelled'
                 and x.scheduled_at > b.scheduled_at - interval '45 minutes'
                 and x.scheduled_at < b.scheduled_at + interval '45 minutes'),
              (select count(*) from public.rr_bookings x where x.nurse_id = u.id and x.status <> 'cancelled'
                 and (x.scheduled_at at time zone 'Asia/Kolkata')::date = (b.scheduled_at at time zone 'Asia/Kolkata')::date),
              u.on_duty desc, random()
     limit 1;
  end if;

  if n.id is null then
    update public.rr_bookings set status = 'waiting', nurse_id = null, assigned_at = null where id = b.id;
  else
    update public.rr_bookings set status = 'assigned', nurse_id = n.id, assigned_at = now() where id = b.id;
  end if;
end $$;

create or replace function rr_private.booking_for(p_user public.rr_users, p_id uuid) returns public.rr_bookings
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare b public.rr_bookings;
begin
  select * into b from public.rr_bookings where id = p_id;
  if b.id is null then perform rr_private.err('Booking not found'); end if;
  if p_user.role = 'admin' or b.customer_id = p_user.id or b.nurse_id = p_user.id then return b; end if;
  perform rr_private.err('Booking not found');
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Public API: auth & profile
-- ---------------------------------------------------------------------
create or replace function public.rr_signup(p_name text, p_phone text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare ph text := rr_private.phone(p_phone); u public.rr_users;
begin
  if length(trim(coalesce(p_name,''))) < 2 then perform rr_private.err('Please enter your name'); end if;
  if length(coalesce(p_password,'')) < 6 then perform rr_private.err('Password must be at least 6 characters'); end if;
  if exists (select 1 from public.rr_users where phone = ph) then
    perform rr_private.err('This number is already registered. Please log in.');
  end if;
  insert into public.rr_users(name, phone, pass_hash)
  values (trim(p_name), ph, extensions.crypt(p_password, extensions.gen_salt('bf', 8)))
  returning * into u;
  return jsonb_build_object('token', rr_private.new_session(u.id), 'user', rr_private.user_json(u));
end $$;

-- Returns {error} instead of raising so failed-attempt counting is saved
create or replace function public.rr_login(p_login text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users; l text := trim(coalesce(p_login,''));
begin
  if position('@' in l) > 0 then
    select * into u from public.rr_users where lower(email) = lower(l);
  else
    select * into u from public.rr_users where phone = right(regexp_replace(l, '\D', '', 'g'), 10);
  end if;
  if u.id is null then return jsonb_build_object('error', 'Wrong number or password'); end if;
  if u.locked_until is not null and u.locked_until > now() then
    return jsonb_build_object('error', 'Too many wrong attempts. Try again in 15 minutes.');
  end if;
  if extensions.crypt(coalesce(p_password,''), u.pass_hash) <> u.pass_hash then
    if u.failed_attempts + 1 >= 5 then
      update public.rr_users set failed_attempts = 0, locked_until = now() + interval '15 minutes' where id = u.id;
      return jsonb_build_object('error', 'Too many wrong attempts. Try again in 15 minutes.');
    end if;
    update public.rr_users set failed_attempts = failed_attempts + 1 where id = u.id;
    return jsonb_build_object('error', 'Wrong number or password');
  end if;
  if not u.active then return jsonb_build_object('error', 'This account is disabled. WhatsApp us for help.'); end if;
  update public.rr_users set failed_attempts = 0, locked_until = null where id = u.id;
  delete from public.rr_sessions where expires_at < now();
  return jsonb_build_object('token', rr_private.new_session(u.id), 'user', rr_private.user_json(u));
end $$;

create or replace function public.rr_logout(p_token text) returns jsonb
language sql security definer set search_path = public, extensions, pg_temp as $$
  delete from public.rr_sessions where token = p_token returning jsonb_build_object('ok', true)
$$;

create or replace function public.rr_me(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token);
begin
  return jsonb_build_object(
    'user', rr_private.user_json(u),
    'patients', coalesce((select jsonb_agg(to_jsonb(p) - 'user_id' - 'deleted' order by p.created_at)
                            from public.rr_patients p where p.user_id = u.id and not p.deleted), '[]'),
    'addresses', coalesce((select jsonb_agg(to_jsonb(a) - 'user_id' - 'deleted' order by a.created_at)
                            from public.rr_addresses a where a.user_id = u.id and not a.deleted), '[]'),
    'service_sectors', rr_private.cfg('service_sectors'));
end $$;

create or replace function public.rr_update_profile(p_token text, p_name text, p_email text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); e text := nullif(lower(trim(coalesce(p_email,''))), '');
begin
  if length(trim(coalesce(p_name,''))) < 2 then perform rr_private.err('Please enter your name'); end if;
  if e is not null and e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then perform rr_private.err('Enter a valid email'); end if;
  if e is not null and exists (select 1 from public.rr_users where lower(email) = e and id <> u.id) then
    perform rr_private.err('That email is used by another account');
  end if;
  update public.rr_users set name = trim(p_name), email = e where id = u.id returning * into u;
  return rr_private.user_json(u);
end $$;

create or replace function public.rr_change_password(p_token text, p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token);
begin
  if extensions.crypt(coalesce(p_old,''), u.pass_hash) <> u.pass_hash then perform rr_private.err('Current password is wrong'); end if;
  if length(coalesce(p_new,'')) < 6 then perform rr_private.err('New password must be at least 6 characters'); end if;
  update public.rr_users set pass_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 8)) where id = u.id;
  delete from public.rr_sessions where user_id = u.id and token <> p_token;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rr_save_patient(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); r public.rr_patients; a int;
begin
  if length(trim(coalesce(p->>'name',''))) < 2 then perform rr_private.err('Enter the patient''s name'); end if;
  a := nullif(regexp_replace(coalesce(p->>'age',''), '\D', '', 'g'), '')::int;
  if a is null or a < 0 or a > 120 then perform rr_private.err('Enter the patient''s age'); end if;
  if nullif(p->>'id','') is not null then
    update public.rr_patients set name = trim(p->>'name'), age = a, gender = p->>'gender',
      relation = nullif(trim(coalesce(p->>'relation','')), ''), notes = nullif(trim(coalesce(p->>'notes','')), '')
     where id = (p->>'id')::uuid and user_id = u.id returning * into r;
  else
    insert into public.rr_patients(user_id, name, age, gender, relation, notes)
    values (u.id, trim(p->>'name'), a, p->>'gender', nullif(trim(coalesce(p->>'relation','')), ''), nullif(trim(coalesce(p->>'notes','')), ''))
    returning * into r;
  end if;
  if r.id is null then perform rr_private.err('Patient not found'); end if;
  return to_jsonb(r) - 'user_id' - 'deleted';
end $$;

create or replace function public.rr_delete_patient(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token);
begin
  update public.rr_patients set deleted = true where id = p_id and user_id = u.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rr_save_address(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); r public.rr_addresses; s int;
begin
  if length(trim(coalesce(p->>'line1',''))) < 1 then perform rr_private.err('Enter flat / house number'); end if;
  if length(trim(coalesce(p->>'line2',''))) < 2 then perform rr_private.err('Enter society / building name'); end if;
  s := nullif(p->>'sector','')::int;
  if nullif(p->>'id','') is not null then
    update public.rr_addresses set label = nullif(trim(coalesce(p->>'label','')), ''), line1 = trim(p->>'line1'),
      line2 = trim(p->>'line2'), sector = s, landmark = nullif(trim(coalesce(p->>'landmark','')), ''),
      lat = nullif(p->>'lat','')::float8, lng = nullif(p->>'lng','')::float8
     where id = (p->>'id')::uuid and user_id = u.id returning * into r;
  else
    insert into public.rr_addresses(user_id, label, line1, line2, sector, landmark, lat, lng)
    values (u.id, nullif(trim(coalesce(p->>'label','')), ''), trim(p->>'line1'), trim(p->>'line2'), s,
            nullif(trim(coalesce(p->>'landmark','')), ''), nullif(p->>'lat','')::float8, nullif(p->>'lng','')::float8)
    returning * into r;
  end if;
  if r.id is null then perform rr_private.err('Address not found'); end if;
  return to_jsonb(r) - 'user_id' - 'deleted';
end $$;

create or replace function public.rr_delete_address(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token);
begin
  update public.rr_addresses set deleted = true where id = p_id and user_id = u.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Public API: catalogue, availability, booking (customer)
-- ---------------------------------------------------------------------
create or replace function public.rr_services() returns jsonb
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object(
    'services', coalesce((select jsonb_agg(to_jsonb(s) - 'active' - 'sort' order by s.sort)
                            from public.rr_services s where s.active), '[]'),
    'service_sectors', rr_private.cfg('service_sectors'))
$$;

create or replace function public.rr_availability(p_sector int, p_lat float8, p_lng float8) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare n public.rr_users; sec int := coalesce(p_sector, 50); on_duty int;
begin
  select * into n from rr_private.free_nurse(sec, p_lat, p_lng);
  select count(*) into on_duty from public.rr_users u
   where u.role = 'nurse' and u.active and u.on_duty and rr_private.covers(u, sec);
  return jsonb_build_object(
    'in_area', p_sector is null or rr_private.in_area(p_sector),
    'now_ok', n.id is not null,
    'eta_min', case when n.id is not null then rr_private.eta(n, p_lat, p_lng) end,
    'nurse', case when n.id is not null then jsonb_build_object(
       'first_name', split_part(n.name, ' ', 1), 'qualification', n.qualification, 'verified', n.verified,
       'km', case when n.loc_at > now() - interval '15 minutes' then round(rr_private.km(n.lat, n.lng, p_lat, p_lng)::numeric, 1) end) end,
    'on_duty', on_duty,
    'slots', rr_private.slots(sec));
end $$;

create or replace function public.rr_book(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  u public.rr_users := rr_private.me(p_token);
  pt public.rr_patients; ad public.rr_addresses; b public.rr_bookings;
  svc jsonb; tot int; rx boolean; md text := coalesce(p->>'mode','now'); at timestamptz; fn public.rr_users;
begin
  select * into pt from public.rr_patients where id = nullif(p->>'patient_id','')::uuid and user_id = u.id and not deleted;
  if pt.id is null then perform rr_private.err('Please add the patient''s details'); end if;
  select * into ad from public.rr_addresses where id = nullif(p->>'address_id','')::uuid and user_id = u.id and not deleted;
  if ad.id is null then perform rr_private.err('Please add the visit address'); end if;
  if not rr_private.in_area(ad.sector) then
    perform rr_private.err('Sorry, Razano Rapid currently serves Gurgaon Sectors 47–57 only.');
  end if;

  select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'price', s.price, 'minutes', s.minutes,
                                      'icon', s.icon, 'needs_rx', s.needs_rx) order by s.sort),
         sum(s.price), bool_or(s.needs_rx)
    into svc, tot, rx
    from public.rr_services s
   where s.active and s.code in (select jsonb_array_elements_text(coalesce(p->'services','[]'::jsonb)));
  if svc is null then perform rr_private.err('Select at least one procedure'); end if;

  -- double-tap guard: same patient & type booked in the last 2 minutes
  select * into b from public.rr_bookings
   where customer_id = u.id and patient_id = pt.id and mode = md and services = svc
     and status in ('waiting','assigned','accepted')
     and created_at > now() - interval '2 minutes'
     and (md = 'now' or scheduled_at = nullif(p->>'scheduled_at','')::timestamptz)
   order by created_at desc limit 1;
  if b.id is not null then return rr_private.booking_json(b, 'customer'); end if;

  if md = 'now' then
    select * into fn from rr_private.free_nurse(ad.sector, ad.lat, ad.lng);
    if fn.id is null then perform rr_private.err('All nurses are busy right now. Please pick a time slot.'); end if;
    at := now();
  elsif md = 'scheduled' then
    at := nullif(p->>'scheduled_at','')::timestamptz;
    if at is null or not exists (select 1 from jsonb_array_elements_text(rr_private.slots(ad.sector)) x
                                  where x::timestamptz = at) then
      perform rr_private.err('That time slot is no longer available. Please pick another.');
    end if;
  else
    perform rr_private.err('Invalid booking type');
  end if;

  insert into public.rr_bookings(customer_id, patient_id, patient, address_id, address, sector, lat, lng,
    contact_phone, services, total, needs_rx, mode, scheduled_at, pay_method)
  values (u.id, pt.id,
    jsonb_build_object('name', pt.name, 'age', pt.age, 'gender', pt.gender, 'relation', pt.relation, 'notes', pt.notes),
    ad.id,
    jsonb_build_object('label', ad.label, 'line1', ad.line1, 'line2', ad.line2, 'sector', ad.sector,
                       'landmark', ad.landmark, 'lat', ad.lat, 'lng', ad.lng),
    ad.sector, ad.lat, ad.lng, u.phone, svc, tot, coalesce(rx, false), md, at,
    case when p->>'pay_method' = 'now' then 'now' else 'after' end)
  returning * into b;

  perform rr_private.assign(b.id);
  select * into b from public.rr_bookings where id = b.id;
  return rr_private.booking_json(b, 'customer');
end $$;

create or replace function public.rr_my_bookings(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', b.id, 'ref', b.ref, 'status', b.status, 'mode', b.mode, 'scheduled_at', b.scheduled_at,
      'created_at', b.created_at, 'completed_at', b.completed_at, 'patient', b.patient, 'address', b.address,
      'services', b.services, 'total', b.total, 'pay_status', b.pay_status, 'rating', b.rating,
      'nurse_name', (select n.name from public.rr_users n where n.id = b.nurse_id))
      order by b.created_at desc)
    from (select * from public.rr_bookings where customer_id = u.id order by created_at desc limit 100) b), '[]');
end $$;

create or replace function public.rr_my_active(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); b public.rr_bookings;
begin
  select * into b from public.rr_bookings
   where customer_id = u.id and status in ('waiting','assigned','accepted','arrived','in_progress')
   order by case status when 'in_progress' then 0 when 'arrived' then 1 when 'accepted' then 2 else 3 end, scheduled_at
   limit 1;
  if b.id is null then return null; end if;
  return rr_private.booking_json(b, 'customer');
end $$;

create or replace function public.rr_booking(p_token text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  return rr_private.booking_json(b, case when u.role = 'admin' then 'admin'
                                         when b.nurse_id = u.id then 'nurse' else 'customer' end);
end $$;

create or replace function public.rr_cancel(p_token text, p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  if u.role <> 'admin' and b.customer_id <> u.id then perform rr_private.err('Only the family can cancel this visit'); end if;
  if u.role <> 'admin' and b.status not in ('waiting','assigned','accepted') then
    perform rr_private.err('The nurse has already arrived. Please talk to the nurse or WhatsApp us.');
  end if;
  if b.status in ('completed','cancelled') then perform rr_private.err('This visit is already closed'); end if;
  update public.rr_bookings set status = 'cancelled', cancelled_at = now(),
    cancel_reason = nullif(trim(coalesce(p_reason,'')), ''), cancelled_by = u.role
   where id = b.id returning * into b;
  return rr_private.booking_json(b, case when u.role = 'admin' then 'admin' else 'customer' end);
end $$;

create or replace function public.rr_claim_payment(p_token text, p_id uuid, p_ref text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  if b.status = 'cancelled' then perform rr_private.err('This visit was cancelled'); end if;
  if b.pay_status <> 'paid' then
    update public.rr_bookings set pay_status = 'claimed', paid_via = 'upi',
      pay_ref = nullif(left(trim(coalesce(p_ref,'')), 40), '')
     where id = b.id returning * into b;
  end if;
  return rr_private.booking_json(b, 'customer');
end $$;

create or replace function public.rr_rate(p_token text, p_id uuid, p_rating int, p_tags jsonb, p_comment text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  if b.customer_id <> u.id then perform rr_private.err('Only the family can rate this visit'); end if;
  if b.status <> 'completed' then perform rr_private.err('You can rate after the visit is completed'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then perform rr_private.err('Pick 1 to 5 stars'); end if;
  update public.rr_bookings set rating = p_rating, rating_tags = coalesce(p_tags, '[]'),
    rating_comment = nullif(left(trim(coalesce(p_comment,'')), 500), ''), rated_at = now()
   where id = b.id returning * into b;
  return rr_private.booking_json(b, 'customer');
end $$;

-- ---------------------------------------------------------------------
-- Public API: prescription check
-- ---------------------------------------------------------------------
create or replace function public.rr_rx_upload(p_token text, p_id uuid, p_image text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  if coalesce(p_image,'') !~ '^data:image/(jpeg|png|webp);base64,' then perform rr_private.err('Please upload a photo of the prescription'); end if;
  if length(p_image) > 3000000 then perform rr_private.err('Photo is too large'); end if;
  if b.status in ('completed','cancelled') then perform rr_private.err('This visit is already closed'); end if;
  insert into public.rr_rx(booking_id, image, uploaded_by, uploaded_at)
  values (b.id, p_image, u.role, now())
  on conflict (booking_id) do update set image = excluded.image, uploaded_by = excluded.uploaded_by,
    uploaded_at = now(), checks = '[false,false,false,false,false]', status = 'pending',
    doctor_name = null, doctor_note = null, decided_at = null;
  return rr_private.booking_json(b, case when u.role = 'admin' then 'admin' when b.nurse_id = u.id then 'nurse' else 'customer' end);
end $$;

create or replace function public.rr_rx_get(p_token text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.me(p_token); b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  return (select to_jsonb(r) from public.rr_rx r where r.booking_id = b.id);
end $$;

create or replace function public.rr_rx_check(p_token text, p_id uuid, p_checks jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['nurse','admin']);
        b public.rr_bookings := rr_private.booking_for(u, p_id); r public.rr_rx; allok boolean;
begin
  select * into r from public.rr_rx where booking_id = b.id;
  if r.image is null then perform rr_private.err('Take a photo of the prescription first'); end if;
  if jsonb_typeof(p_checks) <> 'array' or jsonb_array_length(p_checks) <> 5 then perform rr_private.err('Invalid checklist'); end if;
  allok := not exists (select 1 from jsonb_array_elements(p_checks) e where e <> 'true'::jsonb);
  update public.rr_rx set checks = p_checks,
    status = case when r.status in ('doctor_ok','doctor_no') then r.status when allok then 'clear' else 'pending' end,
    decided_at = case when allok then now() else decided_at end
   where booking_id = b.id;
  return rr_private.booking_json(b, 'nurse');
end $$;

create or replace function public.rr_rx_doctor(p_token text, p_id uuid, p_doctor text, p_note text, p_ok boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['nurse','admin']);
        b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  if not exists (select 1 from public.rr_rx where booking_id = b.id and image is not null) then
    perform rr_private.err('Take a photo of the prescription first');
  end if;
  if length(trim(coalesce(p_doctor,''))) < 3 then perform rr_private.err('Enter the doctor''s name'); end if;
  if length(trim(coalesce(p_note,''))) < 2 then perform rr_private.err('Write what the doctor said'); end if;
  update public.rr_rx set status = case when p_ok then 'doctor_ok' else 'doctor_no' end,
    doctor_name = trim(p_doctor), doctor_note = trim(p_note), decided_at = now()
   where booking_id = b.id;
  return rr_private.booking_json(b, 'nurse');
end $$;

-- ---------------------------------------------------------------------
-- Public API: nurse
-- ---------------------------------------------------------------------
create or replace function public.rr_nurse_home(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['nurse']); act public.rr_bookings; done int;
begin
  select * into act from public.rr_bookings
   where nurse_id = u.id and (status in ('accepted','arrived','in_progress')
         or (status = 'assigned' and (mode = 'now' or scheduled_at <= now() + interval '60 minutes')))
   order by case status when 'in_progress' then 0 when 'arrived' then 1 when 'accepted' then 2 else 3 end, scheduled_at
   limit 1;
  select count(*) into done from public.rr_bookings
   where nurse_id = u.id and status = 'completed'
     and (completed_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
  return jsonb_build_object(
    'me', rr_private.user_json(u),
    'today_completed', done,
    'incentive', (rr_private.cfg('nurse_incentive'))::text::int,
    'active', case when act.id is not null then rr_private.booking_json(act, 'nurse') end,
    'upcoming', coalesce((select jsonb_agg(rr_private.booking_json(b, 'nurse') order by b.scheduled_at)
        from public.rr_bookings b
        where b.nurse_id = u.id and b.status = 'assigned' and b.id is distinct from act.id), '[]'),
    'waiting', (select count(*) from public.rr_bookings w where w.status = 'waiting' and rr_private.covers(u, w.sector)),
    'recent', coalesce((select jsonb_agg(x order by x->>'completed_at' desc) from (
        select jsonb_build_object('id', b.id, 'ref', b.ref, 'patient', b.patient, 'services', b.services,
          'completed_at', b.completed_at, 'pay_status', b.pay_status, 'total', b.total) x
          from public.rr_bookings b where b.nurse_id = u.id and b.status = 'completed'
          order by b.completed_at desc limit 10) t), '[]'));
end $$;

create or replace function public.rr_set_duty(p_token text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['nurse']); w record;
begin
  update public.rr_users set on_duty = coalesce(p_on, false) where id = u.id returning * into u;
  if u.on_duty then
    -- pick up anything that was waiting for a nurse in my area
    update public.rr_bookings b set status = 'assigned', nurse_id = u.id, assigned_at = now()
     where b.status = 'waiting' and rr_private.covers(u, b.sector);
  else
    -- hand back immediate visits I haven't accepted
    for w in select id from public.rr_bookings where nurse_id = u.id and status = 'assigned' and mode = 'now' loop
      update public.rr_bookings set status = 'waiting', nurse_id = null, assigned_at = null where id = w.id;
      perform rr_private.assign(w.id);
    end loop;
  end if;
  return public.rr_nurse_home(p_token);
end $$;

create or replace function public.rr_nurse_ping(p_token text, p_lat float8, p_lng float8) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['nurse']);
begin
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then return jsonb_build_object('ok', false); end if;
  update public.rr_users set lat = p_lat, lng = p_lng, loc_at = now() where id = u.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rr_nurse_step(p_token text, p_id uuid, p_step text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['nurse']);
        b public.rr_bookings := rr_private.booking_for(u, p_id); r public.rr_rx;
begin
  if b.nurse_id <> u.id then perform rr_private.err('This visit is not assigned to you'); end if;
  if p_step = 'accept' then
    if b.status <> 'assigned' then perform rr_private.err('This visit can''t be accepted now'); end if;
    update public.rr_bookings set status = 'accepted', accepted_at = now() where id = b.id;
    update public.rr_users set on_duty = true where id = u.id;
  elsif p_step = 'arrive' then
    if b.status <> 'accepted' then perform rr_private.err('Accept the visit first'); end if;
    update public.rr_bookings set status = 'arrived', arrived_at = now() where id = b.id;
  elsif p_step in ('start', 'start_no_injection') then
    if b.status <> 'arrived' then perform rr_private.err('Mark "I''ve arrived" first'); end if;
    if b.needs_rx and p_step = 'start' then
      select * into r from public.rr_rx where booking_id = b.id;
      if r.status is null or r.status not in ('clear','doctor_ok') then
        perform rr_private.err('Injection locked: finish the 5-point prescription check or get the doctor''s OK.');
      end if;
    end if;
    update public.rr_bookings set status = 'in_progress', started_at = now(),
      injection_skipped = (b.needs_rx and p_step = 'start_no_injection') where id = b.id;
  else
    perform rr_private.err('Unknown step');
  end if;
  select * into b from public.rr_bookings where id = b.id;
  return rr_private.booking_json(b, 'nurse');
end $$;

create or replace function public.rr_nurse_complete(p_token text, p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['nurse']);
        b public.rr_bookings := rr_private.booking_for(u, p_id); v jsonb := coalesce(p->'vitals', '{}'::jsonb);
        col text := p->>'collected';
begin
  if b.nurse_id <> u.id then perform rr_private.err('This visit is not assigned to you'); end if;
  if b.status <> 'in_progress' then perform rr_private.err('Begin the procedure first'); end if;
  if length(trim(coalesce(p->>'procedure_note',''))) < 3 then perform rr_private.err('Write what was done in "Procedure done"'); end if;
  update public.rr_bookings set status = 'completed', completed_at = now(),
    vitals = jsonb_strip_nulls(jsonb_build_object(
      'bp_sys', nullif(v->>'bp_sys','')::int, 'bp_dia', nullif(v->>'bp_dia','')::int,
      'sugar', nullif(v->>'sugar','')::int, 'sugar_context', nullif(v->>'sugar_context',''),
      'pulse', nullif(v->>'pulse','')::int, 'spo2', nullif(v->>'spo2','')::int,
      'temp', nullif(v->>'temp','')::numeric)),
    procedure_note = trim(p->>'procedure_note'),
    consumables = nullif(trim(coalesce(p->>'consumables','')), ''),
    nurse_notes = nullif(trim(coalesce(p->>'nurse_notes','')), ''),
    pay_status = case when col in ('upi','cash') then 'paid' else pay_status end,
    paid_via   = case when col in ('upi','cash') then col else paid_via end,
    paid_at    = case when col in ('upi','cash') then now() else paid_at end
   where id = b.id returning * into b;
  return rr_private.booking_json(b, 'nurse');
end $$;

create or replace function public.rr_nurse_mark_paid(p_token text, p_id uuid, p_via text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['nurse']);
        b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  if p_via not in ('upi','cash') then perform rr_private.err('Choose UPI or cash'); end if;
  update public.rr_bookings set pay_status = 'paid', paid_via = p_via, paid_at = now() where id = b.id returning * into b;
  return rr_private.booking_json(b, 'nurse');
end $$;

-- ---------------------------------------------------------------------
-- Public API: admin
-- ---------------------------------------------------------------------
create or replace function public.rr_admin_bookings(p_token text, p_scope text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['admin']);
begin
  return coalesce((select jsonb_agg(rr_private.booking_json(b, 'admin') - 'nurse'
      || jsonb_build_object('nurse_name', (select n.name from public.rr_users n where n.id = b.nurse_id), 'nurse_id', b.nurse_id)
      order by b.scheduled_at desc)
    from (select * from public.rr_bookings x where
            case coalesce(p_scope,'active')
              when 'active' then x.status in ('waiting','assigned','accepted','arrived','in_progress')
              when 'today'  then (x.scheduled_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
              when 'unpaid' then x.status = 'completed' and x.pay_status <> 'paid' or x.pay_status = 'claimed'
              else true end
          order by x.scheduled_at desc limit 300) b), '[]');
end $$;

create or replace function public.rr_admin_booking_update(p_token text, p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['admin']); b public.rr_bookings := rr_private.booking_for(u, p_id);
begin
  if p ? 'nurse_id' then
    if b.status in ('completed','cancelled') then perform rr_private.err('Visit is closed'); end if;
    if nullif(p->>'nurse_id','') is null then
      update public.rr_bookings set nurse_id = null, status = 'waiting', assigned_at = null, accepted_at = null where id = b.id;
    else
      if not exists (select 1 from public.rr_users where id = (p->>'nurse_id')::uuid and role = 'nurse' and active) then
        perform rr_private.err('Nurse not found');
      end if;
      update public.rr_bookings set nurse_id = (p->>'nurse_id')::uuid, status = 'assigned', assigned_at = now(), accepted_at = null
       where id = b.id;
    end if;
  end if;
  if p->>'pay_status' = 'paid' then
    update public.rr_bookings set pay_status = 'paid', paid_via = coalesce(nullif(p->>'paid_via',''), paid_via, 'upi'),
      paid_at = now() where id = b.id;
  elsif p->>'pay_status' = 'unpaid' then
    update public.rr_bookings set pay_status = 'unpaid', paid_at = null where id = b.id;
  end if;
  select * into b from public.rr_bookings where id = b.id;
  return rr_private.booking_json(b, 'admin');
end $$;

create or replace function public.rr_admin_users(p_token text, p_role text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['admin']);
begin
  return coalesce((select jsonb_agg(rr_private.user_json(x) || jsonb_build_object(
        'visits', (select count(*) from public.rr_bookings b where (b.nurse_id = x.id or b.customer_id = x.id) and b.status = 'completed'),
        'rating_avg', (select round(avg(b.rating)::numeric,1) from public.rr_bookings b where b.nurse_id = x.id and b.rating is not null),
        'loc_at', x.loc_at)
      order by x.created_at desc)
    from public.rr_users x where x.role = coalesce(p_role, x.role)), '[]');
end $$;

create or replace function public.rr_admin_save_nurse(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['admin']); n public.rr_users;
        ph text := rr_private.phone(p->>'phone'); e text := nullif(lower(trim(coalesce(p->>'email',''))), '');
        sec int[];
begin
  if length(trim(coalesce(p->>'name',''))) < 2 then perform rr_private.err('Enter the nurse''s name'); end if;
  if jsonb_typeof(p->'sectors') = 'array' and jsonb_array_length(p->'sectors') > 0 then
    select array_agg(x::int) into sec from jsonb_array_elements_text(p->'sectors') x;
  end if;
  if nullif(p->>'id','') is null then
    if length(coalesce(p->>'password','')) < 6 then perform rr_private.err('Set a password of at least 6 characters'); end if;
    if exists (select 1 from public.rr_users where phone = ph) then perform rr_private.err('This phone number already has an account'); end if;
    if e is not null and exists (select 1 from public.rr_users where lower(email) = e) then perform rr_private.err('This email already has an account'); end if;
    insert into public.rr_users(role, name, phone, email, pass_hash, qualification, reg_no, vehicle, photo, verified, sectors, active)
    values ('nurse', trim(p->>'name'), ph, e, extensions.crypt(p->>'password', extensions.gen_salt('bf', 8)),
            nullif(trim(coalesce(p->>'qualification','')), ''), nullif(trim(coalesce(p->>'reg_no','')), ''),
            nullif(trim(coalesce(p->>'vehicle','')), ''), nullif(p->>'photo',''),
            coalesce((p->>'verified')::boolean, false), sec, coalesce((p->>'active')::boolean, true))
    returning * into n;
  else
    if exists (select 1 from public.rr_users where phone = ph and id <> (p->>'id')::uuid) then perform rr_private.err('This phone number already has an account'); end if;
    if e is not null and exists (select 1 from public.rr_users where lower(email) = e and id <> (p->>'id')::uuid) then perform rr_private.err('This email already has an account'); end if;
    update public.rr_users set name = trim(p->>'name'), phone = ph, email = e,
      qualification = nullif(trim(coalesce(p->>'qualification','')), ''), reg_no = nullif(trim(coalesce(p->>'reg_no','')), ''),
      vehicle = nullif(trim(coalesce(p->>'vehicle','')), ''),
      photo = case when p ? 'photo' then nullif(p->>'photo','') else photo end,
      verified = coalesce((p->>'verified')::boolean, verified), sectors = sec,
      active = coalesce((p->>'active')::boolean, active),
      on_duty = case when coalesce((p->>'active')::boolean, active) then on_duty else false end,
      pass_hash = case when length(coalesce(p->>'password','')) >= 6
                       then extensions.crypt(p->>'password', extensions.gen_salt('bf', 8)) else pass_hash end
     where id = (p->>'id')::uuid and role = 'nurse' returning * into n;
    if n.id is null then perform rr_private.err('Nurse not found'); end if;
    if not n.active then delete from public.rr_sessions where user_id = n.id; end if;
  end if;
  return rr_private.user_json(n);
end $$;

create or replace function public.rr_admin_reset_password(p_token text, p_user uuid, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['admin']);
begin
  if length(coalesce(p_password,'')) < 6 then perform rr_private.err('Password must be at least 6 characters'); end if;
  update public.rr_users set pass_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8)),
    failed_attempts = 0, locked_until = null where id = p_user;
  delete from public.rr_sessions where user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rr_admin_stats(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare u public.rr_users := rr_private.need(p_token, array['admin']);
        today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  return jsonb_build_object(
    'today_visits', (select count(*) from public.rr_bookings where status = 'completed' and (completed_at at time zone 'Asia/Kolkata')::date = today),
    'today_revenue', (select coalesce(sum(total),0) from public.rr_bookings where status = 'completed' and (completed_at at time zone 'Asia/Kolkata')::date = today),
    'month_visits', (select count(*) from public.rr_bookings where status = 'completed' and date_trunc('month', completed_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata')),
    'month_revenue', (select coalesce(sum(total),0) from public.rr_bookings where status = 'completed' and date_trunc('month', completed_at at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata')),
    'active', (select count(*) from public.rr_bookings where status in ('waiting','assigned','accepted','arrived','in_progress')),
    'waiting', (select count(*) from public.rr_bookings where status = 'waiting'),
    'unpaid', (select coalesce(sum(total),0) from public.rr_bookings where status = 'completed' and pay_status <> 'paid'),
    'customers', (select count(*) from public.rr_users where role = 'customer'),
    'nurses_on_duty', (select count(*) from public.rr_users where role = 'nurse' and active and on_duty));
end $$;

-- ---------------------------------------------------------------------
-- Permissions: only the rr_* API functions are callable from the browser
-- ---------------------------------------------------------------------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'rr_private' loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f.sig);
    end if;
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'rr\_%' loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    end if;
  end loop;
end $$;

-- Make the API pick up the new functions immediately
notify pgrst, 'reload schema';

-- =====================================================================
-- AFTER RUNNING: make yourself admin
--   1. Open razanorapid.in, sign up with 9953456837.
--   2. Run:  update public.rr_users set role = 'admin' where phone = '9953456837';
-- =====================================================================
