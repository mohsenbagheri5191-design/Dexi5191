# Pinly — Project Handoff (build 15)

Paste or upload this into a new session to continue. It captures the full state.

---

## 1. What the app is
**Pinly** — a phone-first **18+ neighbourhood social map**, shipped as an installable **PWA**.
Users drop location **pins** (social / event / hazard / be-aware / lost / found / meetup), see
what's happening nearby, post 24h **stories**, read an anonymous distance-based **Whispers**
feed, send **DMs + group chats** (stickers, delete), show **live presence**, host anonymous or
real-profile **meetups** (with categories incl. Dating), complete **daily tasks**, keep
**streaks**, earn **Golden Racoon Coins** + badges, chase a weekly **Super Spot** photo game
(owner-reviewed), browse a **City** layer of live world data, and — for staff — use a full
**admin dashboard** with roles and permissions. Dark + light themes.

## 2. Live URLs & accounts
| Thing | Value |
|---|---|
| **Production app** | https://melodious-cheesecake-5f97f0.netlify.app |
| Netlify site | `melodious-cheesecake-5f97f0` — **only this site is configured for auth**; ignore the others |
| **Supabase project** | `arzprijpiblzyzkedsno` → https://arzprijpiblzyzkedsno.supabase.co |
| Publishable key (public, safe in client) | `sb_publishable_cEk6HxHW5mTygwttZjL7nw_lkDrbARD` |
| **GitHub repo** | `mohsenbagheri5191-design/Dexi5191` |
| Owner / admin account | `mohsen.bagheri5191@gmail.com` (auto-granted admin by DB trigger) |

## 3. Deployment
- Netlify **auto-deploys `main`**. Push to `main` → live in ~1 min. `netlify.toml` sets
  `publish = "."`, no build command; the app is at the repo root.
- Work happens on `claude/social-app-completion-9t1b3z` and merges to `main` via PR.
- **Every build bumps two things** so caches refresh: `PINLY_BUILD` in `index.html` (shown on the
  sign-in screen and in Settings) and the SW cache key in `sw.js` (`pinly-v15`).
- To confirm what's live: read the build tag on the sign-in screen.
- ⚠️ The build sandbox's **local git proxy can die mid-session**. If `git push origin` fails with
  `Failed to connect to 127.0.0.1:<port>`, push to the full HTTPS URL instead:
  `git push https://github.com/mohsenbagheri5191-design/Dexi5191 <branch>`. That succeeds but leaves
  the local `origin/...` tracking ref stale, which makes `git status` wrongly report unpushed
  commits — re-point it with `git update-ref` and verify against GitHub, not local state.

## 4. Architecture
- **Front-end:** ONE self-contained file `index.html` (~460 KB) — vanilla HTML/CSS/JS, MapLibre GL
  (CARTO vector tiles, keyless). Global `state` + `me` objects; synchronous render functions.
  `pin-drop.html` is an identical copy.
- **Backend:** Supabase — Postgres 17 + PostGIS, **RLS on every table**, Realtime, Storage
  (`avatars`, `post-media`, `stories`), RPCs, `security_invoker` views, auth→profile trigger.
- **Live bridge:** `supabase/live.js` exposes `window.PinlyLive`. `index.html` auto-detects it:
  keys present + SDK loaded → **LIVE mode**; otherwise **demo mode** (mock data, fully clickable).
  The switch is `window.LIVE`; every backend call is wrapped in `liveSafe()` so a server error can
  never white-screen the UI. Reads hydrate `state`; writes are optimistic + write-through.
- **Edge Function `city`** (deployed, `verify_jwt=false`) aggregates world data.

> 🔴 **The single most important lesson from build 14.** Demo simulators must be gated on
> `!window.LIVE`. `setInterval(simulateRealtime, 45000)` was ungated and injected fake pins from
> demo users into real accounts every 45 seconds — it looked like "data disappears on refresh".
> The same applied to fake meetup auto-accepts, canned chat replies and automatic profile reveals.
> **If you add anything simulated, gate it.**

## 5. Design system (build 15 — night-to-dawn)
Modelled on the owner's reference screens: deep indigo night at the top easing into lavender and
warm cream at the bottom, with a faint starfield.

- **Tokens:** `--void:#171A32`, `--ink:#1E2140`, `--surface:#2A2E52`, `--paper:#EDEFFF`,
  dawn ramp `--dawn-1/2/3` + `--cream`, `--glow`, and depth tokens
  `--depth-1/2/3`, `--inner-top`, `--ring`.
