# Pinly — Project Handoff (build 13)

Paste or upload this into a new session to continue. It captures the full state.

---

## 1. What the app is
**Pinly** ("Local Place") — a phone-first **18+ neighbourhood social map**, shipped as an
installable **PWA**. Users drop location **pins** (social / event / hazard / be-aware / lost /
found / meetup), see what's happening nearby, post 24h **stories**, read an anonymous
distance-based **Whispers** feed, send **DMs + group chats** (with stickers), show **live
presence**, host anonymous or real-profile **meetups**, complete **daily tasks**, keep
**streaks**, earn **Golden Racoon Coins** 🪙 + badges, chase a weekly **Super Spot** reward
game, browse a **City** layer of live world data, and (for staff) use a full **admin
dashboard** with roles & permissions. Dark + light themes.

## 2. Live URLs & accounts
| Thing | Value |
|---|---|
| **Production app** | https://melodious-cheesecake-5f97f0.netlify.app |
| Netlify site | `melodious-cheesecake-5f97f0` (team: Mohsen B) — **only this site is configured for auth**; ignore the other Netlify sites (pinly-app, pinlyapp, etc.) |
| **Supabase project** | `arzprijpiblzyzkedsno` → https://arzprijpiblzyzkedsno.supabase.co |
| Publishable key (public, safe in client) | `sb_publishable_cEk6HxHW5mTygwttZjL7nw_lkDrbARD` |
| **GitHub repo** | `mohsenbagheri5191-design/Dexi5191` |
| Owner / admin account | `mohsen.bagheri5191@gmail.com` (auto-granted admin by DB trigger) |

## 3. Deployment — how it works now (IMPORTANT)
- Netlify is **connected to GitHub** and **auto-deploys the `main` branch**. Push to `main` → live in ~1 min.
- The whole app lives at the repo root (`index.html`, `supabase/`, PWA files). `netlify.toml` sets
  `publish = "."` and no build command.
- Working branch is `claude/social-app-completion-9t1b3z`; work is merged into `main` via PR to deploy.
- **Every build bumps two things** so caches actually refresh:
  - the visible tag `PINLY_BUILD` in `index.html` (shows on sign-in + Settings footer, e.g. "build 13")
  - the service-worker cache key in `sw.js` (e.g. `pinly-v13`)
- To confirm what's live: look at the build tag on the sign-in screen.

## 4. Architecture
- **Front-end:** ONE self-contained file `index.html` (~420 KB) — vanilla HTML/CSS/JS, MapLibre GL
  (CARTO dark-matter/positron vector tiles, keyless). Global `state` + `me` objects; synchronous
  render functions. `pin-drop.html` is an identical copy.
- **Backend:** Supabase — Postgres 17 + PostGIS, **RLS on every table**, Realtime, Storage
  (`avatars`, `post-media`, `stories`), RPCs, `security_invoker` views, auth→profile trigger.
- **Live bridge:** `supabase/live.js` exposes `window.PinlyLive`. `index.html` auto-detects it:
  - keys present + SDK loaded → **LIVE mode** (real sign-in + real data)
  - otherwise → **demo mode** (mock data, still fully clickable)
  - switch is `window.LIVE`; every backend call is wrapped in `liveSafe()` so a server error can
    never white-screen the UI. Reads hydrate `state`; writes are optimistic + write-through.
- **Edge Function `city`** (deployed, `verify_jwt=false`, public read-only) aggregates world data.

## 5. Design system (build 12–13)
- **Icons:** original **duotone SVG set (~56 icons)** in `ICONS` + `ICON(name,size,color)`.
  `EMOJI_ICON` + `uiIcon()` map legacy emoji tokens → SVG, so menus, notifications, badges,
  daily tasks, chips, vibes, settings, admin and map controls all render real icons.
  *Emoji remain only where they're content: chat stickers and post reactions.*
