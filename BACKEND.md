# Pin Drop — Backend (Supabase)

The backend is **provisioned and live** on the connected Supabase project.

- **Project:** `mohsenbagheri5191-design's Project` (`arzprijpiblzyzkedsno`), region ca-central-1, Postgres 17 + PostGIS.
- **API URL:** `https://arzprijpiblzyzkedsno.supabase.co`
- **Publishable key:** `sb_publishable_cEk6HxHW5mTygwttZjL7nw_lkDrbARD` (public; see `supabase/config.js`)

## What's already set up
- **21 tables** with **Row Level Security** on every one: `profiles, posts, post_media, comments,
  reactions, saves, confirms, follows, blocks, meetups, meetup_requests, meetup_messages,
  conversations, conversation_members, messages, whispers, whisper_votes, stories, reports,
  point_events, badges`.
- **PostGIS** geography columns for locations + a `nearby_posts(lng, lat, radius_m)` RPC.
- **RLS rules** that already encode the app's promises: posts/meetups require `age_verified`;
  banned users (`status`) are hidden; blocks hide content both ways; meetups only visible to a
  matching age band; DM messages only readable by conversation members; whispers keep the
  author hidden; stories auto-expire at 24h.
- **Auth → profile trigger:** a `profiles` row is created automatically on signup.
- **Realtime** enabled on `messages, meetup_messages, posts, whispers, stories`.
- **Storage buckets** (public read, authenticated write): `avatars, post-media, stories`.

Source of truth for the schema: `supabase/schema.sql`.

## Still to do on the backend (before/at launch)
1. **Auth providers** — enable in the Supabase dashboard (Authentication → Providers):
   - **Phone (SMS)** — recommended primary; needs an SMS provider (Twilio/MessageBird) + their keys.
   - **Apple** + **Google** OAuth (required for iOS / frictionless Android later).
   - Configure email templates / OTP as desired.
2. **Server-side location fuzzing + EXIF stripping** — do it in an Edge Function on the write path
   so the exact point is never trusted from the client and photos are cleaned on upload.
3. **A read view that omits `posts.exact_location`** (and a meetups view that hides `host_id` for
   anonymous meetups) so private fields can't be selected by clients.
4. **Rate limits & abuse controls** (see `docs/TRUST_AND_SAFETY.md`).
5. **Moderation/automation** — a report-threshold auto-hide and CSAM/text/image classification hook.

## Wiring the app to it (the big next step)
The current `index.html` is the **front-end prototype on mock data**. To make it real:
1. Add the Supabase JS client and `supabase/config.js` to the page.
2. Build an **auth flow** (phone-first): sign-in screen → on success, load/create the profile,
   and gate the 18+ age step to write `age_verified`.
3. Replace the mock read/write functions with Supabase calls, feature by feature, in this order
   (each is a self-contained slice):
   **profiles → posts (create + `nearby_posts` feed) → reactions/comments/saves → follows/blocks →
   DMs (realtime) → meetups → whispers → stories → reports/admin → points/badges.**
4. Swap the simulated realtime (presence, new pins, chat replies) for Supabase Realtime channels.
5. Upload photos to Storage instead of object URLs.

This is a multi-session build. The schema is designed to map 1:1 onto the app's existing data
shapes, so it's mostly a "replace the data layer" job rather than a redesign.
