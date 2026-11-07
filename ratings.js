/* BUYEasy ratings - after a delivered order buyer, store and rider rate each other.
   Needs window.supabaseClient and the SQL functions rating_pending / submit_rating. */
(function () {
  'use strict';
  const db = window.supabaseClient;
  if (!db) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LABEL = { buyer: 'Buyer', store: 'Store', rider: 'Rider' };
  let pending = [], pill = null, modal = null, picks = {}, polling = false;

  function styles() {
    if (document.getElementById('beRateCss')) return;
    const s = document.createElement('style'); s.id = 'beRateCss';
    s.textContent = `#beRatePill{position:fixed;left:12px;bottom:84px;z-index:99990;background:#f59e0b;color:#1a1100;border:0;border-radius:999px;padding:10px 16px;font:800 12px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);cursor:pointer;display:none}
#beRateModal{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.78);display:none;align-items:flex-end;justify-content:center;font-family:Inter,system-ui,sans-serif}
.ber-sheet{background:#141414;color:#fff;width:min(100%,520px);max-height:88vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px;box-sizing:border-box}
.ber-item{background:#1c1c1c;border:1px solid #2b2b2b;border-radius:16px;padding:14px;margin-top:12px}
.ber-stars{display:flex;gap:6px;margin:10px 0}.ber-stars button{flex:1;font-size:24px;padding:6px 0;border:1px solid #333;border-radius:10px;background:#101010;color:#555;cursor:pointer}
.ber-stars button.on{color:#f59e0b;border-color:#f59e0b}
.ber-item textarea{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid #333;background:#101010;color:#fff;padding:10px;min-height:64px;font:13px Inter,system-ui,sans-serif}
.ber-row{display:flex;gap:8px;margin-top:10px}.ber-row button{flex:1;padding:11px;border:0;border-radius:12px;font-weight:800;cursor:pointer}
.ber-go{background:#22c55e;color:#04210f}.ber-later{background:#262626;color:#fff}`;
    document.head.appendChild(s);
  }
  function ensure() {
    if (modal) return;
    styles();
    pill = document.createElement('button'); pill.id = 'beRatePill'; pill.type = 'button';
    pill.addEventListener('click', open); document.body.appendChild(pill);
    modal = document.createElement('div'); modal.id = 'beRateModal';
    modal.addEventListener('click', e => {
      if (e.target === modal) return close();
      const star = e.target.closest('[data-star]');
      if (star) { const k = star.dataset.key; picks[k] = Number(star.dataset.star); paint(k); return; }
      const send = e.target.closest('[data-send]'); if (send) submit(send.dataset.send);
      if (e.target.closest('[data-later]')) close();
    });
    document.body.appendChild(modal);
  }
  const keyOf = p => p.order_id + ':' + p.ratee_id;
  function paint(k) {
    modal.querySelectorAll(`[data-key="${CSS.escape(k)}"]`).forEach(b => b.classList.toggle('on', Number(b.dataset.star) <= (picks[k] || 0)));
  }
  function draw() {
    const sheet = pending.length
      ? pending.map(p => { const k = keyOf(p); return `<div class="ber-item"><b>${esc(LABEL[p.ratee_role] || '')}: ${esc(p.ratee_name)}</b>
        <div style="font-size:11px;color:#9a9a9a">Order ${esc(p.order_number)}</div>
        <div class="ber-stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-key="${esc(k)}" data-star="${n}">★</button>`).join('')}</div>
        <textarea id="c_${esc(k)}" maxlength="500" placeholder="Leave a comment (optional). Be honest and respectful."></textarea>
        <div class="ber-row"><button class="ber-go" data-send="${esc(k)}">Submit rating</button></div></div>`; }).join('')
      : '<p style="color:#9a9a9a">Nothing to rate right now. Thank you!</p>';
    modal.innerHTML = `<div class="ber-sheet"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:16px">⭐ Rate your recent orders</b><button class="ber-later" data-later style="border:0;border-radius:10px;padding:8px 12px;background:#262626;color:#fff">Later</button></div>
      <div style="font-size:12px;color:#9a9a9a;margin-top:6px">Your ratings help keep BuyEasy safe. Admin reviews low ratings to catch fraud.</div>${sheet}</div>`;
    Object.keys(picks).forEach(paint);
  }
  async function submit(k) {
    const p = pending.find(x => keyOf(x) === k); if (!p) return;
    if (!picks[k]) return alert('Tap 1 to 5 stars first.');
    const comment = (document.getElementById('c_' + k) || {}).value || '';
    try {
      const { error } = await db.rpc('submit_rating', { p_order_id: p.order_id, p_ratee_id: p.ratee_id, p_stars: picks[k], p_comment: comment });
      if (error) throw error;
      pending = pending.filter(x => keyOf(x) !== k); delete picks[k];
      draw(); refreshPill();
      if (!pending.length) setTimeout(close, 900);
    } catch (e) { alert(e.message || 'Could not save your rating.'); }
  }
  function refreshPill() {
    ensure();
    pill.style.display = pending.length ? 'block' : 'none';
    pill.textContent = `⭐ Rate your orders (${pending.length})`;
  }
  function open() { ensure(); draw(); modal.style.display = 'flex'; }
  function close() { if (modal) modal.style.display = 'none'; }

  async function check(autoOpen) {
    if (polling) return; polling = true;
    try {
      const { data, error } = await db.rpc('rating_pending');
      if (error) throw error;
      const before = pending.length;
      pending = data || [];
      refreshPill();
      if (autoOpen && pending.length > before) open();
    } catch (e) { console.warn('Ratings unavailable', e.message || e); }
    finally { polling = false; }
  }
  window.BuyEasyRatings = { check, open };
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => check(false), 4000);
    setInterval(() => { if (!document.hidden) check(false); }, 60000);
  });
})();
