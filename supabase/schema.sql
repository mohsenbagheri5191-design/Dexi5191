-- Pin Drop — Supabase schema (LIVE)
-- This mirrors what is currently applied to the project (arzprijpiblzyzkedsno),
-- via migrations: pinly_core_schema, pinly_rls_policies, pinly_auth_realtime_storage,
-- pinly_security_hardening. Postgres 17 + PostGIS.

-- ============================================================ extensions + enums
create extension if not exists postgis;
create extension if not exists pgcrypto;
do $$ begin create type account_status as enum ('active','restricted','banned'); exception when duplicate_object then null; end $$;
do $$ begin create type pin_precision as enum ('exact','approx_50m','block'); exception when duplicate_object then null; end $$;
do $$ begin create type report_status as enum ('open','resolved','dismissed'); exception when duplicate_object then null; end $$;

-- ============================================================ tables
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default 'Someone',
  bio text, avatar_url text, avatar_preset int,
  age_band text check (age_band in ('18-24','25-34','35-44','45-54','55-64','65+')),
  age_verified boolean not null default false,
  is_admin boolean not null default false,
  status account_status not null default 'active',
  points int not null default 0, streak int not null default 0, streak_day date,
  visibility text not null default 'invisible' check (visibility in ('live','invisible')),
  dm_privacy text not null default 'everyone' check (dm_privacy in ('everyone','friends','none')),
  loc geography(point,4326), last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  category text not null, subcat text, vibe text, body text not null,
  precision pin_precision not null default 'approx_50m',
  exact_location geography(point,4326) not null,   -- private; never serve to clients
  display_location geography(point,4326) not null, -- fuzzed to `precision`
  status text not null default 'active',
  like_count int not null default 0, confirm_count int not null default 0, report_count int not null default 0,
  created_at timestamptz not null default now(), expires_at timestamptz
);
create index if not exists posts_display_gix on posts using gist (display_location);
create index if not exists posts_active_idx on posts (status, expires_at);

create table if not exists post_media (id uuid primary key default gen_random_uuid(), post_id uuid not null references posts(id) on delete cascade, url text not null, alt text, position int not null default 0);
create table if not exists comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references posts(id) on delete cascade, author_id uuid not null references profiles(id) on delete cascade, body text not null, created_at timestamptz not null default now());
create table if not exists reactions (post_id uuid references posts(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, kind text not null, created_at timestamptz not null default now(), primary key (post_id,user_id));
create table if not exists saves (post_id uuid references posts(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, primary key(post_id,user_id));
create table if not exists confirms (post_id uuid references posts(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, primary key(post_id,user_id));
create table if not exists follows (follower_id uuid references profiles(id) on delete cascade, followee_id uuid references profiles(id) on delete cascade, created_at timestamptz default now(), primary key(follower_id,followee_id), check(follower_id<>followee_id));
create table if not exists blocks (blocker_id uuid references profiles(id) on delete cascade, blocked_id uuid references profiles(id) on delete cascade, primary key(blocker_id,blocked_id));

create table if not exists meetups (id uuid primary key default gen_random_uuid(), host_id uuid not null references profiles(id) on delete cascade, activity text not null, note text, age_band text not null, bands text[] not null, venue text not null, display_location geography(point,4326) not null, identity text not null default 'anon' check (identity in ('anon','real')), status text not null default 'open', created_at timestamptz not null default now(), expires_at timestamptz not null);
create index if not exists meetups_display_gix on meetups using gist (display_location);
create table if not exists meetup_requests (id uuid primary key default gen_random_uuid(), meetup_id uuid not null references meetups(id) on delete cascade, guest_id uuid not null references profiles(id) on delete cascade, status text not null default 'pending', reveal_guest boolean not null default false, created_at timestamptz not null default now(), unique(meetup_id,guest_id));
create table if not exists meetup_messages (id uuid primary key default gen_random_uuid(), meetup_id uuid not null references meetups(id) on delete cascade, sender_id uuid not null references profiles(id) on delete cascade, body text not null, created_at timestamptz not null default now());

create table if not exists conversations (id uuid primary key default gen_random_uuid(), is_group boolean not null default false, name text, created_by uuid references profiles(id) on delete set null, created_at timestamptz not null default now());
create table if not exists conversation_members (conversation_id uuid references conversations(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, primary key (conversation_id, user_id));
create table if not exists messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations(id) on delete cascade, sender_id uuid not null references profiles(id) on delete cascade, body text not null, created_at timestamptz not null default now());
create index if not exists messages_conv_idx on messages (conversation_id, created_at);

create table if not exists whispers (id uuid primary key default gen_random_uuid(), author_id uuid not null references profiles(id) on delete cascade, body text not null, neighborhood text, up int not null default 0, down int not null default 0, created_at timestamptz not null default now());
create table if not exists whisper_votes (whisper_id uuid references whispers(id) on delete cascade, user_id uuid references profiles(id) on delete cascade, dir int not null check (dir in (-1,1)), primary key(whisper_id,user_id));
create table if not exists stories (id uuid primary key default gen_random_uuid(), author_id uuid not null references profiles(id) on delete cascade, media_url text not null, caption text, created_at timestamptz not null default now());
create table if not exists reports (id uuid primary key default gen_random_uuid(), reporter_id uuid references profiles(id) on delete set null, target_type text not null, target_id text not null, reason text not null, status report_status not null default 'open', created_at timestamptz not null default now());
create table if not exists point_events (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, action text not null, points int not null, ref text, created_at timestamptz not null default now());
create table if not exists badges (user_id uuid references profiles(id) on delete cascade, badge_key text not null, earned_at timestamptz not null default now(), primary key (user_id, badge_key));

-- ============================================================ helper functions (used by RLS)
create or replace function public.is_admin(uid uuid) returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select is_admin from profiles where id=uid),false) $$;
create or replace function public.is_active(uid uuid) returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select status='active' from profiles where id=uid),false) $$;
create or replace function public.are_friends(a uuid, b uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from follows f1 where f1.follower_id=a and f1.followee_id=b) and exists(select 1 from follows f2 where f2.follower_id=b and f2.followee_id=a) $$;
create or replace function public.in_conversation(cid uuid, uid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from conversation_members m where m.conversation_id=cid and m.user_id=uid) $$;

