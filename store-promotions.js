/* BuyEasy - Promote your store (R1 per hour, paid from your wallet; card coming soon with Yoco).
   Shows a "Sponsored" store card at the top of the shop for buyers within 15 km. */
(function () {
  'use strict';
  const db = window.supabaseClient; if (!db) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => 'R' + Number(v || 0).toFixed(2);
  const PRESETS = [[6, '6 h'], [12, '12 h'], [24, '1 day'], [72, '3 days'], [168, '7 days']];
  let hours = 24, picked = new Set(), products = [], promos = [], balance = 0, mounted = false;

  function css() {
    if (document.getElementById('spCss')) return;
    const s = document.createElement('style'); s.id = 'spCss';
    s.textContent = `.sp-card{border-radius:22px;border:1px solid rgba(245,158,11,.4);background:linear-gradient(160deg,rgba(245,158,11,.13),var(--card));padding:18px;margin-bottom:14px}
.sp-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.sp-h b{font-size:18px;font-weight:900;letter-spacing:-.3px}.sp-h p{margin:4px 0 0;color:var(--muted);font-size:12.5px;line-height:1.5}
.sp-chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 10px}.sp-chip{padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--card3);color:var(--text);font-weight:800;font-size:13px;cursor:pointer;min-height:42px}
.sp-chip.on{background:#f59e0b;color:#1a1100;border-color:#f59e0b}
.sp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sp-row input[type=number]{width:110px}
.sp-price{margin:14px 0;padding:14px;border-radius:16px;background:var(--card3);border:1px solid var(--border2);display:flex;justify-content:space-between;align-items:center}
.sp-price b{font-size:26px;letter-spacing:-.6px}.sp-price small{color:var(--muted);display:block;font-size:11.5px}
.sp-prods{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}.sp-prods button{padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:var(--card3);color:var(--text);font-size:12px;font-weight:700;cursor:pointer}
.sp-prods button.on{background:rgba(34,197,94,.18);border-color:#22c55e;color:#22c55e}
.sp-pay{display:grid;gap:8px}.sp-pay button{min-height:50px;border-radius:14px;border:0;font-weight:900;font-size:14px;cursor:pointer}
.sp-w{background:linear-gradient(180deg,#2bd36b,#1fb257);color:#052e16}.sp-c{background:var(--card3);color:var(--muted);border:1px dashed var(--border)!important}
.sp-item{display:flex;justify-content:space-between;gap:10px;padding:11px 13px;border-radius:14px;background:var(--card3);border:1px solid var(--border2);margin-top:8px;font-size:13px}
.sp-st{font-size:10.5px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;padding:2px 9px;border-radius:999px;align-self:flex-start}
.sp-st.active{background:rgba(34,197,94,.15);color:#22c55e}.sp-st.queued{background:rgba(59,130,246,.15);color:#60a5fa}.sp-st.ended{background:var(--card);color:var(--muted)}`;
    document.head.appendChild(s);
  }
  const left = e => { const m = Math.max(0, Math.floor((new Date(e) - Date.now()) / 60000)); return m >= 1440 ? Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h' : m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };

  function draw() {
    const box = document.getElementById('promoCard'); if (!box) return;
    const price = hours;
    box.innerHTML = `<div class="sp-h"><div><b>📣 Promote your store</b><p>Appear at the top of the shop with a Sponsored label for shoppers within 15&nbsp;km. <b>R1 per hour</b>, you choose how long.</p></div></div>
      <div class="sp-chips">${PRESETS.map(([h, l]) => `<button class="sp-chip ${hours === h ? 'on' : ''}" data-h="${h}">${l}</button>`).join('')}</div>
      <div class="sp-row"><label style="font-size:12px;color:var(--muted)">Or type your own hours</label><input id="spHours" type="number" min="1" max="720" value="${hours}"><span style="font-size:12px;color:var(--muted)">1 to 720 hours</span></div>
      <div class="sp-price"><div><small>Total price</small><b>${money(price)}</b></div><div style="text-align:right"><small>Your wallet</small><b style="font-size:16px">${money(balance)}</b></div></div>
      ${products.length ? `<div style="font-size:12px;font-weight:800;margin-top:4px">Feature products (optional, up to 6)</div><div class="sp-prods">${products.map(p => `<button class="${picked.has(p.id) ? 'on' : ''}" data-p="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>` : ''}
      <input id="spTag" maxlength="80" placeholder="Short message for shoppers (optional), e.g. Fresh bread daily" style="width:100%;margin-bottom:12px">
      <div class="sp-pay"><button class="sp-w" data-pay="wallet" ${balance < price ? 'disabled style="opacity:.55"' : ''}>${balance < price ? 'Wallet balance too low' : 'Pay ' + money(price) + ' from wallet'}</button>
      <button class="sp-c" disabled>💳 Pay with card (coming soon)</button></div>
      <div style="font-weight:900;margin:18px 0 0">My promotions</div>
      ${promos.length ? promos.map(p => `<div class="sp-item"><div><b>${p.hours} hours • ${money(p.amount)}</b><div style="color:var(--muted);font-size:12px;margin-top:2px">${p.state === 'active' ? 'Ends in ' + left(p.ends_at) : p.state === 'queued' ? 'Starts ' + new Date(p.starts_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Ended ' + new Date(p.ends_at).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}</div></div><span class="sp-st ${p.state}">${p.state}</span></div>`).join('')
        : '<p style="color:var(--muted);font-size:12.5px;margin:6px 0 0">No promotions yet. Your first one starts as soon as you pay.</p>'}`;
  }
  async function refresh() {
    if (typeof currentStore === 'undefined' || !currentStore) return;
    try {
      const [w, pr, pd] = await Promise.all([
        db.from('wallets').select('balance').eq('user_id', currentStore.owner_id).maybeSingle(),
        db.rpc('store_my_promotions'),
        db.from('products').select('id,name').eq('store_id', currentStore.id).order('name').limit(60)]);
      balance = Number(w.data?.balance || 0); promos = pr.data || []; products = pd.data || [];
      draw();
    } catch (e) { console.warn('Promotions:', e.message || e); }
  }
  function mount() {
    if (mounted) return; const stock = document.getElementById('stock'); if (!stock) return;
    css(); const c = document.createElement('div'); c.id = 'promoCard'; c.className = 'sp-card'; stock.insertBefore(c, stock.firstChild); mounted = true;
    c.addEventListener('click', async e => {
      const h = e.target.closest('[data-h]'); if (h) { hours = Number(h.dataset.h); return draw(); }
      const p = e.target.closest('[data-p]'); if (p) { const id = p.dataset.p; if (picked.has(id)) picked.delete(id); else if (picked.size < 6) picked.add(id); return draw(); }
      const pay = e.target.closest('[data-pay]'); if (!pay) return;
      hours = Math.max(1, Math.min(720, Number(document.getElementById('spHours').value) || hours));
      if (!confirm(`Pay ${money(hours)} from your wallet to promote your store for ${hours} hour(s)?`)) return;
      pay.disabled = true;
      const { error } = await db.rpc('store_buy_promotion', { p_store_id: currentStore.id, p_hours: hours, p_product_ids: [...picked], p_tagline: (document.getElementById('spTag') || {}).value || '' });
      if (error) { alert(error.message); pay.disabled = false; return; }
      if (typeof notify === 'function') notify('Promotion paid. Your store is now featured.');
      picked.clear(); await refresh();
    });
    c.addEventListener('input', e => { if (e.target.id === 'spHours') { hours = Math.max(1, Math.min(720, Number(e.target.value) || 1)); const pr = c.querySelector('.sp-price b'); if (pr) pr.textContent = money(hours); const w = c.querySelector('.sp-w'); if (w) { w.disabled = balance < hours; w.textContent = balance < hours ? 'Wallet balance too low' : 'Pay ' + money(hours) + ' from wallet'; w.style.opacity = balance < hours ? '.55' : ''; } } });
  }
  async function markVerified() {
    if (typeof currentStore === 'undefined' || !currentStore || !window.BuyEasyBadge) return;
    await BuyEasyBadge.loadStores([currentStore.id]);
    const n = document.getElementById('storeName'); if (n && !n.querySelector('.be-vbadge') && BuyEasyBadge.store(currentStore.id).is_verified) n.insertAdjacentHTML('beforeend', BuyEasyBadge.icon(16));
  }
  const origOpen = window.openTab;
  if (typeof origOpen === 'function') window.openTab = function (id, el) { origOpen(id, el); if (id === 'stock') refresh(); };
  document.addEventListener('DOMContentLoaded', () => { const t = setInterval(() => { if (typeof currentStore !== 'undefined' && currentStore) { clearInterval(t); mount(); refresh(); markVerified(); } }, 700); setInterval(() => { if (!document.hidden) refresh(); }, 60000); });
})();
