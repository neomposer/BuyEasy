/* BuyEasy - Promote your store.
   You choose the HOURS. A full month (720 hours) costs R1.00 per hour. Shorter plans cost R0.50 more per hour
   for every week short of a month, and a shorter plan never costs more than a longer one.
   Pay from the wallet, or use free promotion hours given by BuyEasy. Card payment comes with Yoco. */
(function () {
  'use strict';
  const db = window.supabaseClient; if (!db) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => 'R' + Number(v || 0).toFixed(2);
  // same formula as the database (the database re-checks it when you pay)
  const price = h => {
    h = Math.max(1, Math.floor(h || 1)); if (h >= 720) return Math.round(h * 100) / 100;
    let best = Infinity; for (let x = h; x <= 720; x++) best = Math.min(best, x * (1 + 0.5 * Math.ceil((720 - x) / 168)));
    return Math.round(best * 100) / 100;
  };
  const PRESETS = [[6, '6 hours'], [12, '12 hours'], [24, '1 day'], [72, '3 days'], [168, '1 week'], [720, '1 month']];
  let hours = 720, picked = new Set(), products = [], promos = [], balance = 0, credit = 0, mounted = false, open = false, paying = false;

  function css() {
    if (document.getElementById('spCss')) return;
    const s = document.createElement('style'); s.id = 'spCss';
    s.textContent = `.sp-card{border-radius:22px;border:1px solid rgba(245,158,11,.4);background:linear-gradient(160deg,rgba(245,158,11,.13),var(--card));padding:18px;margin-bottom:14px}
.sp-h{display:flex;justify-content:space-between;gap:10px;align-items:center}.sp-h b{font-size:18px;font-weight:900;letter-spacing:-.3px}.sp-h p{margin:4px 0 0;color:var(--muted);font-size:12.5px;line-height:1.5}
.sp-chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 10px}.sp-chip{position:relative;padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--card3);color:var(--text);font-weight:800;font-size:13px;cursor:pointer;min-height:42px}
.sp-chip.on{background:#f59e0b;color:#1a1100;border-color:#f59e0b}.sp-chip i{position:absolute;top:-9px;right:6px;font-style:normal;font-size:9px;font-weight:900;background:#22c55e;color:#052e16;padding:2px 6px;border-radius:999px;letter-spacing:.4px}
.sp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sp-row input[type=number]{width:100px}
.sp-price{margin:14px 0;padding:14px;border-radius:16px;background:var(--card3);border:1px solid var(--border2);display:flex;justify-content:space-between;align-items:center;gap:10px}
.sp-price b{font-size:26px;letter-spacing:-.6px}.sp-price small{color:var(--muted);display:block;font-size:11.5px}
.sp-table{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 12px;font-size:11px;text-align:center}.sp-table div{background:var(--card3);border:1px solid var(--border2);border-radius:10px;padding:7px 2px}.sp-table b{display:block;font-size:13px}
.sp-gift{display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.4);margin:12px 0;font-size:13px}.sp-gift b{color:#22c55e}
.sp-prods{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}.sp-prods button{padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:var(--card3);color:var(--text);font-size:12px;font-weight:700;cursor:pointer}
.sp-prods button.on{background:rgba(34,197,94,.18);border-color:#22c55e;color:#22c55e}
.sp-pay{display:grid;gap:8px}.sp-pay button{min-height:50px;border-radius:14px;border:0;font-weight:900;font-size:14px;cursor:pointer}
.sp-w{background:linear-gradient(180deg,#2bd36b,#1fb257);color:#052e16}.sp-g{background:#f59e0b;color:#1a1100}.sp-c{background:var(--card3);color:var(--muted);border:1px dashed var(--border)!important}.sp-pay button:disabled{opacity:.55;cursor:not-allowed}
.sp-item{display:flex;justify-content:space-between;gap:10px;padding:11px 13px;border-radius:14px;background:var(--card3);border:1px solid var(--border2);margin-top:8px;font-size:13px}
.sp-st{font-size:10.5px;font-weight:900;letter-spacing:.5px;text-transform:uppercase;padding:2px 9px;border-radius:999px;align-self:flex-start}
.sp-st.active{background:rgba(34,197,94,.15);color:#22c55e}.sp-st.queued{background:rgba(59,130,246,.15);color:#60a5fa}.sp-st.ended{background:var(--card);color:var(--muted)}`;
    document.head.appendChild(s);
  }
  const left = e => { const m = Math.max(0, Math.floor((new Date(e) - Date.now()) / 60000)); return m >= 1440 ? Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h' : m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };
  const hw = n => (n < 24 || n % 24 !== 0 && n < 48) ? n + ' hour' + (n === 1 ? '' : 's') : n + ' hours (' + (n / 24 % 1 ? (n / 24).toFixed(1) : n / 24) + ' days)';

  function draw() {
    const box = document.getElementById('promoCard'); if (!box) return;
    const live = promos.find(p => p.state === 'active');
    const sub = live ? `<span style="color:#22c55e;font-weight:800">● Live</span> • ends in ${left(live.ends_at)}` : (credit ? `🎁 ${hw(credit)} free credit • tap to open` : 'R1 per hour for a month • tap to open');
    const header = `<div class="sp-h" data-toggle role="button" tabindex="0" style="cursor:pointer"><div><b>📣 Promote your store</b><p style="margin:3px 0 0">${sub}</p></div><span style="font-size:18px;color:var(--muted)">${open ? '▲' : '▼'}</span></div>`;
    if (!open) { box.innerHTML = header; return; }
    const total = price(hours), perHour = total / hours, enough = balance >= total, canCredit = credit >= hours;
    box.innerHTML = header + `<div class="sp-body">
      <p style="margin:12px 0 0;color:var(--muted);font-size:12.5px;line-height:1.5">Appear at the top of the shop with a Sponsored label for shoppers within 15&nbsp;km. <b style="color:var(--text)">R1 per hour for a full month (720 hours).</b> Shorter plans cost a little more per hour.</p>
      ${credit ? `<div class="sp-gift"><span style="font-size:22px">🎁</span><div><b>${hw(credit)} of free promotion</b><br><span style="color:var(--muted);font-size:12px">A gift from BuyEasy. Use it below.</span></div></div>` : ''}
      <div class="sp-chips">${PRESETS.map(([d, l]) => `<button class="sp-chip ${hours === d ? 'on' : ''}" data-d="${d}">${l}${d === 720 ? '<i>BEST VALUE</i>' : ''}</button>`).join('')}</div>
      <div class="sp-row"><label style="font-size:12px;color:var(--muted)">Or type the hours</label><input id="spHours" type="number" min="1" max="2160" value="${hours}"><span style="font-size:12px;color:var(--muted)">1 to 2160 hours</span></div>
      <div class="sp-price"><div><small>Total price • ${hw(hours)}</small><b>${money(total)}</b><small>${money(perHour)} per hour${hours < 720 ? ' • a full month is R1 per hour' : ''}</small></div><div style="text-align:right"><small>Your wallet</small><b style="font-size:16px">${money(balance)}</b></div></div>
      <div class="sp-table">${PRESETS.map(([d, l]) => `<div><small>${l}</small><b>${money(price(d))}</b></div>`).join('')}</div>
      ${products.length ? `<div style="font-size:12px;font-weight:800;margin-top:4px">Feature products (optional, up to 6)</div><div class="sp-prods">${products.map(p => `<button class="${picked.has(p.id) ? 'on' : ''}" data-p="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>` : ''}
      <input id="spTag" maxlength="80" placeholder="Short message for shoppers (optional), e.g. Fresh bread daily" style="width:100%;margin-bottom:12px">
      <div class="sp-pay">
        ${credit ? `<button class="sp-g" data-pay="credit" ${canCredit && !paying ? '' : 'disabled'}>${canCredit ? '🎁 Use ' + hw(hours) + ' of free credit' : 'Free credit is ' + hw(credit) + ' (choose ' + credit + ' hour' + (credit === 1 ? '' : 's') + ' or less)'}</button>` : ''}
        <button class="sp-w" data-pay="wallet" ${enough && !paying ? '' : 'disabled'}>${enough ? 'Pay ' + money(total) + ' from wallet' : 'Wallet balance too low'}</button>
        <button class="sp-c" disabled>💳 Pay with card (coming soon)</button></div>
      <div style="font-weight:900;margin:18px 0 0">My promotions</div>
      ${promos.length ? promos.map(p => { return `<div class="sp-item"><div><b>${hw(p.hours)} • ${p.payment_method === 'credit' ? 'Free credit' : money(p.amount)}</b><div style="color:var(--muted);font-size:12px;margin-top:2px">${p.state === 'active' ? 'Ends in ' + left(p.ends_at) : p.state === 'queued' ? 'Starts ' + new Date(p.starts_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Ended ' + new Date(p.ends_at).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}</div></div><span class="sp-st ${p.state}">${p.state}</span></div>`; }).join('')
        : '<p style="color:var(--muted);font-size:12.5px;margin:6px 0 0">No promotions yet. Your first one starts as soon as you pay.</p>'}</div>`;
  }

  async function refresh() {
    if (typeof currentStore === 'undefined' || !currentStore) return;
    try {
      const [w, pr, pd, cr] = await Promise.all([
        db.from('wallets').select('balance').eq('user_id', currentStore.owner_id).maybeSingle(),
        db.rpc('store_my_promotions'),
        db.from('products').select('id,name').eq('store_id', currentStore.id).order('name').limit(60),
        db.rpc('store_promo_credit', { p_store_id: currentStore.id })]);
      balance = Number(w.data?.balance || 0); promos = pr.data || []; products = pd.data || []; credit = Number(cr.data || 0);
      if (!paying) draw();
    } catch (e) { console.warn('Promotions:', e.message || e); }
  }

  async function buy(method) {
    if (paying) return;                                   // one tap = one purchase
    hours = Math.max(1, Math.min(2160, Number(document.getElementById('spHours')?.value) || hours));
    const total = price(hours), useCredit = method === 'credit';
    const ok = await BuyEasyUI.confirm(useCredit ? `${hw(hours)} of your free credit will be used and your store will be featured.` : `${money(total)} will be taken from your wallet and your store will be featured for ${hw(hours)}.`,
      { title: useCredit ? 'Use free credit?' : 'Pay for promotion?', okLabel: useCredit ? 'Use free credit' : `Pay ${money(total)}`, icon: useCredit ? '🎁' : '📣' });
    if (!ok) return;
    paying = true; draw();
    const wait = BuyEasyUI.progress('Activating your promotion…');
    try {
      const { error } = await db.rpc('store_buy_promotion', { p_store_id: currentStore.id, p_hours: hours, p_product_ids: [...picked], p_tagline: (document.getElementById('spTag') || {}).value || '', p_use_credit: useCredit });
      wait.done();
      if (error) throw error;
      if (typeof notify === 'function') notify('Promotion activated. Your store is now featured.');
      picked.clear();
    } catch (e) { try { wait.done(); } catch (_) {} BuyEasyUI.alert(e.message || 'Could not buy the promotion.', { dialog: true, title: 'Promotion not bought' }); }
    finally { paying = false; await refresh(); draw(); }
  }

  function mount() {
    if (mounted) return; const stock = document.getElementById('stock'); if (!stock) return;
    css(); const c = document.createElement('div'); c.id = 'promoCard'; c.className = 'sp-card'; stock.insertBefore(c, stock.firstChild); mounted = true;
    c.addEventListener('click', e => {
      if (e.target.closest('[data-toggle]')) { open = !open; return draw(); }
      const d = e.target.closest('[data-d]'); if (d) { hours = Number(d.dataset.d); return draw(); }
      const p = e.target.closest('[data-p]'); if (p) { const id = p.dataset.p; if (picked.has(id)) picked.delete(id); else if (picked.size < 6) picked.add(id); return draw(); }
      const pay = e.target.closest('[data-pay]'); if (pay) buy(pay.dataset.pay);
    });
    c.addEventListener('input', e => {
      if (e.target.id !== 'spHours') return;
      hours = Math.max(1, Math.min(2160, Number(e.target.value) || 1));
      const total = price(hours), pr = c.querySelector('.sp-price b'); if (pr) pr.textContent = money(total);
      const w = c.querySelector('.sp-w'); if (w) { w.disabled = balance < total; w.textContent = balance < total ? 'Wallet balance too low' : 'Pay ' + money(total) + ' from wallet'; }
      const g = c.querySelector('.sp-g'); if (g) g.disabled = credit < hours;
    });
  }
  async function markVerified() {
    if (typeof currentStore === 'undefined' || !currentStore || !window.BuyEasyBadge) return;
    await BuyEasyBadge.loadStores([currentStore.id]);
    const n = document.getElementById('storeName'); if (n && !n.querySelector('.be-vbadge') && BuyEasyBadge.store(currentStore.id).is_verified) n.insertAdjacentHTML('beforeend', BuyEasyBadge.icon(16));
  }
  const origOpen = window.openTab;
  if (typeof origOpen === 'function') window.openTab = function (id, el) { origOpen(id, el); if (id === 'stock') refresh(); };
  document.addEventListener('DOMContentLoaded', () => {
    const t = setInterval(() => { if (typeof currentStore !== 'undefined' && currentStore) { clearInterval(t); mount(); refresh(); markVerified(); } }, 700);
    if (window.BuyEasyPoll) BuyEasyPoll.every(() => refresh(), { fast: 300000, slow: 600000, relaxed: 600000 }); else setInterval(() => { if (!document.hidden) refresh(); }, 300000);
  });
})();
