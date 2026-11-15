/* BuyEasy verified badge + trust info (rating, verified) for stores and riders. */
(function () {
  'use strict';
  const db = window.supabaseClient;
  const store = new Map(), user = new Map();
  const SEAL = size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.6l2.5 1.8 3.1-.1 1 2.9 2.5 1.9-.9 3 .9 3-2.5 1.9-1 2.9-3.1-.1L12 22.4l-2.5-1.8-3.1.1-1-2.9-2.5-1.9.9-3-.9-3 2.5-1.9 1-2.9 3.1.1z" fill="#10b981"/><path d="M7.9 12.2l2.7 2.7 5.5-5.7" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const BuyEasyBadge = {
    icon(size) { return `<span class="be-vbadge" title="Verified by BuyEasy: a trusted, well-rated member" aria-label="Verified by BuyEasy">${SEAL(size || 16)}</span>`; },
    pill() { return `<span class="be-vpill" title="Verified by BuyEasy: a trusted, well-rated member">${SEAL(14)}Verified</span>`; },
    stars(info) { return info && info.avg_rating ? `<span class="be-rate">★ ${Number(info.avg_rating).toFixed(1)} <small>(${info.rating_count})</small></span>` : ''; },
    async loadStores(ids) {
      ids = [...new Set((ids || []).filter(Boolean))].filter(i => !store.has(i)); if (!db || !ids.length) return store;
      try { const { data } = await db.rpc('trust_info_for_stores', { p_store_ids: ids }); (data || []).forEach(r => store.set(r.store_id, r)); ids.forEach(i => { if (!store.has(i)) store.set(i, {}); }); } catch (e) {}
      return store;
    },
    async loadUsers(ids) {
      ids = [...new Set((ids || []).filter(Boolean))].filter(i => !user.has(i)); if (!db || !ids.length) return user;
      try { const { data } = await db.rpc('trust_info_for_users', { p_user_ids: ids }); (data || []).forEach(r => user.set(r.user_id, r)); ids.forEach(i => { if (!user.has(i)) user.set(i, {}); }); } catch (e) {}
      return user;
    },
    store(id) { return store.get(id) || {}; },
    user(id) { return user.get(id) || {}; },
    storeBadge(id, size) { return (store.get(id) || {}).is_verified ? this.icon(size) : ''; },
    userBadge(id, size) { return (user.get(id) || {}).is_verified ? this.icon(size) : ''; }
  };
  window.BuyEasyBadge = BuyEasyBadge;
})();
