# Pin Drop — a live neighbourhood map (18+)

Pin Drop is a phone‑first social app built around a real map. People drop **pins**
(social spots, alerts, lost & found) that live for a chosen lifetime, and adults can
post **anonymous meetups**. It ships as a single self‑contained `index.html` — open it
in any modern phone browser (or **Add to Home Screen** for a full‑screen app feel).

> This is the front‑end / design build. Every flow runs in‑browser with mock data so you
> can try the whole product on a phone today. Where a real backend would take over, the
> code is marked at the exact API call, and a starting Supabase schema is in
> [`supabase/schema.sql`](supabase/schema.sql).

## Run it

- **Fastest:** open `index.html` in a mobile browser.
- **Hosted:** serve the repo statically (GitHub Pages, Netlify, `python3 -m http.server`)
  and open the root URL on your phone. `index.html` is the entry point.

No build step, no keys required. It needs internet for the map tiles, fonts and demo photos.

## What's in this release

This build completes the app against the eight requested items:

1. **Meetups are unified with the map.** Meetups now appear as anonymous cyan `◎`
   markers on the main map (not just the Meet tab), gated to 18+ and your age band.
   They stay anonymous by design — a meetup never links to a real account profile
   until *both* people choose to reveal, at which point you can open the revealed profile.
2. **A visible dark map.** Switched from the flat `dark_all` raster to CARTO's
   **dark‑matter vector** basemap, then recoloured water, parks and buildings so they read
   clearly while keeping the night theme. Falls back to a raster basemap automatically if
   the vector tiles can't load, so the map is never blank.
3. **18+ age gate.** A one‑time welcome gate asks you to confirm you're 18+ and pick an
   age band (used for meetup matching). The choice is remembered, so it only asks once.
   Under‑18 is blocked, by design.
4. **People & profiles.** Tap any author (on a pin, comment, list or the leaderboard) to
   open their profile. Profiles show **followers / following / friends** as tappable,
   browsable lists with follow buttons. Meetup aliases stay anonymous.
5. **Richer posting categories.** Social pins now pick from 15 useful *spot types* —
   Food & Drink, Live Event, Live Music, Deal, Free Stuff, View, Sports, Market, Nature,
   Nightlife, Art, Study, Pets, Help, Local Tip — shown as badges on cards and detail.
6. **A real avatar picker.** 18 distinct generated avatars plus photo upload, with a
   proper tap‑to‑change picker reachable from the profile avatar and Settings.
7. **Aspirational badges.** Tiered medallions (Bronze / Silver / Gold / Elite) with live
   progress bars and clear goals, plus a badge detail sheet showing how to earn each one.
8. **Admin dashboard.** A moderation console (Overview / Users / Reports) to **ban**,
   **restrict** or reinstate users and action the report queue. Bans take effect
   immediately across the app. Reachable from **Settings → Moderation** for admins.

## Feature tour

- **Map** — free pan/pinch‑zoom, urgency‑coloured clustering, teardrop radar markers for
  Fire/Hazard, meetups on the map, radius ring, long‑press to drop, live neighbourhood + coords.
- **Drop** — crosshair placement, required photo, per‑category lifetime, spot‑type picker,
  exact/50 m/block precision, live countdown + client‑side expiry.
- **Feed / Search** — sort (Newest/Nearest/Top/Expiring), trending tags, and search across
  Pins / People / Tags.
- **Detail** — like / save / follow, "I see it too" confirm on emergencies, comments,
  hashtag filtering, resolve for Lost/Found, and a per‑post moderation menu.
- **Meet** — the 18+ gate, age‑band matching, anonymous aliases, block‑level venues,
  request → accept → ephemeral chat → mutual reveal.
- **You** — points & levels, badge shelf, city leaderboard, Pins/Saved/Archive tabs,
  full settings (privacy, notifications, blocked/muted, data export, account deletion).

## Tech

- Vanilla HTML/CSS/JS in one file, no framework, no bundler.
- [MapLibre GL JS](https://maplibre.org/) for the map.
- CARTO keyless basemaps; Google Fonts (Bricolage Grotesque / Plus Jakarta Sans / Space Mono).
- Accessibility: focus styles, ARIA labels, reduced‑motion support, safe‑area insets.

## Connecting a backend (Supabase)

The client is structured to map cleanly onto Supabase (Postgres + PostGIS + Storage + Realtime).
[`supabase/schema.sql`](supabase/schema.sql) is a starting migration with the core tables
(profiles, posts, media, comments, follows, saves, meetups, reports, bans, points) and
Row Level Security, including the 18+ / admin / ban rules the UI already enforces client‑side.
