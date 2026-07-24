# Pin Drop / Pinly — Project Handoff

Paste or upload this into a new session to continue. It captures the full state.

## What the app is
A phone-first **18+ neighbourhood social map** ("Pin Drop", branding sometimes "Pinly").
Users drop location **pins** (social/event/hazard/lost/found), see what's happening nearby,
post **stories**, an anonymous **Whispers** feed, **DMs + group chats**, **live presence**,
anonymous or real **meetups**, **daily tasks**, streaks, points/badges, a **Super Spot** bonus,
and a full **admin dashboard**. Dark + light themes. It's an installable **PWA**.

## Current architecture
- **Front-end:** ONE self-contained file, `index.html` (~265 KB), vanilla HTML/CSS/JS, MapLibre
  for the map (CARTO dark-matter/positron vector tiles, keyless). All state in a client `state`
  object; synchronous render functions read from it.
- **Data:** currently **mock/in-browser** — fully functional for demos, but no real multi-user
  data yet.
- **Backend:** **Supabase project is LIVE and provisioned** (empty of user rows). Not yet wired
  to the front-end. This is the main remaining work.

## Repos (GitHub push is blocked on the mohsenbagheri5191-design account — write access not granted)
- `mohsenbagheri5191-design/Dexi5191` (branch `claude/social-app-completion-9t1b3z`)
- `mohsenbagheri5191-design/pinly-app`
- New target: `mohsenba-eng/Pinly-app-new` (different owner — a session rooted there may be able to push)
Everything is committed locally in the first two; to deploy, upload the files or push once
write access works.

## Supabase backend (LIVE)
- Project ref: `arzprijpiblzyzkedsno` — API URL `https://arzprijpiblzyzkedsno.supabase.co`
- Publishable key (public, safe in client): `sb_publishable_cEk6HxHW5mTygwttZjL7nw_lkDrbARD`
- **21 tables, all with RLS**: profiles, posts, post_media, comments, reactions, saves, confirms,
  follows, blocks, meetups, meetup_requests, meetup_messages, conversations, conversation_members,
  messages, whispers, whisper_votes, stories, reports, point_events, badges.
- PostGIS geo + `nearby_posts(lng,lat,radius_m)` RPC. Auth→profile trigger. Realtime on
  messages/meetup_messages/posts/whispers/stories. Storage buckets: avatars, post-media, stories.
- Full DDL: `supabase/schema.sql`. Client config: `supabase/config.js`.
- Known lint: `spatial_ref_sys` RLS disabled (PostGIS reference table, harmless; optional fix in BACKEND.md).

## Files in the repo
- `index.html` / `pin-drop.html` — the app (identical)
- `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png` — PWA
- `netlify.toml`, `vercel.json`, `DEPLOY.md` — hosting
- `BACKEND.md` — backend status + integration plan
- `supabase/schema.sql`, `supabase/config.js`
- `docs/TRUST_AND_SAFETY.md`, `docs/COMMUNITY_GUIDELINES.md`
- `legal/TERMS_OF_SERVICE.md`, `legal/PRIVACY_POLICY.md` (drafts; lawyer review — user has consulted a lawyer)
- `README.md`, `HANDOFF.md` (this file)

## What's DONE
- Complete, tested front-end (all features above) on mock data. 30+ automated UI flows pass.
- Live Supabase schema + RLS + auth trigger + realtime + storage.
- PWA + deploy config. Safety/legal drafts.

## What REMAINS (to "complete fully")
1. **Wire the front-end to Supabase** — the big one. Replace the mock data layer with real calls,
   keeping the existing UI (render from `state`, but hydrate/write `state` via Supabase).
   Order: auth → profiles/setup(age_verified) → posts (nearby feed + create + media upload) →
   reactions/comments/saves → follows/blocks → DMs (realtime) → meetups → whispers → stories →
   reports/admin → points/badges → presence.
2. **Auth providers** (Supabase dashboard): email OTP works out of the box; add **phone/SMS**
   (needs Twilio/MessageBird keys) and **Apple/Google** OAuth. Phone recommended primary (anti-spam).
3. **Server-side safety**: Edge Function to fuzz location + strip photo EXIF on write; a DB view
   that hides `posts.exact_location` and anon meetup `host_id`; rate limits; moderation automation.
4. **Native wrapper** later (Capacitor/Expo) for app stores + push notifications.

## Constraint for whoever continues
This sandbox cannot reach `*.supabase.co` (egress proxy blocks it), so Supabase-wired code must be
**verified on a deployed site / a session whose sandbox can reach Supabase**. Logic can be
unit-tested with a mocked client. Local UI tests use Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with a MapLibre stub (see scratchpad tests).

## Design system (for consistency)
Fonts: Bricolage Grotesque (display), Plus Jakarta Sans (body), Space Mono (mono).
Colors (dark): void #090B24, surface #191D4D, paper #EDEBFF, accents social #7C5CFF, cyan #35E5FF,
event #B15CFF, hazard #FFB020, found #22E5A3, lost #FF5CA8, meetup #35E5FF. Light theme via
`:root[data-theme="light"]`. Everything uses CSS variables.
