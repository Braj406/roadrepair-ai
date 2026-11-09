-- Adds the fields the AI video service fills in. Safe to run more than once.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.

alter table incidents add column if not exists confidence real;        -- best AI confidence, 0-1
alter table incidents add column if not exists size real;              -- how large it looks, 0-1
alter table incidents add column if not exists change_pct real default 0; -- growth since the previous trip, %
alter table incidents add column if not exists thumbnail text;         -- small JPEG of the clearest sighting (data URL)
alter table incidents add column if not exists video_time real;        -- seconds into the video of that sighting
alter table incidents add column if not exists scan_id uuid references scans on delete set null; -- latest scan that saw it

alter table scans add column if not exists filename text;
alter table scans add column if not exists duration_s real;
alter table scans add column if not exists unique_incidents int;

-- Read incidents with plain latitude/longitude numbers (the location column is a PostGIS type).
create or replace view incidents_view with (security_invoker = true) as
  select i.*, st_y(i.location::geometry) as lat, st_x(i.location::geometry) as lng
  from incidents i;