- **Depth is layered**, never flat: an ambient shadow plus a tighter contact shadow, an inner top
  highlight, glow rings on live elements, squircle cards (radius 24–34), glass chips, a lifted
  tab bar. Sheets use the dawn ramp with dark text.
- ⚠️ **The starfield is painted into `#app`'s `background-image` stack, deliberately.** An earlier
  attempt used `#app::before` plus `#app > *{position:relative;z-index:1}`, which silently
  overrode the tab bar's own positioning and made it unclickable. Don't reintroduce that.
- **Icons:** original duotone SVG set (~56) in `ICONS` + `ICON(name,size,color)`; `EMOJI_ICON` +
  `uiIcon()` map legacy emoji tokens to SVG. Emoji remain only where they're content (chat
  stickers, post reactions).
- **Avatars:** `PACK_AVATARS` = **17 illustrated characters** supplied by the owner (SVG Repo).
  Class names and gradient ids are **prefixed per avatar** so several inline safely on one page.
  `presetAvatar(i)` / `characterName(i)`; `AV_COUNT` is 17.
- **Currency:** `COIN(size)` draws the Golden Racoon Coin. ⚠️ **Still the drawn version** — the
  owner intends to supply a coin image; the archive they sent had avatars only.
- Fonts: Bricolage Grotesque (display), Plus Jakarta Sans (body), Space Mono (mono).

