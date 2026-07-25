# Live backend integration — DONE (how it works + go-live checklist)

The front-end (`index.html`) is now **wired to Supabase**. It auto-detects the backend and
runs in one of two modes with **zero config switches**:

- **LIVE mode** — when `@supabase/supabase-js` loads *and* `supabase/config.js` has real keys.
  Users sign in, and all data (pins, feed, DMs, meetups, whispers, stories, presence, admin)
  comes from Supabase.
- **Demo mode** — the original mock build. Runs automatically if Supabase can't load (offline,
  blocked CDN, missing keys). Nothing breaks; it's the safe fallback.

The switch is `window.LIVE` (set near the top of the app script). Every backend call is wrapped
in `liveSafe(...)` so a server error can **never white-screen the UI** — it logs and the
optimistic local update stays.

## What was wired (all in `index.html`)
- **Scripts** added to `<head>`: supabase-js CDN + `./supabase/config.js` + `./supabase/live.js`.
- **`startLive()`** replaces `boot()` in LIVE mode: session check → email-OTP sign-in overlay →
  load profile → geolocate → hydrate `state` → render the existing UI → age-gate/setup if the
  profile is still on defaults → start realtime + presence heartbeats.
- **Hydration mappers** convert Supabase rows to the exact mock shapes the render functions
  already expect (posts, whispers, stories, conversations, meetups, presence, admin users +
  reports). Geography columns are decoded from **EWKB hex / GeoJSON / WKT** (`coordOf`).
- **Write-through hooks** (optimistic local update + background Supabase write) on: create post
  (+media upload), react, comment, save, follow/unfollow, block/unblock, report, admin ban,
  whisper create+vote, story create, DM send (+lazy conversation create +realtime subscribe),
  meetup create, and profile/privacy edits (name, bio, username, age band, DM privacy,
  visibility, avatar upload, age verification, setup-wizard finish).
- **Realtime**: DM messages via `subscribeMessages`; feed re-polls every 45s; presence location
  heartbeat every 60s when visibility is `live`.

Verified locally with a fake data layer (`scratchpad/test5.mjs`, 20 assertions): sign-in flow,
every hydration mapping, EWKB/GeoJSON parsing, presence, admin, and a write-through publish.
Demo mode still passes its 29 UI flows (`test3.mjs`, `test4.mjs`).

## Go-live checklist (dashboard + deploy — the only remaining human steps)
1. **Auth providers** (Supabase → Authentication → Providers):
   - **Email** is on by default. **Important:** for the 6-digit code to arrive, edit the email
     template (Authentication → Email Templates → *Magic Link*) to include `{{ .Token }}` — the
     default template only sends a magic-link URL. With the token present, the in-app code entry
     works. (Or switch the app to magic-link and handle the redirect.)
   - **Phone (SMS)** — recommended primary; add Twilio/MessageBird keys, then swap the sign-in
     overlay to `sendPhoneCode`/`verifyPhoneCode` (both already exist in `live.js`).
   - **Apple / Google** OAuth for frictionless mobile (`PinlyLive.auth.oauth('google')`).
2. **Deploy** the folder (Netlify/Vercel configs are included). Serve over HTTPS so geolocation
   and the service worker work.
3. **First smoke test on the deploy:** open on two devices, sign in with email codes, and confirm
   a pin from one appears for the other, reactions/comments sync, DMs arrive in realtime, blocks
   hide content, and a banned account disappears.

## Safety hardening before public launch (see `docs/TRUST_AND_SAFETY.md`)
- Move location **fuzzing** + photo **EXIF stripping** to a Supabase **Edge Function** on the
  write path (right now `display_location` is computed client-side). Serving reads through
  `feed_nearby` / `posts_public` already keeps `exact_location` off the wire.
- Rate limits + report-threshold auto-hide + CSAM/text/image classification hook.

## Known client-side limitations (fine for v1, tighten later)
- Admin phone/email columns live in `auth.users`, not `profiles`, so they show blank in the admin
  panel until you add a secure admin-only view/RPC that surfaces them.
- Points are awarded both optimistically (client) and authoritatively (server RPC); the server
  value wins on next load. No double-count persists.

## City data layer (Toronto events / places / weather / news)
The app has a **City** toggle (🏙️ on the map). It calls a Supabase **Edge Function** named
`city` that fetches data server-side (so API keys never touch the client):
- **Weather + air quality** — Open-Meteo (keyless) ✅ works out of the box
- **Places & attractions** — Wikipedia GeoSearch (keyless) ✅ works out of the box
- **Events & festivals** — City of Toronto Open Data (keyless) ✅ best-effort
- **Local news** — GNews. **Needs a free key:**
  1. Sign up at https://gnews.io → copy your API token
  2. Set it as a secret (Supabase dashboard → Edge Functions → `city` → Secrets, or CLI):
     `supabase secrets set GNEWS_API_KEY=your_token`
  3. That's it — news appears in the City layer automatically.

Function URL: `<SUPABASE_URL>/functions/v1/city?lat=..&lng=..` (deployed, `verify_jwt=false`, public read-only).
If Supabase isn't configured, the app falls back to keyless weather + places directly.

## Staying signed in
The Supabase client is configured with `persistSession` + `autoRefreshToken` (+ PKCE), so a
signed-in user stays signed in across app closes and token expiry — no repeated logins.
On iOS, **installing to the home screen** (Add to Home Screen) makes that storage durable;
in a plain Safari tab, iOS may clear it after ~7 days of no use.
