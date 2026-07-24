# Pin Drop — Trust & Safety plan

> Pin Drop is an **18+** app that shares **approximate location**, hosts **meetups between
> strangers**, and supports **direct messages**. That combination carries real safety and
> legal responsibility. This document is the operating plan; treat it as a launch gate, not
> a nice-to-have. **Have a lawyer review the legal docs before public launch.**

## 1. Age assurance (18+)
- **Now:** self-attested 18+ gate on first run, remembered per device; age band captured for meetup matching.
- **Before public launch, strengthen for meetups specifically:**
  - Require re-confirmation of 18+ before a user can *host or join* a meetup.
  - Add a stronger check for meetups (options, cheapest → strongest): email/phone verification → payment-card age signal → third-party ID/age-estimation vendor (e.g. Yoti, Persona, Veriff).
- Store `age_verified` server-side (done in schema). Never trust the client alone — enforce in RLS (done: posting/meetups require `age_verified`).

## 2. Identity & anti-abuse
- **Phone-number sign-in** (recommended primary auth): one real phone ≈ one real person — the single most effective anti-bot / anti-spam measure.
- Rate limits: pins/day, meetups active at once (3), meetup requests/day, messages/min, whispers/hour.
- New-account cool-downs before hosting meetups or DMing strangers.
- Device/IP signals for repeat offenders (server-side).

## 3. Location privacy (core promise)
- Never publish exact coordinates. Enforce **server-side fuzzing** to the user's chosen precision (exact spot is stored privately in `posts.exact_location`, only `display_location` is served — enforce via a view/RPC that omits `exact_location`).
- Meetups are **always block-level**, snapped to a **public venue** — never a home.
- Live presence is **opt-in and off by default**; "invisible" means invisible.
- Strip EXIF/GPS from uploaded photos on upload (do this in the storage upload path / an edge function).

## 4. Meetup safety (highest-risk surface)
- Public venues only; show a safety card every time (present in the app).
- "Tell a friend": one tap to share *"I'm meeting [alias] at [venue] at [time]"* to a contact.
- Easy **leave** that closes the chat; **block** always one tap away.
- No exact location exchange in-product.
- Anonymous by default; real identity only on **mutual** reveal.
- Consider a check-in / "I got home safe" nudge after a meetup window.
- Emergency resources link (local emergency number) in the meetup UI.

## 5. Content moderation
- **Report → review → action** pipeline (admin dashboard is the seed).
- Auto-hide content at a report threshold pending review (client already does 3; move the source of truth server-side).
- Proactive filters: text classifier for slurs/threats/sexual content involving minors (zero tolerance), image classifier (nudity/CSAM). **CSAM: report to NCMEC (US) / local authority — legally required.**
- Human review queue with SLA (e.g. emergencies < 1h, other < 24h).
- Ban / restrict / shadow-limit tooling (in the admin dash; enforce via `profiles.status` in RLS — done).
- Appeals path.

## 6. User controls (present in-app, keep enforced server-side)
- Block (two-way hide), mute, report, hide replies, DM privacy (everyone/friends/none), presence off, delete content, export data, delete account (grace period).

## 7. Notifications & consent
- Explicit opt-in for push; quiet hours; emergencies exempted.
- Clear consent for location use at the OS prompt and in-app.

## 8. Data handling
- Minimise: only collect what features need.
- Encrypt in transit (HTTPS) and at rest (Supabase default).
- Retention: expire ephemeral content (stories 24h, meetup chats with the meetup); define retention for messages, reports, logs.
- Honour deletion + export (GDPR/CCPA) — see Privacy Policy.

## 9. Incident response
- Runbook for: safety incident at a meetup, data breach, CSAM report, mass-abuse event.
- A contact channel users can reach for safety issues, monitored.

## 10. Launch gate checklist
- [ ] Phone auth + rate limits live
- [ ] Server-side location fuzzing + EXIF stripping
- [ ] Meetup 18+ re-check + public-venue enforcement + "tell a friend"
- [ ] Report pipeline + human review + CSAM reporting path
- [ ] ToS + Privacy Policy + Community Guidelines published and **lawyer-reviewed**
- [ ] Age-assurance approach documented and defensible for your launch region
- [ ] Way for users to contact you about safety
