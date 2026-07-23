-- Pin Drop — starting Supabase schema (Postgres + PostGIS)
-- Run in the Supabase SQL editor or as a migration. This mirrors the client data model
-- in index.html and enforces the 18+ / admin / ban rules the UI already applies.
--
-- NOTE: this is a scaffold to build on, not a full production migration. Review the RLS
-- policies against your exact product rules before shipping.

create extension if not exists postgis;
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type account_status as enum ('active','restricted','banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pin_category as enum ('social','fire','hazard','found','lost','meetup');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pin_precision as enum ('exact','approx_50m','block');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('open','resolved','dismissed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text not null default 'Someone',
  bio           text,
  avatar_preset int,                       -- 1..N generated avatar
  avatar_url    text,                       -- uploaded photo (Storage)
  age_band      text check (age_band in ('18-24','25-34','35-44','45-54','55-64','65+')),
  age_verified  boolean not null default false,   -- set true only after the 18+ gate
  is_admin      boolean not null default false,
  status        account_status not null default 'active',
  points        int not null default 0,
  created_at    timestamptz not null default now()
);

create or replace function is_admin(uid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from profiles where id = uid), false) $$;

create or replace function is_active(uid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select status = 'active' from profiles where id = uid), false) $$;

-- ---------------------------------------------------------------------------
-- Posts (pins)
-- ---------------------------------------------------------------------------
create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references profiles(id) on delete cascade,
  category      pin_category not null,
  subcat        text,                       -- social spot-type: food, event, music, ...
  body          text not null,
  precision     pin_precision not null default 'approx_50m',
  exact_location    geography(point,4326) not null,   -- never returned to clients
  display_location  geography(point,4326) not null,   -- fuzzed to `precision`
  status        text not null default 'active',        -- active|resolved|expired|hidden|removed
  like_count    int not null default 0,
  confirm_count int not null default 0,
  report_count  int not null default 0,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz                              -- null = never
);
create index if not exists posts_display_gix on posts using gist (display_location);
create index if not exists posts_active_idx  on posts (status, expires_at);

