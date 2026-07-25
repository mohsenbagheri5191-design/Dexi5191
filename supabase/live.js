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
  function client() { if (!sb) sb = global.supabase.createClient(cfg.url, cfg.publishableKey || cfg.anonKey); return sb; }
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
      oauth: function (provider) { return client().auth.signInWithOAuth({ provider: provider }); },
      signOut: function () { return client().auth.signOut(); },
      onChange: function (cb) { return client().auth.onAuthStateChange(function (_e, s) { cb(s); }); }
    },

    /* ---------------- Profiles ---------------- */
    async myProfile() { var id = await uid(); if (!id) return null; var r = await client().from('profiles').select('*').eq('id', id).single(); return r.data; },
    async getProfile(id) { return (await client().from('profiles').select('*').eq('id', id).single()).data; },
    async updateProfile(fields) { var id = await uid(); return client().from('profiles').update(fields).eq('id', id); },
    async verifyAge(band) { var id = await uid(); return client().from('profiles').update({ age_verified: true, age_band: band }).eq('id', id); },
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

    /* ---------------- Direct messages ---------------- */
    async myConversations() {
      var id = await uid();
      var mine = (await client().from('conversation_members').select('conversation_id').eq('user_id', id)).data || [];
      var ids = mine.map(function (r) { return r.conversation_id; });
      if (!ids.length) return [];
      var convs = (await client().from('conversations').select('*,conversation_members(user_id),messages(body,created_at,sender_id)').in('id', ids)).data || [];
      return convs;
    },
    async dmWith(otherId) {
      var id = await uid();
      // find an existing 1:1
      var mine = (await client().from('conversation_members').select('conversation_id').eq('user_id', id)).data || [];
      for (var i = 0; i < mine.length; i++) {
        var members = (await client().from('conversation_members').select('user_id').eq('conversation_id', mine[i].conversation_id)).data || [];
        if (members.length === 2 && members.some(function (m) { return m.user_id === otherId; })) return mine[i].conversation_id;
      }
      var c = await client().from('conversations').insert({ is_group: false, created_by: id }).select('id').single();
      await client().from('conversation_members').insert([{ conversation_id: c.data.id, user_id: id }, { conversation_id: c.data.id, user_id: otherId }]);
      return c.data.id;
    },
    async createGroup(memberIds, name) {
      var id = await uid();
      var c = await client().from('conversations').insert({ is_group: true, name: name || null, created_by: id }).select('id').single();
      var rows = [{ conversation_id: c.data.id, user_id: id }].concat(memberIds.map(function (m) { return { conversation_id: c.data.id, user_id: m }; }));
      await client().from('conversation_members').insert(rows);
      return c.data.id;
    },
    async messages(convId) { return (await client().from('messages').select('*').eq('conversation_id', convId).order('created_at')).data || []; },
    async sendMessage(convId, body) { var id = await uid(); return client().from('messages').insert({ conversation_id: convId, sender_id: id, body: body }); },
    subscribeMessages: function (convId, cb) {
      return client().channel('msg:' + convId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId }, function (p) { cb(p.new); }).subscribe();
    },

    /* ---------------- Meetups ---------------- */
    async nearbyMeetups() { return (await client().from('meetups').select('*').eq('status', 'open').gt('expires_at', new Date().toISOString())).data || []; },
    async createMeetup(m) {
      var id = await uid();
      return client().from('meetups').insert({
        host_id: id, activity: m.activity, note: m.note || null, age_band: m.ageBand, bands: m.bands,
        venue: m.venue, display_location: wkt(m.lng, m.lat), identity: m.identity || 'anon', expires_at: m.expiresAt
      }).select('id').single();
    },
    async requestMeetup(meetupId) { var id = await uid(); return client().from('meetup_requests').insert({ meetup_id: meetupId, guest_id: id }); },
    async respondRequest(reqId, accept) { return client().from('meetup_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', reqId); },
    async meetupMessages(meetupId) { return (await client().from('meetup_messages').select('*').eq('meetup_id', meetupId).order('created_at')).data || []; },
    async sendMeetupMessage(meetupId, body) { var id = await uid(); return client().from('meetup_messages').insert({ meetup_id: meetupId, sender_id: id, body: body }); },

    /* ---------------- Whispers ---------------- */
    async whispers() { return (await client().from('whispers_public').select('*').order('created_at', { ascending: false }).limit(100)).data || []; },
    async createWhisper(body, hood) { var id = await uid(); await this.award('whisper', 3, null); return client().from('whispers').insert({ author_id: id, body: body, neighborhood: hood || null, up: 1, down: 0 }).select('id').single(); },
    async voteWhisper(id, dir) { return client().rpc('vote_whisper', { p_whisper: id, p_dir: dir }); },

    /* ---------------- Stories ---------------- */
    async activeStories() { var cut = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); return (await client().from('stories').select('*,profiles(display_name,username,avatar_url)').gt('created_at', cut).order('created_at', { ascending: false })).data || []; },
    async createStory(file, caption) { var id = await uid(); var url = await this.uploadImage('stories', file); if (!url) return { error: 'upload failed' }; await this.award('story', 3, null); return client().from('stories').insert({ author_id: id, media_url: url, caption: caption || null }); },

    /* ---------------- Reports / admin ---------------- */
    async report(type, targetId, reason) { var id = await uid(); return client().from('reports').insert({ reporter_id: id, target_type: type, target_id: String(targetId), reason: reason, status: 'open' }); },
    admin: {
      users: async function (q) { return PinlyLive.searchUsers(q); },
      allUsers: async function () { return (await client().from('profiles').select('*').order('created_at', { ascending: false }).limit(500)).data || []; },
      setStatus: function (id, status) { return client().from('profiles').update({ status: status }).eq('id', id); },
      reports: async function () { return (await client().from('reports').select('*').order('created_at', { ascending: false })).data || []; },
      resolveReport: function (id, status) { return client().from('reports').update({ status: status }).eq('id', id); }
    },

    /* ---------------- Points ---------------- */
    async award(action, points, ref) { return (await client().rpc('award_points', { p_action: action, p_points: points, p_ref: ref ? String(ref) : null })).data; },

    /* ---------------- Presence ---------------- */
    async setVisibility(v) { var id = await uid(); return client().from('profiles').update({ visibility: v }).eq('id', id); },
    async updateLocation(lng, lat) { var id = await uid(); return client().from('profiles').update({ loc: wkt(lng, lat), last_seen: new Date().toISOString() }).eq('id', id); },
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
