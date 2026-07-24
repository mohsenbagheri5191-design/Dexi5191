# Deploy Pin Drop (Phase 0 — get it live)

Pin Drop is a static, self-contained site (`index.html` + a few assets). No build step.
Pick one host below — all take a couple of minutes. It installs as a PWA (Add to Home Screen).

## Files that must ship together
```
index.html                # the app
manifest.webmanifest       # PWA manifest
sw.js                      # service worker (offline shell)
icon.svg  icon-192.png  icon-512.png   # app icons
netlify.toml / vercel.json # host config (use the one for your host)
```

## Option A — Netlify (drag & drop, no account gymnastics)
1. Go to https://app.netlify.com/drop
2. Drag the whole project folder onto the page.
3. Done — you get a live URL like `https://your-name.netlify.app`. `netlify.toml` is picked up automatically.
4. (Optional) Add a custom domain in Site settings → Domain management.

## Option B — Vercel
1. Install once: `npm i -g vercel`
2. In the project folder: `vercel` (follow prompts) then `vercel --prod`
3. `vercel.json` is used automatically.

## Option C — GitHub Pages (free, tied to your repo)
1. Push these files to a GitHub repo (e.g. `mohsenba-eng/Pinly-app-new`).
2. Repo → Settings → Pages → Source: `main` branch, `/root`.
3. Your site: `https://<user>.github.io/<repo>/`.
   - Note: on a project page the app lives under a sub-path; the relative asset paths here (`./…`) handle that.

## Requirements for the PWA to work
- **HTTPS** (all three hosts above give you HTTPS automatically). Service workers only run on HTTPS (or localhost).
- Open the URL on your phone → browser menu → **Add to Home Screen**. It launches full-screen with the Pin Drop icon.

## Test locally first (optional)
```
cd this-folder
python3 -m http.server 8080
# open http://localhost:8080  (SW + manifest work on localhost)
```

## Current state (important)
This deploys the **prototype** — it runs on in-browser mock data, so it's perfect for demos,
a waitlist, and gathering feedback, but users don't yet share real accounts/data. The Supabase
backend is now provisioned (see `BACKEND.md`); wiring the app to it is the next step that turns
this into a real multi-user product.