create table if not exists post_media (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid not null references posts(id) on delete cascade,
  url       text not null,                 -- Storage object (EXIF/GPS stripped on upload)
  alt       text,
  position  int not null default 0
);

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- Engagement
create table if not exists likes    (post_id uuid references posts(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, primary key (post_id,user_id));
create table if not exists saves    (post_id uuid references posts(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, primary key (post_id,user_id));
create table if not exists confirms (post_id uuid references posts(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, primary key (post_id,user_id));

-- ---------------------------------------------------------------------------
-- Social graph
-- ---------------------------------------------------------------------------
create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table if not exists blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id)
);

-- ---------------------------------------------------------------------------
-- Meetups (18+, anonymous until mutual reveal)
-- ---------------------------------------------------------------------------
create table if not exists meetups (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references profiles(id) on delete cascade,
  activity         text not null,
  note             text,
  age_band         text not null,
  bands            text[] not null,          -- host band + one adjacent
  venue            text not null,            -- snapped public place
  display_location geography(point,4326) not null,  -- block-level only
  status           text not null default 'open',    -- open|matched|expired
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null
);
create index if not exists meetups_display_gix on meetups using gist (display_location);

create table if not exists meetup_requests (
  id         uuid primary key default gen_random_uuid(),
  meetup_id  uuid not null references meetups(id) on delete cascade,
  guest_id   uuid not null references profiles(id) on delete cascade,
  status     text not null default 'pending',        -- pending|accepted|declined
  reveal_guest boolean not null default false,
  created_at timestamptz not null default now(),
  unique (meetup_id, guest_id)
);

create table if not exists meetup_messages (
  id         uuid primary key default gen_random_uuid(),
  meetup_id  uuid not null references meetups(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Moderation & gamification
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  target_type text not null,                 -- post|user|meetup
  target_id   uuid not null,
  reason      text not null,
  status      report_status not null default 'open',
  created_at  timestamptz not null default now()
);

create table if not exists point_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  action     text not null,                  -- create_post, confirm_emergency, ...
  points     int not null,
  ref        uuid,
  created_at timestamptz not null default now()
);

create table if not exists badges (
  user_id    uuid not null references profiles(id) on delete cascade,
  badge_key  text not null,                  -- first_drop, cartographer, ...
  earned_at  timestamptz not null default now(),
  primary key (user_id, badge_key)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles        enable row level security;
alter table posts           enable row level security;
alter table post_media      enable row level security;
alter table comments        enable row level security;
alter table likes           enable row level security;
alter table saves           enable row level security;
alter table confirms        enable row level security;
alter table follows         enable row level security;
alter table blocks          enable row level security;
alter table meetups         enable row level security;
alter table meetup_requests enable row level security;
alter table meetup_messages enable row level security;
alter table reports         enable row level security;
alter table point_events    enable row level security;
alter table badges          enable row level security;

-- Profiles: anyone signed in can read; you edit your own; admins can moderate anyone.
create policy profiles_read   on profiles for select using (auth.role() = 'authenticated');
create policy profiles_update on profiles for update using (id = auth.uid() or is_admin(auth.uid()));

-- Posts: visible when active and the author isn't banned; author or admin can write.
create policy posts_read   on posts for select
  using (status = 'active' and is_active(author_id)
         and not exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = author_id));
create policy posts_insert on posts for insert
  with check (author_id = auth.uid() and is_active(auth.uid())
              and (select age_verified from profiles where id = auth.uid()));
create policy posts_update on posts for update using (author_id = auth.uid() or is_admin(auth.uid()));
create policy posts_delete on posts for delete using (author_id = auth.uid() or is_admin(auth.uid()));

create policy media_read   on post_media for select using (true);
create policy media_write  on post_media for all using (
  exists (select 1 from posts p where p.id = post_id and (p.author_id = auth.uid() or is_admin(auth.uid()))));

create policy comments_read   on comments for select using (true);
create policy comments_insert on comments for insert with check (author_id = auth.uid() and is_active(auth.uid()));
create policy comments_delete on comments for delete using (
  author_id = auth.uid() or is_admin(auth.uid())
  or exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid()));

-- Engagement: you manage your own rows.
create policy likes_rw    on likes    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saves_rw    on saves    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy confirms_rw on confirms for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy follows_read on follows for select using (true);
create policy follows_rw   on follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy blocks_rw    on blocks  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Meetups: 18+ only, and only visible to users whose band matches. Never expose host_id
-- to clients directly — serve an anonymous view; reveal is negotiated via requests.
create policy meetups_read on meetups for select using (
  is_active(host_id)
  and (select age_verified from profiles where id = auth.uid())
  and (select age_band from profiles where id = auth.uid()) = any (bands));
create policy meetups_write on meetups for all
  using (host_id = auth.uid() or is_admin(auth.uid()))
  with check (host_id = auth.uid() and (select age_verified from profiles where id = auth.uid()));

create policy mreq_rw on meetup_requests for all using (
  guest_id = auth.uid() or exists (select 1 from meetups m where m.id = meetup_id and m.host_id = auth.uid()));
create policy mmsg_rw on meetup_messages for all using (
  exists (select 1 from meetups m where m.id = meetup_id
          and (m.host_id = auth.uid()
               or exists (select 1 from meetup_requests r where r.meetup_id = m.id and r.guest_id = auth.uid() and r.status = 'accepted'))));

-- Reports: anyone can file; only admins can read/triage.
create policy reports_insert on reports for insert with check (reporter_id = auth.uid());
create policy reports_admin  on reports for all using (is_admin(auth.uid()));

create policy points_read on point_events for select using (user_id = auth.uid() or is_admin(auth.uid()));
create policy badges_read on badges       for select using (true);
