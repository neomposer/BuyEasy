/* BUYEasy ratings (like Bolt): a rating sheet appears ONCE after an order is finished
   (delivered or cancelled). After you rate or skip it, it never shows again for that order.
   There is no permanent button on screen. */
(function () {
  'use strict';
  const db = window.supabaseClient; if (!db) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LABEL = { buyer: 'Buyer', store: 'Store', rider: 'Rider' };
  let modal = null, group = [], picks = {}, busy = false, open = false;

  function styles() {
    if (document.getElementById('beRateCss')) return;
    const s = document.createElement('style'); s.id = 'beRateCss';
    s.textContent = `#beRateModal{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.78);display:none;align-items:flex-end;justify-content:center;font-family:Inter,system-ui,sans-serif}
.ber-sheet{background:#141414;color:#fff;width:min(100%,520px);max-height:88vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px;box-sizing:border-box}
.ber-item{background:#1c1c1c;border:1px solid #2b2b2b;border-radius:16px;padding:14px;margin-top:12px}
.ber-stars{display:flex;gap:6px;margin:10px 0}.ber-stars button{flex:1;font-size:24px;padding:6px 0;border:1px solid #333;border-radius:10px;background:#101010;color:#555;cursor:pointer}
.ber-stars button.on{color:#f59e0b;border-color:#f59e0b}
.ber-item textarea{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid #333;background:#101010;color:#fff;padding:10px;min-height:60px;font:13px Inter,system-ui,sans-serif}
.ber-row{display:flex;gap:8px;margin-top:10px}.ber-row button{flex:1;padding:11px;border:0;border-radius:12px;font-weight:800;cursor:pointer}
.ber-go{background:#22c55e;color:#04210f}.ber-skip{background:#262626;color:#fff}`;
    document.head.appendChild(s);
  }
  function ensure() {
    if (modal) return; styles();
    modal = document.createElement('div'); modal.id = 'beRateModal';
    modal.addEventListener('click', e => {
      const star = e.target.closest('[data-star]');
      if (star) { const k = star.dataset.key; picks[k] = Number(star.dataset.star); modal.querySelectorAll(`[data-key="${CSS.escape(k)}"]`).forEach(b => b.classList.toggle('on', Number(b.dataset.star) <= picks[k])); return; }
      const send = e.target.closest('[data-send]'); if (send) return submit(send.dataset.send);
      if (e.target.closest('[data-skip]')) return skipAll();
    });
    document.body.appendChild(modal);
  }
  const keyOf = p => p.order_id + ':' + p.ratee_id;

  function draw() {
    const o = group[0];
    modal.innerHTML = `<div class="ber-sheet"><b style="font-size:17px">How was order ${esc(o.order_number)}?</b>
      <div style="font-size:12px;color:#9a9a9a;margin-top:4px">Your rating is private and helps keep BuyEasy safe.</div>
      ${group.map(p => { const k = keyOf(p); return `<div class="ber-item"><b>${esc(LABEL[p.ratee_role] || '')}: ${esc(p.ratee_name)}</b>
        <div class="ber-stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-key="${esc(k)}" data-star="${n}">★</button>`).join('')}</div>
        <textarea id="c_${esc(k)}" maxlength="500" placeholder="Add a comment (optional)"></textarea>
        <div class="ber-row"><button class="ber-go" data-send="${esc(k)}">Submit</button></div></div>`; }).join('')}
      <div class="ber-row"><button class="ber-skip" data-skip>Skip, don't ask again</button></div></div>`;
  }

  async function submit(k) {
    const p = group.find(x => keyOf(x) === k); if (!p) return;
    if (!picks[k]) return alert('Tap 1 to 5 stars first.');
    const comment = (document.getElementById('c_' + k) || {}).value || '';
    try {
      const { error } = await db.rpc('submit_rating', { p_order_id: p.order_id, p_ratee_id: p.ratee_id, p_stars: picks[k], p_comment: comment });
      if (error) throw error;
      group = group.filter(x => keyOf(x) !== k); delete picks[k];
      if (!group.length) return close(); draw();
    } catch (e) { alert(e.message || 'Could not save your rating.'); }
  }
  async function skipAll() {
    const ids = [...new Set(group.map(p => p.order_id))];
    await Promise.all(ids.map(id => db.rpc('skip_rating', { p_order_id: id }).then(() => {}, () => {})));
    close();
  }
  function close() { if (modal) modal.style.display = 'none'; group = []; picks = {}; open = false; setTimeout(() => check(), 600); }

  async function check() {
    if (busy || open || document.hidden) return; busy = true;
    try {
      const { data, error } = await db.rpc('rating_pending');
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) return;
      const firstOrder = rows[0].order_id;                       // one finished order at a time
      group = rows.filter(r => r.order_id === firstOrder);
      ensure(); draw(); modal.style.display = 'flex'; open = true;
    } catch (e) { console.warn('Ratings unavailable', e.message || e); }
    finally { busy = false; }
  }
  window.BuyEasyRatings = { check: () => check() };
  document.addEventListener('DOMContentLoaded', () => { setTimeout(check, 5000); });
})();
