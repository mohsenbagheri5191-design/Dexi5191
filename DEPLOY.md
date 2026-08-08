# Deploying Pinly

The app is a static site — one `index.html` at the repo root plus a few assets. There is
no build step and no server, so it can be hosted anywhere that serves files.

---

## Current setup: GitHub Pages (free, no build credits)

**Live URL:** https://mohsenbagheri5191-design.github.io/Dexi5191/

GitHub Pages serves the repo directly. Push to `main` → live in about a minute. There is
no build allowance to run out, which is why we moved here.

### One-time setup (already done, recorded here for reference)

1. Repo → **Settings** → **Pages**
2. **Source:** "Deploy from a branch"
3. **Branch:** `main`, folder `/ (root)` → **Save**

`.nojekyll` at the repo root is required. Without it GitHub runs Jekyll over the site,
which silently drops files and folders beginning with an underscore.

### Supabase must know the URL

Auth redirects are validated against an allowlist, so the app's address has to be
registered or Google sign-in returns "requested path is invalid".

Supabase → **Authentication** → **URL Configuration**:

| Field | Value |
|---|---|
| Site URL | `https://mohsenbagheri5191-design.github.io/Dexi5191/` |
| Redirect URLs | `https://mohsenbagheri5191-design.github.io/Dexi5191/**` |

Keep any old entries as well — extra redirect URLs are harmless and let a previous
deployment keep working during a switchover.

Google Cloud Console does **not** need changing. The OAuth callback goes to Supabase's
own domain (`<project>.supabase.co/auth/v1/callback`), which never changes; only the
app's own return address does, and that is what the allowlist above covers.

### Why a sub-folder URL works

Every path in the app is relative (`./index.html`, `./supabase/live.js`, `./logo.png`),
`manifest.webmanifest` uses `"start_url": "./index.html"` and `"scope": "./"`, and the
service worker is registered as `./sw.js`. So the app runs correctly from
`/Dexi5191/` and is still installable to a phone home screen.

---

## Previous setup: Netlify

**URL:** https://melodious-cheesecake-5f97f0.netlify.app · site `melodious-cheesecake-5f97f0`

Still connected to GitHub and still serving whatever was last published, but **production
deploys are paused**: the free team ran out of build credits, so every deploy of `main`
after 30 July was marked *Skipped* while the site kept serving the July build. Netlify
shows this as a banner — "production deploys and Agent Runners are paused… upgrade your
team or wait for your next billing cycle to resume."

If you ever return to Netlify, the allowance resets on the team's monthly billing date
and deploys resume on their own; nothing in the repo needs changing. `netlify.toml` is
still present and correct.

> ⚠️ A skipped deploy is easy to misread as a caching problem. If the app looks stale,
> check **which commit the host actually published** before blaming the browser or the
> service worker. On Netlify that is Deploys → the top entry's commit ref.

---

## Other hosts

Anything that serves static files works: Cloudflare Pages, Vercel, S3 + CloudFront, or
plain nginx. Point it at the repo root, no build command. Wherever you land, add that
origin to Supabase's redirect allowlist as above.

## Cache behaviour

`sw.js` uses a versioned cache key (`pinly-vN`) and network-first for the app HTML, so a
new build lands on the next load rather than being pinned by the service worker. Bump
both `PINLY_BUILD` in `index.html` and `CACHE` in `sw.js` on every release — the visible
build tag on the sign-in screen is how you confirm what is actually live.
