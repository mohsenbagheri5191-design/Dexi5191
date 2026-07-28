# Pinly — Project Handoff (build 10)

Paste or upload this into a new session to continue. It captures the full state.

## What the app is
**Pinly** ("Local Place") — a phone-first **18+ neighbourhood social map** (PWA). Users drop
location **pins** (social / event / hazard / be-aware / lost / found / meetup), see what's nearby,
post **stories**, an anonymous distance-based **Whispers** feed, **DMs + group chats**, **live
presence**, anonymous or real **meetups**, **daily tasks**, streaks, **Golden Racoon Coins** (🦝)
+ badges, a weekly **Super Spot** reward game, a **City** layer of live Toronto data, and a full
**admin dashboard** with roles/permissions. Dark + light themes. Installable PWA.

## Live URLs & accounts
- **App (production):** https://melodious-cheesecake-5f97f0.netlify.app  (Netlify site
  `melodious-cheesecake-5f97f0`, team = Mohsen B). This is the ONLY site whose Supabase auth is
  configured — ignore the other Netlify sites (pinly-app, pinlyapp, etc.).
- **Supabase project:** `arzprijpiblzyzkedsno` — https://arzprijpiblzyzkedsno.supabase.co
  - Publishable key (public, in `supabase/config.js`): `sb_publishable_cEk6HxHW5mTygwttZjL7nw_lkDrbARD`
- **GitHub repo:** `mohsenbagheri5191-design/Dexi5191`

## Deployment (IMPORTANT — how it works now)
- Netlify is connected to GitHub and **auto-deploys the `main` branch**. The whole app lives on
  `main` (root: `index.html` + `supabase/` + PWA files; `netlify.toml` sets `publish="."`).
- Day-to-day work happens on branch `claude/social-app-completion-9t1b3z`, then a PR is merged
  into `main`, which triggers the Netlify build. **Push to main = it goes live in ~1 min.**
- Build tag shows on the sign-in screen + Settings footer (e.g. "Pinly · build 10") so you can
  confirm which version is live. Service worker cache key is bumped each build (`pinly-vN`).

## Architecture
- **Front-end:** ONE self-contained file `index.html` (~330 KB), vanilla HTML/CSS/JS, MapLibre
  (CARTO dark-matter/positron vector tiles, keyless). Global `state` + `me` objects; synchronous
  render functions. `pin-drop.html` is an identical copy.
- **Backend:** Supabase (Postgres 17 + PostGIS, RLS on every table, Realtime, Storage buckets
  avatars/post-media/stories, RPCs, security_invoker views). Auth→profile trigger.
- **Live bridge:** `supabase/live.js` is the data layer (`window.PinlyLive`). `index.html`
  auto-detects it: if configured → **LIVE mode** (real sign-in + data); else **demo mode**
  (mock data). Switch = `window.LIVE`. Every backend call is wrapped in `liveSafe()` so a server
  error never breaks the UI. Reads hydrate `state`; writes are optimistic + write-through.
- **Edge Function `city`** (deployed, `verify_jwt=false`): aggregates weather/air (Open-Meteo),
  places (Wikipedia GeoSearch), events (Toronto Open Data), news (GNews — key embedded). Called
  by the 🏙️ City toggle.

## Auth
- Sign-in overlay: **Continue with Google / Apple**, or **Email** (magic link + code fallback),
  or **Phone** (needs an SMS provider). Client uses **implicit** flow + `persistSession` +
  `autoRefreshToken`, and `startLive()` waits for the redirect session to settle (fixes the
  "stuck on sign-in after Google" bug). **Logout** is in Settings.
- **Owner admin:** the account with email `mohsen.bagheri5191@gmail.com` or phone `+16477702582`
  is auto-granted `is_admin` (DB trigger). Admins can grant other users Full admin or selective
  staff permissions (ban / reports / superspot / users) from the Users tab → Roles.

## Supabase tables (all RLS)
profiles (+perms text[]), posts, post_media, comments, reactions, saves, confirms, follows,
blocks, meetups, meetup_requests, meetup_messages, conversations, conversation_members, messages,
whispers (+loc), whisper_votes, stories, story_views, reports, point_events, badges, super_spots.
Views: `posts_public`, `whispers_public` (approx lng/lat + is_mine + my_vote), `super_spots_public`
(reward_detail hidden from non-winners). RPCs: `feed_nearby`, `nearby_people`, `award_points`,
`toggle_reaction`, `vote_whisper`, `set_super_spot`, `claim_super_spot`, `set_user_admin`,
`has_perm`, auth trigger `handle_new_user`.

## Files in the repo
- `index.html` / `pin-drop.html` — the app
- `supabase/live.js` (data layer), `supabase/config.js` (public keys), `supabase/schema.sql`,
  `supabase/functions/city/index.ts` (Edge Function source)
- `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png`, `logo.png`
  (replace `logo.png` with your own artwork to rebrand — the app loads `./logo.png` everywhere)
- `netlify.toml`, `vercel.json`, `DEPLOY.md`, `BACKEND.md`, `INTEGRATION.md`, `README.md`
- `docs/TRUST_AND_SAFETY.md`, `docs/COMMUNITY_GUIDELINES.md`
- `legal/TERMS_OF_SERVICE.md`, `legal/PRIVACY_POLICY.md`

## What's DONE (through build 10)
All app features above, wired to Supabase and tested (Playwright suites in scratchpad). Admin
roles/permissions, Golden Racoon Coins, Super Spot game (admin prompt + reward + optional image),
story view counts + story photo editor, post photo editor + full post edit, whisper
report/edit/delete + distance & sort filters, City data layer, fantasy avatar set, PWA install,
persistent sessions + logout, notification tap-to-navigate. Continuous deploy from GitHub `main`.

## Open items / needs your input
1. **Entertainment events with photos** (concerts/parties/shows): needs a free **Ticketmaster
   API key** (developer.ticketmaster.com) wired into the `city` Edge Function. Current events are
   Toronto Open Data festivals (often no images).
2. **Exact illustrated avatar pack:** those specific fantasy illustrations are a paid icon pack —
   license them and drop the files in to wire an exact avatar picker. (Emoji fantasy set + photo
   upload work now.)
3. **Auth providers in Supabase dashboard:** ensure Google (and optionally Apple/phone) are
   enabled; email works. Set custom SMTP (e.g. Resend) before high signup volume.
4. **Server-side safety before public launch:** move location fuzzing + EXIF stripping to an Edge
   Function; rate limits; moderation automation (see docs/TRUST_AND_SAFETY.md).

## Constraint for whoever continues in a sandbox
This build sandbox cannot reach `*.supabase.co` / Netlify egress, so LIVE-wired code is verified
with a mocked data layer + on the deployed site. Local UI tests use Chromium at
`/opt/pw-browsers/chromium-1194/...` with a MapLibre stub (see scratchpad `test*.mjs`).
