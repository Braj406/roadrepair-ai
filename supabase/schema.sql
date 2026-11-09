-- RoadRepair AI database schema. Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- Then run the files in supabase/migrations/ in order.
create extension if not exists postgis;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  organization text,
  role text not null default 'inspector' check (role in ('admin','inspector','crew')),
  created_at timestamptz default now()
);

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, organization, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'organization',
    coalesce(new.raw_user_meta_data->>'role', 'inspector')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users on delete set null,
  video_path text not null,
  gps_path text,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  progress real default 0,
  frames_total int,
  detections int default 0,
  created_at timestamptz default now()
);

-- One row per real-world defect (after duplicates are merged).
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  damage_type text not null check (damage_type in ('pothole','alligator','longitudinal','transverse')),
  severity text check (severity in ('high','medium','low')),
  priority int,
  location geography(Point, 4326),
  street text,
  times_seen int default 1,
  first_seen timestamptz default now(),
  last_seen timestamptz default now()
);
create index if not exists incidents_location_idx on incidents using gist (location);

-- Raw sightings from the model, per frame.
create table if not exists detections (
  id bigserial primary key,
  scan_id uuid references scans on delete cascade,
  incident_id uuid references incidents on delete set null,
  track_id int,
  frame int,
  video_time real,
  confidence real,
  area_m2 real,
  bbox jsonb,
  image_path text,
  location geography(Point, 4326),
  created_at timestamptz default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references incidents on delete cascade,
  status text not null default 'open' check (status in ('open','in_review','scheduled','resolved')),
  assignee text,
  due date,
  notes text,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- Row level security: signed-in users can read and write (tighten per organization later).
alter table profiles enable row level security;
alter table scans enable row level security;
alter table incidents enable row level security;
alter table detections enable row level security;
alter table tickets enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "signed in" on scans for all to authenticated using (true) with check (true);
create policy "signed in" on incidents for all to authenticated using (true) with check (true);
create policy "signed in" on detections for all to authenticated using (true) with check (true);
create policy "signed in" on tickets for all to authenticated using (true) with check (true);

-- Find an existing incident of the same type within N meters (used to merge duplicates).
create or replace function nearby_incident(p_type text, p_lng double precision, p_lat double precision, p_meters double precision default 10)
returns uuid language sql stable as $$
  select id from incidents
  where damage_type = p_type
    and st_dwithin(location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_meters)
  order by st_distance(location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  limit 1;
$$;
