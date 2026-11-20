/* BuyEasy announcements: a clean banner for the newest unread message, plus a full list.
   BuyEasyAnnouncements.init('buyer' | 'store' | 'rider') */
(function () {
  'use strict';
  const db = window.supabaseClient; if (!db) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND = { info: ['📢', '#3b82f6', 'Update'], success: ['✅', '#22c55e', 'Good news'], warning: ['⚠️', '#f59e0b', 'Important'], promo: ['🎉', '#a855f7', 'Offer'] };
  let role = 'buyer', rows = [], banner = null, modal = null, bell = null;

  function css() {
    if (document.getElementById('beAnnCss')) return;
    const s = document.createElement('style'); s.id = 'beAnnCss';
    s.textContent = `#beAnn{padding:0 12px;max-width:760px;margin:10px auto 0}
.ba-card{--c:#3b82f6;display:flex;gap:12px;padding:14px;border-radius:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--c) 18%,var(--card)),var(--card));border:1px solid color-mix(in srgb,var(--c) 45%,transparent);box-shadow:0 8px 24px rgba(0,0,0,.18)}
.ba-ico{flex:0 0 40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:20px;background:color-mix(in srgb,var(--c) 22%,transparent)}
.ba-main{min-width:0;flex:1}.ba-tag{font-size:10px;font-weight:900;letter-spacing:.9px;text-transform:uppercase;color:var(--c)}
.ba-t{font-weight:900;font-size:15px;margin:2px 0 4px;color:var(--text)}.ba-b{font-size:13px;line-height:1.5;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ba-row{display:flex;gap:8px;margin-top:10px}.ba-row button{padding:9px 14px;border-radius:10px;border:0;font-weight:800;font-size:12px;cursor:pointer;min-height:38px}
.ba-ok{background:var(--c);color:#fff}.ba-all{background:transparent;color:var(--text);border:1px solid var(--border)!important}
#beAnnModal{position:fixed;inset:0;z-index:2147482100;background:rgba(0,0,0,.78);display:none;align-items:flex-end;justify-content:center}
.bam-sheet{background:var(--card);color:var(--text);width:min(100%,560px);max-height:86vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px;box-sizing:border-box}
.bam-item{margin-top:10px;padding:12px;border-radius:14px;background:var(--card3);border:1px solid var(--border2);border-left:4px solid var(--c)}
.bam-item.unread{box-shadow:0 0 0 1px var(--c) inset}.bam-item small{color:var(--muted)}
.be-bell{position:relative;width:38px;height:38px;border-radius:50%;border:1px solid var(--border);background:var(--card);display:grid;place-items:center;font-size:17px;cursor:pointer}
.be-bell i{position:absolute;top:-2px;right:-2px;min-width:16px;height:16px;border-radius:999px;background:#ef4444;color:#fff;font:800 10px/16px Inter,system-ui,sans-serif;text-align:center;padding:0 4px;font-style:normal}`;
    document.head.appendChild(s);
  }
  const unread = () => rows.filter(r => !r.is_read);

  function drawBanner() {
    css();
    if (!banner) { banner = document.createElement('div'); banner.id = 'beAnn'; const bh = document.getElementById('brandHeader'); if (bh && bh.parentNode) bh.parentNode.insertBefore(banner, bh.nextSibling); else document.body.prepend(banner); }
    const u = unread(), a = u[0];
    if (!a) { banner.innerHTML = ''; }
    else { const k = KIND[a.kind] || KIND.info;
      banner.innerHTML = `<div class="ba-card" style="--c:${k[1]}"><div class="ba-ico">${k[0]}</div><div class="ba-main"><div class="ba-tag">${k[2]}${u.length > 1 ? ` • ${u.length} new` : ''}</div><div class="ba-t">${esc(a.title)}</div><div class="ba-b">${esc(a.body)}</div>
        <div class="ba-row"><button class="ba-ok" data-ann="read" data-id="${esc(a.id)}">Got it</button><button class="ba-all" data-ann="all">View all</button></div></div></div>`; }
    if (bell) { const n = u.length; bell.querySelector('i') && bell.querySelector('i').remove(); if (n) bell.insertAdjacentHTML('beforeend', `<i>${n}</i>`); }
  }
  function drawModal() {
    if (!modal) { modal = document.createElement('div'); modal.id = 'beAnnModal'; modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; }); document.body.appendChild(modal); }
    modal.innerHTML = `<div class="bam-sheet"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:18px">📢 Announcements</b><button data-ann="close" style="border:0;border-radius:10px;padding:8px 12px;background:var(--card3);color:var(--text);font-weight:800;cursor:pointer">Close</button></div>
      ${rows.length ? rows.map(r => { const k = KIND[r.kind] || KIND.info; return `<div class="bam-item ${r.is_read ? '' : 'unread'}" style="--c:${k[1]}"><b>${k[0]} ${esc(r.title)}</b>${r.pinned ? ' <small>📌 Pinned</small>' : ''}<div style="font-size:13px;color:var(--muted);margin-top:4px;line-height:1.5;white-space:pre-line">${esc(r.body)}</div><small>${new Date(r.created_at).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}</small></div>`; }).join('') : '<p style="color:var(--muted);text-align:center;padding:26px 0">No announcements right now.</p>'}</div>`;
    modal.style.display = 'flex';
  }
  async function markAll() { for (const r of unread()) { r.is_read = true; db.rpc('mark_announcement_read', { p_id: r.id }).then(() => {}, () => {}); } drawBanner(); }
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-ann]'); if (!b) return;
    if (b.dataset.ann === 'read') { const r = rows.find(x => x.id === b.dataset.id); if (r) { r.is_read = true; db.rpc('mark_announcement_read', { p_id: r.id }).then(() => {}, () => {}); } drawBanner(); }
    if (b.dataset.ann === 'all') { drawModal(); markAll(); }
    if (b.dataset.ann === 'close' && modal) modal.style.display = 'none';
  });
  async function load() {
    try { const { data, error } = await db.rpc('my_announcements', { p_role: role }); if (error) throw error; rows = data || []; drawBanner(); }
    catch (e) { console.warn('Announcements unavailable', e.message || e); }
  }
  function mountBell() {
    const bh = document.getElementById('brandHeader'); if (!bh || document.getElementById('beBell')) return;
    bell = document.createElement('button'); bell.id = 'beBell'; bell.type = 'button'; bell.className = 'be-bell'; bell.setAttribute('aria-label', 'Announcements'); bell.textContent = '📢';
    bell.addEventListener('click', () => { drawModal(); markAll(); });
    const right = bh.lastElementChild; (right || bh).insertBefore(bell, (right || bh).firstChild);
  }
  window.BuyEasyAnnouncements = {
    init(r) { role = r || role; document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { mountBell(); load(); }, 2500); BuyEasyPoll.every(load, { fast: 120000, slow: 300000, relaxed: 300000 }); }); }
  };
})();
