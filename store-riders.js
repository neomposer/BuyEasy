/* BuyEasy - store "Riders" tab: see who is online, approve requests, and manage riders
   (suspend / reinstate / remove) from one tidy menu. Only approved riders can see this store's orders. */
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TRANSPORT = { foot: 'On foot', bicycle: 'Bicycle', motorcycle: 'Motorbike', motorbike: 'Motorbike', car: 'Car' };
  let rows = [], busy = false, openMenu = null;
  const client = () => window.supabaseClient;
  const ago = d => { if (!d) return ''; const m = Math.max(0, Math.floor((Date.now() - new Date(d)) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + ' d ago'; };

  function css() {
    if (document.getElementById('srCss')) return;
    const s = document.createElement('style'); s.id = 'srCss';
    s.textContent = `.sr-sum{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 12px}.sr-sum span{padding:7px 12px;border-radius:999px;font-size:12px;font-weight:800;background:var(--card3);border:1px solid var(--border2)}
.sr-sum .on{color:#22c55e;border-color:rgba(34,197,94,.4);background:rgba(34,197,94,.1)}
.sr-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:var(--card3);border:1px solid var(--border2);margin-top:10px;position:relative}
.sr-av{position:relative;flex:0 0 46px;height:46px;border-radius:50%;background:var(--card);border:1px solid var(--border);display:grid;place-items:center;font-weight:900;font-size:17px}
.sr-av i{position:absolute;right:0;bottom:0;width:13px;height:13px;border-radius:50%;border:2px solid var(--card3);background:#9ca3af}.sr-av i.on{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.22)}
.sr-main{min-width:0;flex:1}.sr-main b{display:block;font-size:14.5px;font-weight:900}.sr-sub{font-size:12px;color:var(--muted);margin-top:2px}
.sr-state{display:inline-block;font-size:10.5px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:999px;margin-top:4px}
.sr-state.on{background:rgba(34,197,94,.15);color:#22c55e}.sr-state.off{background:var(--card);color:var(--muted)}.sr-state.sus{background:rgba(239,68,68,.15);color:#f87171}
.sr-acts{display:flex;gap:6px;align-items:center}.sr-btn{padding:9px 14px;border-radius:12px;border:1px solid var(--border);background:var(--card);color:var(--text);font-weight:800;font-size:12px;cursor:pointer;min-height:40px}
.sr-btn.g{background:var(--green);color:#052e16;border-color:var(--green)}
.sr-menu{position:absolute;right:10px;top:calc(100% - 6px);z-index:30;min-width:190px;background:var(--card);border:1px solid var(--border);border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.45);padding:6px}
.sr-menu button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 12px;border:0;border-radius:10px;background:transparent;color:var(--text);font-weight:700;font-size:13px;cursor:pointer}
.sr-menu button:hover{background:var(--card3)}.sr-menu button.danger{color:#f87171}.sr-menu small{display:block;color:var(--muted);font-weight:600;font-size:11px}`;
    document.head.appendChild(s);
  }
  function person(r, state, acts) {
    const t = TRANSPORT[r.transport_type] || r.transport_type || '';
    const info = window.BuyEasyBadge ? BuyEasyBadge.stars(r) : '';
    return `<div class="sr-card"><div class="sr-av">${esc((r.full_name || 'R').trim().charAt(0).toUpperCase())}<i class="${r.is_online && r.status === 'approved' ? 'on' : ''}"></i></div>
      <div class="sr-main"><b>${esc(r.full_name || 'Rider')}${r.is_verified && window.BuyEasyBadge ? BuyEasyBadge.icon(15) : ''}</b>
      <div class="sr-sub">${esc(r.phone || '')}${t ? ' • ' + esc(t) : ''}${info ? ' • ' + info : ''}</div>${state}</div><div class="sr-acts">${acts}</div></div>`;
  }
  const stateTag = r => r.status === 'suspended' ? '<span class="sr-state sus">Suspended</span>'
    : r.is_online ? '<span class="sr-state on">● Online now</span>' : `<span class="sr-state off">Offline${r.last_seen_at ? ' • seen ' + ago(r.last_seen_at) : ''}</span>`;

  function menuFor(r) {
    const items = r.status === 'suspended'
      ? `<button data-do="approved" data-id="${esc(r.link_id)}">✅ Reinstate rider<small>Allow orders again</small></button>`
      : `<button data-do="suspended" data-id="${esc(r.link_id)}">⏸ Suspend rider<small>Stop orders, keep on your list</small></button>`;
    return items + `<button class="danger" data-do="removed" data-id="${esc(r.link_id)}">🗑 Remove rider<small>They must ask again to return</small></button>`;
  }

  function draw() {
    css(); closeMenu();
    const box = el('ridersBody'); if (!box) return;
    const pending = rows.filter(r => r.status === 'pending');
    const mine = rows.filter(r => ['approved', 'suspended'].includes(r.status)).sort((a, b) => Number(b.is_online) - Number(a.is_online));
    const online = mine.filter(r => r.status === 'approved' && r.is_online).length;
    const badge = el('ridersBadge'); if (badge) badge.textContent = pending.length ? ` (${pending.length})` : '';
    const nb = el('ridersBadgeNav'); if (nb) nb.textContent = pending.length ? String(pending.length) : '';
    box.innerHTML = `<div class="sr-sum"><span class="${online ? 'on' : ''}">● ${online} online</span><span>${mine.filter(r => r.status === 'approved').length} approved</span><span>${pending.length} waiting</span></div>
      ${pending.length ? `<div style="font-weight:900;margin:4px 0 0">Waiting for your approval</div>${pending.map(r => person(r, '<span class="sr-state off">New request</span>',
        `<button class="sr-btn g" data-do="approved" data-id="${esc(r.link_id)}">Approve</button><button class="sr-btn" data-do="rejected" data-id="${esc(r.link_id)}">Decline</button>`)).join('')}` : ''}
      <div style="font-weight:900;margin:16px 0 0">My riders</div>
      ${mine.length ? mine.map(r => person(r, stateTag(r), `<button class="sr-btn" data-menu="${esc(r.link_id)}" aria-haspopup="true">Manage ▾</button>`)).join('')
        : '<p class="status" style="margin-top:8px">You have no approved riders yet. <b>Without an online rider, buyers must collect orders from your store themselves.</b></p>'}`;
  }

  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  document.addEventListener('click', e => {
    const t = e.target;
    const menuBtn = t.closest && t.closest('[data-menu]');
    const act = t.closest && t.closest('#ridersBody [data-do]');
    const hadOpen = openMenu; closeMenu();
    if (menuBtn) {
      if (hadOpen && hadOpen.dataset.for === menuBtn.dataset.menu) return;      // tapping again closes it
      const r = rows.find(x => x.link_id === menuBtn.dataset.menu); if (!r) return;
      const menu = document.createElement('div'); menu.className = 'sr-menu'; menu.dataset.for = r.link_id; menu.innerHTML = menuFor(r);
      menuBtn.closest('.sr-card').appendChild(menu); openMenu = menu; return;
    }
    if (act) review(act.dataset.id, act.dataset['do']);
  });

  async function load() {
    if (busy || !client()) return; busy = true;
    try {
      const { data, error } = await client().rpc('store_list_rider_requests');
      if (error) throw error;
      rows = data || [];
      if (window.BuyEasyBadge) { /* verified + rating already included */ }
      draw();
    } catch (e) { console.error(e); const box = el('ridersBody'); if (box) box.innerHTML = `<p class="status">Could not load riders: ${esc(e.message)}</p>`; }
    finally { busy = false; }
  }
  async function review(linkId, decision) {
    const text = { approved: 'Approve this rider for your store?', rejected: 'Decline this rider?', suspended: 'Suspend this rider? They will stop receiving your orders until you reinstate them.', removed: 'Remove this rider from your store? They must ask again to return.' }[decision];
    if (!confirm(text)) return;
    try {
      const { error } = await client().rpc('store_review_rider', { p_link_id: linkId, p_decision: decision });
      if (error) throw error;
      if (typeof notify === 'function') notify({ approved: 'Rider approved', rejected: 'Request declined', suspended: 'Rider suspended', removed: 'Rider removed' }[decision]);
      busy = false; await load();
    } catch (e) { console.error(e); alert(e.message || 'Could not update this rider.'); }
  }
  window.loadRiderRequests = load; window.reviewRider = review;

  const originalOpenTab = window.openTab;
  if (typeof originalOpenTab === 'function') window.openTab = function (id, element) { originalOpenTab(id, element); if (id === 'riders') load(); };
  document.addEventListener('DOMContentLoaded', () => { setTimeout(load, 1500); setInterval(() => { if (!document.hidden) load(); }, 30000); });
})();