- **Currency:** `COIN(size)` draws the **Golden Racoon Coin** (gold coin + raccoon face). No 🦝 emoji left.
- **Avatars:** `CHARACTERS` = **29 hand-drawn SVG fantasy characters** (Star Mage, Moon Elf, Fang,
  Dragonlet, Pixie, Wisp, Bolt Kid, Sir Pebble, Skull King, Ghostie, Foxfire, Owlet, Sprout,
  Bubble, Cyclo, Mush, Robo, Alien, Kitsune, Wave Rider, Ember, Frost, Goblin, Nova, Sea Sprite,
  Pumpkin, Yeti, Phoenix, Slime) via `presetAvatar(i)` / `characterName(i)`. Users can also upload
  a photo (with crop/rotate editor).
- **Motion:** springy press states, tab icon lift + active indicator, menu slide-up, pop-in on
  selection, glow pulse on live layers; `prefers-reduced-motion` respected.
- Fonts: Bricolage Grotesque (display), Plus Jakarta Sans (body), Space Mono (mono).
- Colors (dark): void `#090B24`, surface `#191D4D`, paper `#EDEBFF`; accents social `#7C5CFF`,
  cyan `#35E5FF`, event `#B15CFF`, hazard `#FFB020`, aware `#FF5C5C`, found `#22E5A3`,
  lost `#FF5CA8`, meetup `#35E5FF`. Light theme via `:root[data-theme="light"]`.
- Branding: `logo.png` is loaded everywhere the logo appears — **replace that one file to rebrand**
  (falls back to `icon.svg`).

## 6. Auth (and the big bug that was fixed)
- Sign-in overlay offers **Continue with Google / Apple**, **Email** (magic link + code fallback),
  **Phone** (needs an SMS provider).
- Client config: `persistSession` + `autoRefreshToken` + `detectSessionInUrl`, `flowType:'implicit'`,
  `storageKey:'pinly-auth'` → users stay signed in across app closes. **Log out** is in Settings.
- `PinlyLive.auth.consumeRedirect()` explicitly reads `access_token` / `refresh_token` / `code` /
  `error` from the redirect URL and calls `setSession`. The sign-in overlay also subscribes to auth
  changes **and** polls, dismissing itself the moment a session appears → **no sign-in loop**.
  Sign-in errors are displayed, and the footer prints `location.host` to expose URL mismatches.
- 🔴 **FIXED (build 13):** new users hit *"Database error saving new user."* The `handle_new_user`
  trigger computed `(email = owner) OR (phone IN (...))`; with a NULL phone that whole expression
  is **NULL** (`false OR NULL = NULL`), which violated `profiles.is_admin NOT NULL` and aborted
  signup. It only worked for the owner because their email matched (`TRUE OR NULL = TRUE`).
  Both sides are now `coalesce()`d and the insert is wrapped so profile creation can never block
  signup. **Verified against the live DB** with a simulated Google signup.
- **Owner admin:** email `mohsen.bagheri5191@gmail.com` or phone `+16477702582` → auto `is_admin`.

## 7. Admin dashboard (6 tabs)
1. **Overview** — live metrics + items needing review.
2. **Admins** — *"Add an admin"* (searchable user picker) → grant **Full admin** or specific
   permissions; team list shows each admin's exact powers with **Edit permissions** / **Revoke**.
3. **Users** — search by ID / @username / name; Details, Ban, Restrict, Roles; Admin/Staff badges.
4. **Content** — moderate **Pins / Whispers / Stories / Meetups**: **View · Hide · Delete** + search.
5. **Reports** — review queue + history.
6. **Super** — set the Super Spot photo **prompt**, **reward title**, **reward detail** (code —
   winner-only), optional **reward image**, coins, and drop location.

Permissions are `profiles.perms text[]` (`ban`, `reports`, `superspot`, `users`), enforced by
`set_user_admin()` / `has_perm()` in the database — not just the UI.