## 6. Auth
- Overlay offers **Google / Apple**, **Email** (magic link + code), **Phone** (needs SMS provider).
- Client config: `persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `flowType:'implicit'`,
  `storageKey:'pinly-auth'`. **Log out** is in Settings and calls `go_offline()` *before*
  `signOut()`, so you don't linger on the map.
- `consumeRedirect()` reads tokens/errors straight from the URL; the overlay also subscribes to
  auth changes **and** polls, so it dismisses the moment a session appears → no sign-in loop.
- 🔴 **Fixed in build 13, worth knowing:** `handle_new_user` computed
  `(email = owner) OR (phone IN (...))`; with a NULL phone the whole expression is **NULL**
  (`false OR NULL = NULL`), violating `profiles.is_admin NOT NULL` and aborting signup for
  everyone except the owner. Both sides are `coalesce()`d now and the insert is wrapped so profile
  creation can never block signup.
- **Profile setup runs once**, keyed on `profiles.profile_complete` — not on the auto-generated
  username, which never changed and made the wizard reappear on every sign-in.

## 7. Admin dashboard (6 tabs)
1. **Overview** — live metrics + items needing review.
2. **Admins** — add an admin (searchable picker) → **Full admin** or specific permissions; the team
   list shows each admin's exact powers with Edit / Revoke.
3. **Users** — search by ID / @username / name; Details, Ban, Restrict, Roles.
4. **Content** — moderate Pins / Whispers / Stories / Meetups: View · Hide · Delete.
5. **Reports** — review queue + history.
6. **Super** — configure the Super Spot **and review claim photos** (see §9).

Permissions are `profiles.perms text[]` (`ban`, `reports`, `superspot`, `users`), enforced by
`set_user_admin()` / `has_perm()` in the database — not just the UI.

## 8. Notifications (real, server-generated)
There is a `notifications` table written **only by SECURITY DEFINER triggers** — there is
deliberately **no insert policy**, so a client cannot forge one. Triggers cover: comment,
reaction, follow, message, meetup request, meetup response, meetup message, story view, plus
`super_approved` / `super_rejected` / `meetup_reveal`.

- `push_notification()` never notifies you about yourself, respects blocks, and can never abort the
  action that caused it.
- Client: `my_notifications(limit)` on load, realtime `subscribeNotifications(myId, cb)` for pushes,
  `mark_notifications_read(ids)` on tap, and tap-through navigation to the pin / thread / meetup /
  story. `notify()` (the old client-side helper) is **suppressed in LIVE mode**.

## 9. Super Spot — claims are reviewed, not auto-paid
Submitting a photo creates a **pending** `super_claims` row; nothing is awarded. The owner (or
anyone with the `superspot` permission) reviews it in Admin → Super. The card shows the photo plus
the three things that expose a fake:

| Signal | Stored as | Flagged when |
|---|---|---|
| Distance from the spot | `distance_m` (computed server-side via PostGIS) | > 400 m or unknown |
| Camera vs gallery | `source` — the composer uses a `capture="environment"` input for claims | not `camera` |
| When it was taken | `captured_at` vs the spot's `created_at` | predates the spot, or unknown |

`review_super_claim(claim, approve)` is what pays out: it credits the winner, closes the spot,
rejects every other pending claim on it, and notifies everyone. Verified end-to-end against the
live DB (claim `pending` → approve → +150 coins → winner notified), then rolled back.

## 10. Supabase schema
**Tables (all RLS):** profiles (+`perms`, `age`, `map_avatar`, `profile_complete`), posts,
post_media, comments, reactions, saves, confirms, follows, blocks, meetups (+`category`),
meetup_requests, meetup_messages, **meetup_reveals**, conversations, conversation_members,
messages, whispers (+`loc`), whisper_votes, stories, story_views, reports, point_events, badges,
super_spots, **super_claims**, **notifications**.

**Key RPCs:** `feed_nearby` (returns comments + reaction breakdown + saved), `meetups_nearby`
(returns requests + reveals), `nearby_people` (5-minute presence window), `my_conversations`,
`dm_with`, `create_group_conversation`, `my_notifications`, `mark_notifications_read`,
`my_stats` (lifetime totals — badges read from these, not from the loaded feed), `my_badges`,
`badges_of`, `go_offline`, `set_meetup_reveal`, `submit_super_claim`, `review_super_claim`,
`super_claims_queue`, `award_points`, `toggle_reaction`, `vote_whisper`, `set_super_spot`,
`set_user_admin`, `has_perm`. Trigger: `handle_new_user`.
Full DDL: `supabase/schema.sql`.

## 11. Map / City data (worldwide, follows navigation)
`cityFollowMap()` refetches whenever the map pans >1.5 km. The layers panel toggles the 7 pin
categories and each city source independently.

| Layer | Source | Key needed? |
|---|---|---|
| **Events** | Ticketmaster Discovery — images, venue, date, tickets | ⚠️ **needs free key** `TICKETMASTER_KEY` — falls back to Toronto Open Data |
| **Landmarks** | Wikipedia GeoSearch + thumbnails | no |
| **Food & fun** | OpenStreetMap Overpass | no |
| **Weather** | Open-Meteo (+ US AQI) | no |
| **News** | GNews, localised by reverse-geocode | key already set |

Basemap is recoloured on load by `enhanceBasemap()` using `BASEMAP_PALETTES` — water, parks,
buildings, **roads and labels** (labels get a dark halo so they stay readable on indigo).

## 12. Tests
Playwright + a hand-written MapLibre stub, in the scratchpad: **`test3`–`test13`, all passing**.
Run `node testN.mjs`. Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

⚠️ **Two traps that have bitten before:**
1. The suites run against `scratchpad/extracted/work.html`, **not** `index.html`. **Copy the file
   first** (`cp index.html .../extracted/work.html`) or you will test a stale build and get a
   meaningless pass.
2. The MapLibre stub's `Marker.addTo()` does **not** attach elements to the DOM. To assert on
   markers, read `presenceMarkers[i].opts.element` rather than querying the document.

`test5` is the live-bridge suite (fake `PinlyLive`, 36 assertions) covering notifications,
realtime DMs, comment hydration, badges-from-stats, the sign-in-loop regression, and that
`simulateRealtime` injects nothing in LIVE. `test13` covers the build-15 skin and the nine fixes.

## 13. Open items
1. **Coin image** — the owner wants their own coin art; the archive they sent had only avatars.
   Drop the file in and replace `COIN()`.
2. **Ticketmaster key** → real events with photos (the one missing API key).
3. **Custom SMTP** (e.g. Resend + own domain) before high signup volume — Supabase's built-in email
   is rate-limited project-wide.
4. **Server-side safety before public launch:** move location fuzzing + photo EXIF stripping onto
   the write path in an Edge Function; add rate limits and moderation automation.
5. Optional: Apple sign-in (paid Apple dev account), phone/SMS (Twilio), native wrapper for the
   app stores + push.

## 14. Sandbox constraints
This build sandbox **cannot reach `*.supabase.co`, `*.netlify.app` or most CDNs** (egress proxy).
So: Supabase-wired code is verified with a **mocked data layer** locally plus **server-side SQL
checks through the Supabase tool channel**, and deployment happens by pushing to GitHub `main`
(Netlify builds it) — never by uploading from here. You cannot fetch the live site to confirm a
deploy; check the build tag on the sign-in screen, or read `sw.js` on `main` via the GitHub tools.

**A pattern that works well for verifying real DB behaviour:** run the mutation inside a
`DO $$ ... $$` block and end with `raise exception 'RESULT ...'`. The message carries the numbers
back to you and the exception rolls the test data back automatically.
