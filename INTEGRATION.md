# Wiring the app to the live backend

The backend (Supabase) is live and the data layer (`supabase/live.js`) is written and
schema-correct. This is the finishing step: connect the front-end (`index.html`) to it and
verify on a deployed site. **Do this where the environment can reach `*.supabase.co`**
(a normal browser / your Netlify deploy — not this build sandbox, which blocks it).

## 0. Add the scripts (in `<head>` of index.html, before the app script)
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="./supabase/config.js"></script>
<script src="./supabase/live.js"></script>
```

## 1. Turn on auth providers (Supabase dashboard → Authentication → Providers)
- **Email** is on by default — `PinlyLive.auth.sendEmailCode(email)` / `verifyEmailCode(email, code)`
  works immediately (great for first testing).
- **Phone (SMS)** — recommended primary; add a Twilio/MessageBird account + keys.
- **Apple / Google** — add OAuth credentials.

## 2. Gate the app on auth
In `boot()`, branch at the very top:
```js
if (PinlyLive.configured()) { return startLive(); }   // real app
// ...otherwise the existing mock boot runs (demo mode)
```
`startLive()`:
1. `const session = await PinlyLive.auth.session();`
2. If no session → show a sign-in screen (reuse the age-gate overlay styles): email field →
   `sendEmailCode` → code field → `verifyEmailCode`. On success continue.
3. `me = await PinlyLive.myProfile();` (the DB trigger already created the row).
4. If `!me.age_verified` → run the existing **age gate → setup wizard**, then
   `await PinlyLive.verifyAge(band)` and `PinlyLive.updateProfile({display_name, username, bio, avatar_url})`.
5. Hydrate `state` (see §3), then run the existing `initMap()/switchTab('map')` UI.
6. `PinlyLive.auth.onChange(...)` to handle sign-out.

## 3. Replace mock reads with live reads (hydrate `state`)
Map each mock source to a call; keep the existing render functions (they read `state`).

| Mock in index.html | Live call |
|---|---|
| `seedPosts()` / `state.posts` | `PinlyLive.feed(lng, lat, radiusM)` → map JSON rows to the post shape (they include `lng,lat,author_name,author_avatar,reaction_count,my_reaction,comment_count,media`) |
| `state.following` | `PinlyLive.myFollowing()` |
| `state.blocked` | `PinlyLive.myBlocks()` |
| `state.saved` | `PinlyLive.mySaves()` |
| `seedWhispers()` | `PinlyLive.whispers()` (author already hidden by the view) |
| `seedStories()` | `PinlyLive.activeStories()` |
| `seedConversations()` | `PinlyLive.myConversations()` |
| `seedMeetups()` | `PinlyLive.nearbyMeetups()` |
| `livePeople()` | `PinlyLive.nearbyPeople(lng, lat, radiusM)` |
| admin users | `PinlyLive.admin.allUsers()` / `PinlyLive.searchUsers(q)` |
| admin reports | `PinlyLive.admin.reports()` |

## 4. Replace mock writes with live writes (call, then update `state` + re-render)
| Action (mock) | Live call |
|---|---|
| publish pin | `PinlyLive.createPost({category,subcat,vibe,body,precision,exactLng,exactLat,dispLng,dispLat,mediaFiles,expiresAt})` |
| react | `PinlyLive.react(postId, kind)` |
| comment | `PinlyLive.addComment(postId, body)` |
| save | `PinlyLive.toggleSave(postId)` |
| follow / unfollow | `PinlyLive.follow(id)` / `unfollow(id)` |
| block / unblock | `PinlyLive.block(id)` / `unblock(id)` |
| send DM | `PinlyLive.sendMessage(convId, body)` (+ `subscribeMessages` for realtime) |
| new DM / group | `PinlyLive.dmWith(userId)` / `createGroup(ids, name)` |
| create meetup / request / respond | `PinlyLive.createMeetup(...)` / `requestMeetup(id)` / `respondRequest(reqId, accept)` |
| post / vote whisper | `PinlyLive.createWhisper(body, hood)` / `voteWhisper(id, dir)` |
| post story | `PinlyLive.createStory(file, caption)` |
| report | `PinlyLive.report(type, targetId, reason)` |
| ban / restrict | `PinlyLive.admin.setStatus(id, status)` |
| avatar/photo upload | `PinlyLive.uploadImage('avatars', dataUrl)` → save url via `updateProfile({avatar_url})` |
| award points | `PinlyLive.award(action, points, ref)` (already called inside create/whisper/story) |

## 5. Realtime
- New nearby pins: subscribe to `posts` INSERTs (or re-poll `feed` on an interval).
- DMs: `PinlyLive.subscribeMessages(convId, msg => …)`.
- Presence: on app focus/interval, `PinlyLive.updateLocation(lng,lat)` if visibility is `live`.

## 6. Safety hardening (before public launch)
- Move location **fuzzing** and photo **EXIF stripping** to a Supabase **Edge Function** on the
  write path so the client isn't trusted. (`display_location` is currently computed client-side.)
- Serve posts through `posts_public` / `feed_nearby` (done — they never expose `exact_location`).
- Add rate limits and moderation automation (see `docs/TRUST_AND_SAFETY.md`).

## 7. Verify
Deploy, sign in with an email code on two devices/browsers, and confirm: post appears for the
other user, reactions/comments sync, DMs arrive in realtime, blocks hide content, a banned
account's content disappears. Then wire the remaining surfaces the same way.