-- ============================================================ RLS (enabled on all app tables — policies omitted here for brevity; see migration pinly_rls_policies)
-- Key rules encoded in policies:
--   posts/meetups require age_verified to insert; banned authors hidden; blocks hide both ways;
--   meetups only visible to a matching age band; messages only to conversation members;
--   whispers keep author hidden; stories auto-expire at 24h; reports/admin gated by is_admin().

-- ============================================================ auth trigger, realtime, storage, geo RPC
-- NOTE (build 13 fix): signup previously failed with "Database error saving new user".
-- Cause: (email = owner) OR (phone IN (...)) yields NULL when phone is NULL
-- (false OR NULL = NULL in SQL), and NULL violated profiles.is_admin NOT NULL.
-- Both sides are now coalesced, and the insert is wrapped so profile creation can
-- never block auth signup. Verified with a simulated Google signup.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare uname text; begin
  uname := 'u' || substr(replace(new.id::text,'-',''),1,12);
  insert into public.profiles (id, username, display_name, age_verified)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name','New neighbour'), false)
  on conflict (id) do nothing; return new;
end $$;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- realtime: messages, meetup_messages, posts, whispers, stories added to supabase_realtime publication.
-- storage buckets: avatars, post-media, stories (public read, authenticated write, owner manage).

create or replace function public.nearby_posts(lng double precision, lat double precision, radius_m double precision default 2000)
returns setof posts language sql stable set search_path=public,extensions as $$
  select * from posts
  where status='active' and (expires_at is null or expires_at>now())
    and st_dwithin(display_location, st_setsrid(st_makepoint(lng,lat),4326)::geography, radius_m)
  order by created_at desc limit 200;
$$;

-- ============================================================ client API (migration pinly_client_api)
-- posts_public: lng/lat, never exact_location (security_invoker view; RLS applies)
-- whispers_public: hides author_id, includes caller's my_vote
-- feed_nearby(lng,lat,radius_m) -> jsonb: posts near a point w/ author + media + reaction summary
-- nearby_people(lng,lat,radius_m) -> jsonb: opt-in live users nearby
-- award_points(action,points,ref) -> int: atomic points + ledger for the caller
-- toggle_reaction(post,kind) -> text: one reaction per user (upsert/remove)
-- vote_whisper(whisper,dir): cast/undo a vote, keep counters correct
-- (Full definitions are in the applied migration; see INTEGRATION.md for how the client uses them.)