## 8. Supabase schema
**Tables (all RLS):** profiles (+`perms`), posts, post_media, comments, reactions, saves, confirms,
follows, blocks, meetups, meetup_requests, meetup_messages, conversations, conversation_members,
messages, whispers (+`loc`), whisper_votes, stories, story_views, reports, point_events, badges,
super_spots (+`reward_image`).
**Views:** `posts_public`, `whispers_public` (approx lng/lat + `is_mine` + `my_vote`),
`super_spots_public` (hides `reward_detail` from non-winners).
**RPCs:** `feed_nearby`, `nearby_people`, `award_points`, `toggle_reaction`, `vote_whisper`,
`set_super_spot`, `claim_super_spot`, `set_user_admin`, `has_perm`; trigger `handle_new_user`.
Full DDL: `supabase/schema.sql`.

## 9. Map / City data (works worldwide, follows navigation)
`cityFollowMap()` refetches whenever the map is panned >1.5 km — data is **not** limited to your
own location. Layers panel (🗺 button) toggles each of the **7 pin categories** and each
**city source** independently, every one with its own small distinct marker:

| Layer | Source | Key needed? |
|---|---|---|
| **Events** | **Ticketmaster Discovery** — images, venue, date, ticket links | ⚠️ **needs free key** `TICKETMASTER_KEY` (developer.ticketmaster.com) — falls back to Toronto Open Data festivals |
| **Landmarks** | Wikipedia GeoSearch + thumbnails | no |
| **Food & fun** | OpenStreetMap Overpass (cafés, bars, restaurants, clubs, parks, museums…) | no |
| **Weather** | Open-Meteo (+ US AQI) | no |
| **News** | GNews, localised by reverse-geocode | key already set |

Set secrets in Supabase → Edge Functions → `city` → Secrets. Source lives at
`supabase/functions/city/index.ts`; function URL `<SUPABASE_URL>/functions/v1/city?lat=..&lng=..`.

## 10. Files in the repo
- `index.html` / `pin-drop.html` — the app (identical)
- `supabase/live.js` — data layer · `supabase/config.js` — public keys · `supabase/schema.sql` — DDL
- `supabase/functions/city/index.ts` — Edge Function source
- `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png`, `logo.png` — PWA
- `netlify.toml`, `vercel.json`, `DEPLOY.md`, `BACKEND.md`, `INTEGRATION.md`, `README.md`, `HANDOFF.md`
- `docs/TRUST_AND_SAFETY.md`, `docs/COMMUNITY_GUIDELINES.md`
- `legal/TERMS_OF_SERVICE.md`, `legal/PRIVACY_POLICY.md` (drafts; a lawyer has been consulted)

## 11. Tests
Playwright + a hand-written MapLibre stub, in the scratchpad (`test3`–`test12`, ~100 assertions):
demo UI flows, live bridge with a fake data layer (incl. **sign-in-loop regression**), city layer,
Super Spot + story views, whisper filters/edit/delete, post edit, logout, custom icons, layers
panel, admin content moderation + roles, coin, Admins tab, notification suppression, motion.
Run with `node testN.mjs`. Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## 12. Open items / what's next
1. **Ticketmaster key** → real events with photos (the one missing API key).
2. **Licensed illustrated avatar pack** — the reference pack the owner likes is paid/copyrighted;
   if licensed, drop the files in and wire them as the avatar picker. (29 drawn originals ship now.)
3. **Custom SMTP** (e.g. Resend + own domain) before high signup volume — Supabase's built-in email
   is rate-limited to a few per hour, project-wide.
4. **Server-side safety before public launch:** move location fuzzing + photo EXIF stripping into an
   Edge Function on the write path; add rate limits and moderation automation
   (see `docs/TRUST_AND_SAFETY.md`).
5. Optional: Apple sign-in (needs paid Apple dev account), phone/SMS (Twilio), native wrapper
   (Capacitor/Expo) for app stores + push.

## 13. Constraint for whoever continues in a sandbox
This build sandbox **cannot reach `*.supabase.co` or upload to Netlify** (egress proxy blocks them),
so Supabase-wired code is verified with a **mocked data layer** locally plus **server-side SQL checks
through the Supabase tool channel**, and confirmed on the deployed site. Deployment happens by
pushing to GitHub `main` (Netlify builds it) — not by uploading from the sandbox.
