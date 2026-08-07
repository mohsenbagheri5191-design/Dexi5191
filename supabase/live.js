/* ============================================================================
   Pinly — live data layer (Supabase).
   Drop-in replacement for the app's mock data. Requires, loaded before this:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="./supabase/config.js"></script>
   Then: PinlyLive.init();  and use its async methods (see INTEGRATION.md).

   Security model: the DATABASE (Row Level Security) is the authority. These calls
   run as the signed-in user; RLS enforces who can read/write what. Never ship the
   service_role key to the client.
   ============================================================================ */
(function (global) {
  var cfg = global.PINDROP_SUPABASE;
  var sb = null;

  function configured() { return !!(cfg && cfg.url && (cfg.publishableKey || cfg.anonKey) && global.supabase); }
  function client() {
    if (!sb) sb = global.supabase.createClient(cfg.url, cfg.publishableKey || cfg.anonKey, {
      auth: {
        persistSession: true,        // keep the session in localStorage across app closes
        autoRefreshToken: true,      // silently refresh so users don't get logged out
        detectSessionInUrl: true,    // complete the magic-link / OAuth redirect on return
        storageKey: 'pinly-auth',
        flowType: 'implicit'         // token comes back in the URL hash — most robust for a static PWA
      }
    });
    return sb;
  }
  function wkt(lng, lat) { return 'SRID=4326;POINT(' + lng + ' ' + lat + ')'; }
  function uuid() { return (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '' + Math.random()).replace('.', ''); }
  async function uid() { var s = await client().auth.getUser(); return s.data.user ? s.data.user.id : null; }

  /* ----- dataURL / File -> Blob for uploads ----- */
  function toBlob(input) {
    if (input instanceof Blob) return input;
    if (typeof input === 'string' && input.indexOf('data:') === 0) {
      var parts = input.split(','), mime = parts[0].match(/:(.*?);/)[1], bin = atob(parts[1]), n = bin.length, arr = new Uint8Array(n);
      while (n--) arr[n] = bin.charCodeAt(n);
      return new Blob([arr], { type: mime });
    }
    return null;
  }

  var PinlyLive = {
    configured: configured,
    init: function () { if (configured()) client(); return this; },
    raw: function () { return client(); },

    /* ---------------- Auth ---------------- */
    auth: {
      session: async function () { return (await client().auth.getSession()).data.session; },
      user: async function () { return (await client().auth.getUser()).data.user; },
      // Email one-time code (works with no SMS provider configured)
      // Sends the default Supabase email, which contains BOTH a magic sign-in link and
      // (if the template exposes {{ .Token }}) a 6-digit code. emailRedirectTo brings the
      // link back to this same page, where the session is auto-detected on return.
      sendEmailCode: function (email) { return client().auth.signInWithOtp({ email: email, options: { emailRedirectTo: (typeof location !== 'undefined' ? location.origin + location.pathname : undefined) } }); },
      verifyEmailCode: function (email, token) { return client().auth.verifyOtp({ email: email, token: token, type: 'email' }); },
      // Phone (requires an SMS provider configured in the Supabase dashboard)
      sendPhoneCode: function (phone) { return client().auth.signInWithOtp({ phone: phone }); },
      verifyPhoneCode: function (phone, token) { return client().auth.verifyOtp({ phone: phone, token: token, type: 'sms' }); },
      // OAuth (configure providers in the dashboard)
      oauth: function (provider) { return client().auth.signInWithOAuth({ provider: provider, options: { redirectTo: (typeof location !== 'undefined' ? location.origin + location.pathname : undefined) } }); },
      // Bulletproof redirect handling: consume tokens/errors straight from the URL.
      // Returns {session} on success, {error} on failure, or null when there's nothing to do.
      consumeRedirect: async function () {
        if (typeof location === 'undefined') return null;
        var raw = (location.hash || '').replace(/^#/, '') + '&' + (location.search || '').replace(/^\?/, '');
        if (!/access_token=|refresh_token=|[?&#]code=|error=/.test(raw)) return null;
        var p = new URLSearchParams(raw);
        var err = p.get('error_description') || p.get('error');
        var clean = function () { try { history.replaceState(null, '', location.origin + location.pathname); } catch (e) {} };
        if (err) { clean(); return { error: { message: decodeURIComponent(String(err).replace(/\+/g, ' ')) } }; }
        var at = p.get('access_token'), rt = p.get('refresh_token');
        try {
          if (at) {
            var r = await client().auth.setSession({ access_token: at, refresh_token: rt || '' });
            clean();
            if (r && r.error) return { error: r.error };
            return { session: (r && r.data && r.data.session) || null };
          }
          var code = p.get('code');
          if (code && client().auth.exchangeCodeForSession) {
            var x = await client().auth.exchangeCodeForSession(code);
            clean();
            if (x && x.error) return { error: x.error };
            return { session: (x && x.data && x.data.session) || null };
          }
        } catch (e) { clean(); return { error: { message: e && e.message ? e.message : 'Sign-in failed' } }; }
        return null;
      },
      signOut: function () { return client().auth.signOut(); },
      onChange: function (cb) { return client().auth.onAuthStateChange(function (_e, s) { cb(s); }); }
    },

    /* ---------------- Profiles ---------------- */
    async myProfile() { var id = await uid(); if (!id) return null; var r = await client().from('profiles').select('*').eq('id', id).single(); return r.data; },
    async getProfile(id) { return (await client().from('profiles').select('*').eq('id', id).single()).data; },
    async updateProfile(fields) { var id = await uid(); return client().from('profiles').update(fields).eq('id', id); },
    // Exact age is what the user enters; the band is derived so existing band-based
    // features (meetup matching) keep working.
    async verifyAge(age, band) { var id = await uid(); return client().from('profiles').update({ age_verified: true, age: age || null, age_band: band || null }).eq('id', id); },
    async myStats() { return (await client().rpc('my_stats')).data || {}; },
    async myBadges() { return (await client().rpc('my_badges')).data || []; },
    async grantBadge(key) { var id = await uid(); return client().from('badges').upsert({ user_id: id, badge_key: key }, { onConflict: 'user_id,badge_key', ignoreDuplicates: true }); },
    async searchUsers(q) {
      q = (q || '').replace(/^@/, '');
      return (await client().from('profiles').select('id,username,display_name,avatar_url,points,status').or('username.ilike.%' + q + '%,display_name.ilike.%' + q + '%,id.eq.' + q).limit(30)).data || [];
    },

    /* ---------------- Posts ---------------- */
    async feed(lng, lat, radius) { var r = await client().rpc('feed_nearby', { lng: lng, lat: lat, radius_m: radius || 3000 }); return r.data || []; },
    async createPost(p) {
      var id = await uid();
      var ins = await client().from('posts').insert({
        author_id: id, category: p.category, subcat: p.subcat || null, vibe: p.vibe || null, body: p.body,
        precision: p.precision || 'approx_50m',
        exact_location: wkt(p.exactLng, p.exactLat),
        display_location: wkt(p.dispLng, p.dispLat),
        expires_at: p.expiresAt || null
      }).select('id').single();
      if (ins.error) return ins;
      var postId = ins.data.id, i = 0;
      for (var m = 0; m < (p.mediaFiles || []).length; m++) {
        var url = await this.uploadImage('post-media', p.mediaFiles[m]);
        if (url) await client().from('post_media').insert({ post_id: postId, url: url, position: i++ });
      }
      await this.award('create_post', 10, postId);
      return { data: { id: postId } };
    },
    async deletePost(id) { return client().from('posts').update({ status: 'removed' }).eq('id', id); },
    async updatePost(id, fields) { return client().from('posts').update(fields).eq('id', id); },
    async deleteStory(id) { return client().from('stories').delete().eq('id', id); },
    async deleteMeetup(id) { return client().from('meetups').update({ status: 'removed' }).eq('id', id); },
    async setPostStatus(id, status) { return client().from('posts').update({ status: status }).eq('id', id); },

    /* ---------------- Reactions / comments / saves ---------------- */
    async react(postId, kind) { return (await client().rpc('toggle_reaction', { p_post: postId, p_kind: kind })).data; },
    async addComment(postId, body) { var id = await uid(); return client().from('comments').insert({ post_id: postId, author_id: id, body: body }); },
    async comments(postId) { return (await client().from('comments').select('*,profiles(display_name,username,avatar_url)').eq('post_id', postId).order('created_at')).data || []; },
    async delComment(id) { return client().from('comments').delete().eq('id', id); },
    async toggleSave(postId) { var id = await uid(); var ex = await client().from('saves').select('post_id').eq('post_id', postId).eq('user_id', id).maybeSingle(); if (ex.data) return client().from('saves').delete().eq('post_id', postId).eq('user_id', id); return client().from('saves').insert({ post_id: postId, user_id: id }); },
    async mySaves() { var id = await uid(); return (await client().from('saves').select('post_id').eq('user_id', id)).data || []; },

    /* ---------------- Follows / blocks ---------------- */
    async follow(target) { var id = await uid(); await this.award('follow', 0, target); return client().from('follows').insert({ follower_id: id, followee_id: target }); },
    async unfollow(target) { var id = await uid(); return client().from('follows').delete().eq('follower_id', id).eq('followee_id', target); },
    async myFollowing() { var id = await uid(); return ((await client().from('follows').select('followee_id').eq('follower_id', id)).data || []).map(function (r) { return r.followee_id; }); },
    async followersOf(target) { return ((await client().from('follows').select('follower_id').eq('followee_id', target)).data || []).map(function (r) { return r.follower_id; }); },
    async block(target) { var id = await uid(); await client().from('follows').delete().eq('follower_id', id).eq('followee_id', target); return client().from('blocks').insert({ blocker_id: id, blocked_id: target }); },
    async unblock(target) { var id = await uid(); return client().from('blocks').delete().eq('blocker_id', id).eq('blocked_id', target); },
    async myBlocks() { var id = await uid(); return ((await client().from('blocks').select('blocked_id').eq('blocker_id', id)).data || []).map(function (r) { return r.blocked_id; }); },

    /* ---------------- Direct messages ----------------
       All of these go through SECURITY DEFINER RPCs so a conversation is created
       atomically (both members inserted together) — the old client-side version
       could half-create a conversation and silently lose the thread. */
    async myConversations() { return (await client().rpc('my_conversations')).data || []; },
    async dmWith(otherId) { return (await client().rpc('dm_with', { p_other: otherId })).data; },
    async createGroup(memberIds, name) { return (await client().rpc('create_group_conversation', { p_members: memberIds || [], p_name: name || null })).data; },
    async messages(convId) { return (await client().from('messages').select('*').eq('conversation_id', convId).order('created_at')).data || []; },
    async sendMessage(convId, body) { var id = await uid(); return client().from('messages').insert({ conversation_id: convId, sender_id: id, body: body }).select('id').single(); },
    async deleteMessage(msgId) { return client().from('messages').delete().eq('id', msgId); },
    subscribeMessages: function (convId, cb) {
      return client().channel('msg:' + convId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId }, function (p) { cb(p.new); }).subscribe();
    },
    // One socket for every thread the user belongs to. RLS decides what actually
    // arrives, so this can never leak someone else's messages.
    subscribeAllMessages: function (cb) {
      return client().channel('msg:all').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (p) { cb(p.new); }).subscribe();
    },

    /* ---------------- Notifications (real, server-generated) ---------------- */
    async notifications(limit) { return (await client().rpc('my_notifications', { p_limit: limit || 80 })).data || []; },
    async markNotificationsRead(ids) { return client().rpc('mark_notifications_read', { p_ids: ids || null }); },
    subscribeNotifications: function (myId, cb) {
      return client().channel('notif:' + myId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + myId }, function (p) { cb(p.new); })
        .subscribe();
    },

    /* ---------------- Meetups ---------------- */
    // Returns each meetup together with its join requests (RLS limits requests to
    // the host and the guest who made them), so requests survive a refresh.
    async nearbyMeetups(lng, lat, radius) {
      if (typeof lng === 'number' && typeof lat === 'number')
        return (await client().rpc('meetups_nearby', { lng: lng, lat: lat, radius_m: radius || 25000 })).data || [];
      return (await client().from('meetups').select('*').eq('status', 'open').gt('expires_at', new Date().toISOString())).data || [];
    },
    async createMeetup(m) {
      var id = await uid();
      return client().from('meetups').insert({
        host_id: id, activity: m.activity, category: m.category || null, note: m.note || null, age_band: m.ageBand, bands: m.bands,
        venue: m.venue, display_location: wkt(m.lng, m.lat), identity: m.identity || 'anon', expires_at: m.expiresAt
      }).select('id').single();
    },
    async requestMeetup(meetupId) { var id = await uid(); return client().from('meetup_requests').insert({ meetup_id: meetupId, guest_id: id }); },
    async respondRequest(reqId, accept) { return client().from('meetup_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', reqId); },
    async cancelMeetupRequest(reqId) { return client().from('meetup_requests').delete().eq('id', reqId); },
    async meetupMessages(meetupId) { return (await client().from('meetup_messages').select('*').eq('meetup_id', meetupId).order('created_at')).data || []; },
    async sendMeetupMessage(meetupId, body) { var id = await uid(); return client().from('meetup_messages').insert({ meetup_id: meetupId, sender_id: id, body: body }); },

    /* ---------------- Whispers ---------------- */
    async whispers() { return (await client().from('whispers_public').select('*').order('created_at', { ascending: false }).limit(100)).data || []; },
    async createWhisper(body, hood, lng, lat) {
      var id = await uid(); await this.award('whisper', 3, null);
      var row = { author_id: id, body: body, neighborhood: hood || null, up: 1, down: 0 };
      if (typeof lng === 'number' && typeof lat === 'number') { var r = function (n) { return Math.round(n * 300) / 300; }; row.loc = wkt(r(lng), r(lat)); } // ~300m fuzz keeps it anonymous
      return client().from('whispers').insert(row).select('id').single();
    },
    async updateWhisper(id, body) { return client().from('whispers').update({ body: body }).eq('id', id); },
    async deleteWhisper(id) { return client().from('whispers').delete().eq('id', id); },
    async voteWhisper(id, dir) { return client().rpc('vote_whisper', { p_whisper: id, p_dir: dir }); },

    /* ---------------- Stories ---------------- */
    async activeStories() { var cut = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); return (await client().from('stories').select('*,profiles(display_name,username,avatar_url)').gt('created_at', cut).order('created_at', { ascending: false })).data || []; },
    async createStory(file, caption) { var id = await uid(); var url = await this.uploadImage('stories', file); if (!url) return { error: 'upload failed' }; await this.award('story', 3, null); return client().from('stories').insert({ author_id: id, media_url: url, caption: caption || null }).select('id').single(); },
    async recordStoryView(storyId) { var id = await uid(); return client().from('story_views').upsert({ story_id: storyId, viewer_id: id }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }); },
    async storyViewers(storyId) { return (await client().from('story_views').select('viewer_id,created_at,profiles(display_name,username,avatar_url,avatar_preset)').eq('story_id', storyId).order('created_at', { ascending: false })).data || []; },
    async storyViewCount(storyId) { var r = await client().from('story_views').select('viewer_id', { count: 'exact', head: true }).eq('story_id', storyId); return r.count || 0; },

    /* ---------------- Super Spot (weekly bonus, admin-configured) ----------------
       Claiming no longer pays out on its own: it queues the photo for the owner to
       review, together with where and when it was taken and whether the camera was
       used, so a stock or re-used picture can be spotted. */
    async activeSuperSpot() { return (await client().from('super_spots_public').select('*').eq('active', true).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()).data; },
    async submitSuperClaim(c) {
      return (await client().rpc('submit_super_claim', {
        p_spot: c.spotId, p_post: c.postId || null, p_photo: c.photo || null, p_source: c.source || null,
        p_lat: (typeof c.lat === 'number' ? c.lat : null), p_lng: (typeof c.lng === 'number' ? c.lng : null),
        p_captured: c.capturedAt || null
      })).data;
    },
    async mySuperClaims() { var id = await uid(); return (await client().from('super_claims').select('*').eq('user_id', id).order('created_at', { ascending: false })).data || []; },

    /* ---------------- Meetup identity reveal (mutual) ---------------- */
    async setMeetupReveal(meetupId, on) { return (await client().rpc('set_meetup_reveal', { p_meetup: meetupId, p_on: on !== false })).data; },

    /* ---------------- Badges of any user (public shelf) ---------------- */
    async badgesOf(userId) { return (await client().rpc('badges_of', { p_user: userId })).data || []; },

    /* ---------------- Reports / admin ---------------- */
    async report(type, targetId, reason) { var id = await uid(); return client().from('reports').insert({ reporter_id: id, target_type: type, target_id: String(targetId), reason: reason, status: 'open' }); },
    admin: {
      users: async function (q) { return PinlyLive.searchUsers(q); },
      allUsers: async function () { return (await client().from('profiles').select('*').order('created_at', { ascending: false }).limit(500)).data || []; },
      setStatus: function (id, status) { return client().from('profiles').update({ status: status }).eq('id', id); },
      reports: async function () { return (await client().from('reports').select('*').order('created_at', { ascending: false })).data || []; },
      resolveReport: function (id, status) { return client().from('reports').update({ status: status }).eq('id', id); },
      setSuperSpot: function (s) { return client().rpc('set_super_spot', { p_lat: s.lat, p_lng: s.lng, p_prompt: s.prompt || '', p_reward_title: s.rewardTitle || '', p_reward_detail: s.rewardDetail || null, p_points: s.points || 100, p_expires: s.expiresAt || null, p_reward_image: s.rewardImage || null }); },
      setUserAdmin: function (targetId, isAdmin, perms) { return client().rpc('set_user_admin', { p_target: targetId, p_is_admin: isAdmin, p_perms: perms || null }); },
      // Super Spot photo review queue — the owner decides who actually wins.
      superClaims: async function (status) { return (await client().rpc('super_claims_queue', { p_status: status === undefined ? 'pending' : status })).data || []; },
      reviewSuperClaim: function (claimId, approve, note) { return client().rpc('review_super_claim', { p_claim: claimId, p_approve: !!approve, p_note: note || null }); }
    },

    /* ---------------- Points ---------------- */
    async award(action, points, ref) { return (await client().rpc('award_points', { p_action: action, p_points: points, p_ref: ref ? String(ref) : null })).data; },

    /* ---------------- Presence ----------------
       nearby_people only returns profiles seen in the last 5 minutes, so a heartbeat
       is what keeps you on the map and going quiet takes you off it. */
    async setVisibility(v) {
      var id = await uid();
      var patch = { visibility: v };
      if (v === 'live') patch.last_seen = new Date().toISOString(); else patch.last_seen = null;
      return client().from('profiles').update(patch).eq('id', id);
    },
    async updateLocation(lng, lat) { var id = await uid(); return client().from('profiles').update({ loc: wkt(lng, lat), last_seen: new Date().toISOString() }).eq('id', id); },
    // Called on sign-out and on page-hide so a signed-out user stops showing as online.
    async goOffline() { return client().rpc('go_offline'); },
    async nearbyPeople(lng, lat, radius) { return (await client().rpc('nearby_people', { lng: lng, lat: lat, radius_m: radius || 5000 })).data || []; },

    /* ---------------- Storage ---------------- */
    async uploadImage(bucket, input, folder) {
      var id = await uid(); var blob = toBlob(input); if (!blob) return null;
      var path = (folder || id || 'anon') + '/' + uuid() + '.' + ((blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'));
      var up = await client().storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false });
      if (up.error) return null;
      return client().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
  };

  global.PinlyLive = PinlyLive;
})(window);
