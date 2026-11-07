/* BUYEasy - Rider screen (Supabase)
   Jobs tab      = INCOMING jobs only (ready orders from stores that approved me, while I am online).
   Deliveries    = Active (accepted / picked up) and History (delivered / cancelled).
   Steps         = Accept -> Picked up -> Delivered. Every step tells the rider what happens next.
   Alerts        = new jobs, cash to collect, store approvals and cancellations ring until attended. */
(function () {
  'use strict';
  const db = window.supabaseClient;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => 'R' + Number(v || 0).toFixed(2);
  const REFRESH_MS = 15000;
  const cleanPhone = p => { let n = String(p || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '27' + n.slice(1); return n; };
  const alertBus = () => window.BuyEasyAlerts || { alert() {}, resolve() {}, ack() {} };
  const done = m => (typeof window.showDone === 'function' ? window.showDone(m) : alert(m));

  let rolePromise = null, jobs = [], deliveries = [], myStores = [], availableStores = [];
  let online = false, busy = false, firstStoresLoad = true;

  /* ---------- session ---------- */
  async function session() {
    if (!db) throw new Error('Supabase is not connected.');
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Please sign in again.');
    if (!rolePromise) {
      rolePromise = db.rpc('switch_dashboard_role', { p_role: 'rider' }).then(r => {
        if (r.error) { rolePromise = null; throw r.error; } return true; });
    }
    await rolePromise;
    return data.session.user;
  }

  /* ---------- contact icons ---------- */
  function contactIcons(phone, name, orderNo) {
    const n = cleanPhone(phone);
    if (n.length < 9) return '';
    const wa = encodeURIComponent(`Hello ${name || ''}, this is your BuyEasy rider about order ${orderNo || ''}.`);
    const base = 'display:inline-grid;place-items:center;width:42px;height:42px;border-radius:50%;color:#fff;text-decoration:none';
    return `<div style="display:flex;gap:10px;margin:8px 0">
      <a aria-label="Call customer" href="tel:+${n}" style="${base};background:#22c55e"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1z"/></svg></a>
      <a aria-label="WhatsApp customer" href="https://wa.me/${n}?text=${wa}" target="_blank" rel="noopener" style="${base};background:#25D366"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/><path d="M8.5 8.5c.5 2.5 3 5 5.5 5.5l1.2-1.2-2-1-.8.8c-1-.5-1.8-1.3-2.3-2.3l.8-.8-1-2z" fill="currentColor" stroke="none"/></svg></a></div>`;
  }

  /* ---------- online / offline ---------- */
  function applyOnline(v) {
    online = !!v;
    try { isOnline = online; } catch (e) { window.isOnline = online; }
    if (typeof window.updateOnlineUI === 'function') window.updateOnlineUI();
  }
  async function loadOnline() {
    await session();
    const { data, error } = await db.rpc('rider_get_online');
    if (error) throw error;
    applyOnline(!!data);
  }
  async function toggleOnline() {
    try {
      await session();
      const want = !online;
      const { error } = await db.rpc('rider_set_online', { p_online: want });
      if (error) throw error;
      applyOnline(want);
      done(want ? 'You are ONLINE. New jobs from your approved stores will ring here.' : 'You are OFFLINE. You will not receive new jobs.');
      busy = false; await renderJobs();
    } catch (e) { console.error(e); alert(e.message || 'Could not change your status.'); }
  }
  async function riderGoOffline() { try { await db.rpc('rider_set_online', { p_online: false }); } catch (e) {} }

  /* ---------- my stores ---------- */
  async function loadStores() {
    await session();
    const [mine, avail] = await Promise.all([db.rpc('rider_list_my_stores'), db.rpc('rider_list_available_stores')]);
    if (mine.error) throw mine.error; if (avail.error) throw avail.error;
    myStores = mine.data || []; availableStores = avail.data || [];
    myStores.forEach(s => {
      if (s.status === 'approved') alertBus().alert({ id: `link:${s.link_id}:approved`, icon: '✅', title: 'Store approved you', body: `${s.store_name} approved your request. Go online to receive its orders.`, ring: true, actionLabel: 'OK' });
      if (s.status === 'rejected') alertBus().alert({ id: `link:${s.link_id}:rejected`, icon: '⚠️', title: 'Store declined your request', body: `${s.store_name} declined your request.`, ring: false });
    });
  }
  const badge = s => { const m = { approved: ['#22c55e', 'Approved'], pending: ['#f59e0b', 'Waiting for store'], rejected: ['#ef4444', 'Declined'], removed: ['#9ca3af', 'Removed'] }[s] || ['#9ca3af', s];
    return `<span style="color:${m[0]};font-weight:800;font-size:11px">${esc(m[1])}</span>`; };
  function drawStores() {
    const el = document.getElementById('myStoresPanel'); if (!el) return;
    const mine = myStores.length ? myStores.map(s => `<div class="hist-item" style="align-items:center"><div><b>${esc(s.store_name || 'Store')}</b><div>${badge(s.status)}</div></div>
      <div>${['approved', 'pending'].includes(s.status) ? `<button class="btn-white" style="padding:8px 12px;font-size:12px" onclick="leaveStore('${esc(s.store_id)}')">${s.status === 'pending' ? 'Cancel' : 'Leave'}</button>`
        : `<button class="btn-green" style="padding:8px 12px;font-size:12px" onclick="requestStore('${esc(s.store_id)}')">Ask again</button>`}</div></div>`).join('')
      : '<p class="status">You are not working for any store yet. Ask a store below. You only see orders from stores that approve you.</p>';
    const avail = availableStores.length ? availableStores.map(s => `<div class="hist-item" style="align-items:center"><div><b>${esc(s.store_name || 'Store')}</b></div>
      <div><button class="btn-green" style="padding:8px 12px;font-size:12px" onclick="requestStore('${esc(s.store_id)}')">Ask to work here</button></div></div>`).join('')
      : '<p class="status">No other stores to ask right now.</p>';
    el.innerHTML = `<div style="font-weight:900;margin-bottom:6px">My Stores</div>${mine}<div style="font-weight:900;margin:14px 0 6px">Stores you can ask</div>${avail}`;
  }
  async function renderStores() { try { await loadStores(); drawStores(); } catch (e) { const el = document.getElementById('myStoresPanel'); if (el) el.innerHTML = `<p class="status">Could not load stores: ${esc(e.message)}</p>`; } }
  async function requestStore(id) { try { await session(); const { error } = await db.rpc('rider_request_store', { p_store_id: id }); if (error) throw error; done('Request sent. The store must approve you.'); await renderStores(); } catch (e) { alert(e.message || 'Could not send request.'); } }
  async function leaveStore(id) { if (!confirm('Stop working for this store? You will no longer see its orders.')) return;
    try { await session(); const { error } = await db.rpc('rider_leave_store', { p_store_id: id }); if (error) throw error; busy = false; await Promise.all([renderStores(), renderJobs()]); } catch (e) { alert(e.message || 'Could not update.'); } }

  /* ---------- INCOMING JOBS (only ready + not yet accepted) ---------- */
  async function loadJobs() {
    const user = await session();
    if (!online) { jobs = []; return; }
    const { data, error } = await db.from('orders')
      .select('id,order_number,status,buyer_id,store_id,customer_name,customer_phone,delivery_address,product_total,delivery_fee,total,rider_net,payment_method,created_at,stores(owner_id,store_name),order_items(product_name,quantity)')
      .eq('status', 'ready').is('assigned_rider_id', null).order('created_at', { ascending: false });
    if (error) throw error;
    jobs = (data || []).filter(o => o.stores?.owner_id !== user.id && o.buyer_id !== user.id);
  }
  function jobAlerts() {
    const ids = new Set(jobs.map(o => 'job:' + o.id));
    jobs.forEach(o => alertBus().alert({ id: 'job:' + o.id, icon: '🏍️', title: 'New delivery job!',
      body: `${o.stores?.store_name || 'Store'} → ${o.delivery_address}\nEarn up to ${money(o.rider_net)}${o.payment_method === 'cash' ? '\n💵 Cash on delivery' : ''}`,
      ring: true, actionLabel: 'View job', onAction: () => { const t = document.getElementById('bnav-jobs'); if (t && window.openTab) window.openTab('jobs', t); } }));
    document.querySelectorAll('#beAlerts button[data-id^="job:"]').forEach(b => { if (!ids.has(b.dataset.id)) alertBus().resolve(b.dataset.id); });
  }
  function drawJobs() {
    const el = document.getElementById('jobsList'); if (!el) return;
    const q = (document.getElementById('jobSearch')?.value || '').trim().toLowerCase();
    const rows = jobs.filter(o => `${o.order_number} ${o.customer_name} ${o.stores?.store_name} ${(o.order_items || []).map(i => i.product_name).join(' ')}`.toLowerCase().includes(q));
    const top = document.getElementById('jobCountTop'); if (top) top.textContent = rows.length + ' jobs';
    if (!online) { el.innerHTML = '<p style="padding:20px;text-align:center;color:var(--muted)">You are <b>offline</b>. Tap the switch at the top to go <b>Online</b> and receive jobs.</p>'; return; }
    if (!rows.length) { el.innerHTML = myStores.some(s => s.status === 'approved')
      ? '<p style="padding:20px;text-align:center;color:var(--muted)">No incoming jobs right now. This phone will ring when a store has an order ready.</p>'
      : '<p style="padding:20px;text-align:center;color:var(--muted)">You are not approved by any store yet. Ask a store under <b>My Stores</b> above.</p>'; return; }
    el.innerHTML = rows.map(o => {
      const items = (o.order_items || []).map(i => `${esc(i.product_name)} × ${Number(i.quantity) || 0}`).join(', ');
      return `<div class="job-card"><div class="job-top"><b>${esc(o.stores?.store_name || 'Store')} • ${esc(o.order_number)}</b><b>${money(o.total)}</b></div>
        <div class="job-body"><div>Customer: <b>${esc(o.customer_name)}</b></div>${contactIcons(o.customer_phone, o.customer_name, o.order_number)}
          <div>📍 ${esc(o.delivery_address)}</div><div>🛍️ ${items}</div>
          ${o.payment_method === 'cash' ? `<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(245,158,11,.15);color:#f59e0b;font-weight:800">💵 Cash on delivery: collect ${money(o.total)} from the buyer</div>` : ''}
          <div class="status">Earn up to ${money(o.rider_net)}<br><small>Final fee is confirmed when you accept.</small></div>
          <button onclick="acceptJob('${esc(o.id)}')" class="btn-green">Accept job</button></div></div>`;
    }).join('');
  }
  async function renderJobs() {
    if (busy) return; busy = true;
    try { await loadStores().then(drawStores).catch(() => {}); await loadJobs(); jobAlerts(); drawJobs(); }
    catch (e) { console.error(e); const el = document.getElementById('jobsList'); if (el) el.innerHTML = `<p class="status">Could not load jobs: ${esc(e.message)}</p>`; }
    finally { busy = false; }
  }

  /* ---------- DELIVERIES ---------- */
  async function loadDeliveries() {
    const user = await session();
    const { data, error } = await db.from('orders')
      .select('id,order_number,status,customer_name,customer_phone,delivery_address,buyer_latitude,buyer_longitude,total,delivery_fee,rider_net,payment_method,payment_status,cancel_reason,created_at,updated_at,stores(store_name,latitude,longitude,phone),order_items(product_name,quantity)')
      .eq('assigned_rider_id', user.id).order('updated_at', { ascending: false }).limit(100);
    if (error) throw error;
    deliveries = data || [];
  }
  const when = d => new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  function stepBar(status) {
    const s = { assigned: 1, picked_up: 2, delivered: 3 }[status] || 1;
    const dot = (n, label) => `<div style="flex:1;text-align:center;font-size:10px;font-weight:800;color:${s >= n ? '#22c55e' : 'var(--muted)'}"><div style="height:6px;border-radius:4px;background:${s >= n ? '#22c55e' : 'var(--border)'};margin-bottom:4px"></div>${label}</div>`;
    return `<div style="display:flex;gap:6px;margin:8px 0">${dot(1, 'Accepted')}${dot(2, 'Picked up')}${dot(3, 'Delivered')}</div>`;
  }
  function drawDeliveries() {
    const el = document.getElementById('delList'); if (!el) return;
    const tab = (typeof curDelTab !== 'undefined') ? curDelTab : 'active';
    const active = deliveries.filter(o => ['assigned', 'picked_up'].includes(o.status));
    const history = deliveries.filter(o => ['delivered', 'cancelled'].includes(o.status));
    const c = document.getElementById('delCount'); if (c) c.textContent = active.length ? `(${active.length})` : '';
    if (tab === 'history') {
      el.innerHTML = history.length ? history.map(o => `<div class="hist-item"><div><b>${esc(o.customer_name)} • ${money(o.total)}</b>
        <div class="status">${esc(o.order_number)} • ${esc(o.stores?.store_name || '')}</div><div class="status">${when(o.updated_at)}</div>
        ${o.status === 'cancelled' ? `<div class="status" style="color:#ef4444">Cancelled${o.cancel_reason ? ': ' + esc(o.cancel_reason) : ''}</div>` : `<div class="status" style="color:#22c55e">Delivered • You earned ${money(o.rider_net)}</div>`}</div></div>`).join('')
        : '<p class="status">No completed deliveries yet.</p>';
      return;
    }
    el.innerHTML = active.length ? active.map(o => {
      const toStore = o.status === 'assigned';
      const cash = o.payment_method === 'cash' ? `<div style="margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(245,158,11,.15);color:#f59e0b;font-weight:800">💵 Collect ${money(o.total)} cash from the customer</div>` : '';
      return `<div class="job-card"><div class="job-top"><b>${esc(o.stores?.store_name || 'Store')} • ${esc(o.order_number)}</b><b>${money(o.total)}</b></div>
        <div class="job-body">${stepBar(o.status)}
          <div style="font-weight:900">${toStore ? '👉 Next: go to the store and pick up the order' : '👉 Next: deliver to the customer'}</div>
          <div style="margin-top:6px">Customer: <b>${esc(o.customer_name)}</b></div>${contactIcons(o.customer_phone, o.customer_name, o.order_number)}
          <div>📍 ${esc(o.delivery_address)}</div><div>🛍️ ${(o.order_items || []).map(i => `${esc(i.product_name)} × ${Number(i.quantity) || 0}`).join(', ')}</div>${cash}
          <div class="status">You earn ${money(o.rider_net)}</div>
          <button class="btn-white" onclick="trackOrder('${esc(o.id)}')">🗺️ Track route</button>
          ${toStore ? `<button class="btn-green" onclick="markPickedUp('${esc(o.id)}')">📦 Picked up</button>` : `<button class="btn-green" onclick="completeDel('${esc(o.id)}')">✅ Delivered</button>`}
        </div></div>`;
    }).join('') : '<p class="status">No active deliveries. Accept a job from the Jobs tab.</p>';
  }
  function trackingFeed() {
    const a = deliveries.find(o => ['assigned', 'picked_up'].includes(o.status));
    if (!window.RiderTracking) return;
    RiderTracking.setActive(a ? { id: a.id, status: a.status, storeName: a.stores?.store_name, storeLat: a.stores?.latitude, storeLng: a.stores?.longitude,
      buyerLat: a.buyer_latitude, buyerLng: a.buyer_longitude, customer: a.customer_name, address: a.delivery_address, cash: a.payment_method === 'cash' ? a.total : 0 } : null);
  }
  function cancelAlerts() {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    deliveries.filter(o => o.status === 'cancelled' && new Date(o.updated_at).getTime() > cutoff).forEach(o =>
      alertBus().alert({ id: 'cancel:' + o.id, icon: '❌', title: `Order ${o.order_number} was cancelled`, body: o.cancel_reason || 'This order was cancelled.', ring: true, actionLabel: 'OK' }));
  }
  async function renderDeliveries() {
    try { await loadDeliveries(); cancelAlerts(); drawDeliveries(); trackingFeed(); }
    catch (e) { console.error(e); const el = document.getElementById('delList'); if (el) el.innerHTML = `<p class="status">Could not load deliveries: ${esc(e.message)}</p>`; }
  }
  function goTab(id, navId) { const t = document.getElementById(navId); if (t && window.openTab) window.openTab(id, t); }

  /* ---------- the 3 steps ---------- */
  async function acceptJob(id) {
    try {
      const job = jobs.find(o => o.id === id);
      const { data, error } = await db.rpc('rider_pick_order', { p_order_id: id });
      if (error) throw error;
      alertBus().ack('job:' + id);
      done(`Order accepted ✔ Head to ${job?.stores?.store_name || 'the store'} and collect it. You will earn ${money(data?.rider_net)}.`);
      if (data?.payment_method === 'cash') alertBus().alert({ id: 'cash:' + id, icon: '💵', title: 'Cash on delivery', body: `This buyer pays CASH. Collect ${money(data.cash_to_collect)} from the buyer when you deliver.`, ring: true, actionLabel: 'Got it' });
      if (typeof window.setDelTab === 'function') window.setDelTab('active');
      busy = false; await Promise.all([renderJobs(), renderDeliveries(), updateStats()]);
      goTab('deliveries', 'bnav-del');
    } catch (e) { console.error(e); alert(e.message || 'Could not accept this delivery.'); }
  }
  async function markPickedUp(id) {
    try {
      const { data, error } = await db.rpc('rider_mark_picked_up', { p_order_id: id });
      if (error) throw error;
      done('Picked up ✔ Now deliver to the customer. The buyer has been told the order is on the way.');
      if (data?.payment_method === 'cash') alertBus().alert({ id: 'cashdrop:' + id, icon: '💵', title: 'Collect cash at delivery', body: `Collect ${money(data.cash_to_collect)} cash from the buyer.`, ring: true, actionLabel: 'Got it' });
      await Promise.all([renderDeliveries()]);
    } catch (e) { console.error(e); alert(e.message || 'Could not update the order.'); }
  }
  async function completeDel(id) {
    try {
      const o = deliveries.find(x => x.id === id);
      if (o?.payment_method === 'cash' && !confirm(`Cash order. Have you collected ${money(o.total)} from the buyer?`)) return;
      const { data, error } = await db.rpc('rider_deliver_order', { p_order_id: id });
      if (error) throw error;
      ['cash:', 'cashdrop:'].forEach(p => alertBus().resolve(p + id));
      done(data?.settlement_pending ? 'Delivered ✔ Cash order recorded. Earnings appear after cash settlement.' : `Delivered ✔ Well done! You earned ${money(data?.rider_net ?? o?.rider_net)}.`);
      if (typeof window.setDelTab === 'function') window.setDelTab('history');
      busy = false; await Promise.all([renderJobs(), renderDeliveries(), updateStats(), renderHistory()]);
      goTab('deliveries', 'bnav-del');
      if (window.BuyEasyRatings) setTimeout(() => BuyEasyRatings.check(true), 1500);
    } catch (e) { console.error(e); alert(e.message || 'Could not complete delivery.'); }
  }
  function trackOrder(id) { const o = deliveries.find(x => x.id === id); trackingFeed(); goTab('map', 'bnav-map'); }

  /* ---------- wallet / history ---------- */
  async function updateStats() {
    try {
      const user = await session();
      const [w, t] = await Promise.all([
        db.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
        db.from('transactions').select('amount,created_at,type').eq('user_id', user.id).eq('type', 'rider_earning').order('created_at', { ascending: false }).limit(100)]);
      if (w.error) throw w.error; if (t.error) throw t.error;
      for (const id of ['balanceTop', 'wallet']) { const el = document.getElementById(id); if (el) el.textContent = money(w.data?.balance); }
      const today = (t.data || []).filter(x => new Date(x.created_at).toDateString() === new Date().toDateString()).reduce((n, x) => n + Number(x.amount), 0);
      const te = document.getElementById('todayEarned'); if (te) te.textContent = money(today);
    } catch (e) { console.warn('Wallet refresh failed', e); }
  }
  async function renderHistory() {
    try {
      const user = await session();
      const { data, error } = await db.from('transactions').select('amount,description,created_at,type').eq('user_id', user.id).in('type', ['rider_earning', 'withdrawal']).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const earns = (data || []).filter(x => x.type === 'rider_earning'), wd = (data || []).filter(x => x.type === 'withdrawal');
      const e = document.getElementById('earnHist'), w = document.getElementById('withHist');
      if (e) e.innerHTML = earns.length ? earns.map(x => `<div class="hist-item"><div>${esc(x.description)}<div class="status">${when(x.created_at)}</div></div><b style="color:#22c55e">+${money(x.amount)}</b></div>`).join('') : '<p class="status">No earnings yet.</p>';
      if (w) w.innerHTML = wd.length ? wd.map(x => `<div class="hist-item">${esc(x.description)} <b>${money(x.amount)}</b></div>`).join('') : '<p class="status">No withdrawals yet.</p>';
    } catch (e) { console.warn('History refresh failed', e); }
  }

  Object.assign(window, { renderJobs, acceptJob, markPickedUp, completeDel, trackOrder, renderDeliveries, updateStats, renderHistory,
    renderStores, requestStore, leaveStore, toggleOnline, riderGoOffline });
  window.withdraw = () => alert('Withdrawals are not connected yet. Your balance has not been changed.');

  async function refreshAll() { try { await loadOnline(); } catch (e) { console.warn(e); } await Promise.all([renderJobs(), renderDeliveries(), updateStats(), renderHistory()]); }
  document.addEventListener('DOMContentLoaded', () => {
    refreshAll();
    db.rpc('cancel_stale_orders').then(() => {}, () => {});
    setInterval(() => { if (!document.hidden) { renderJobs(); renderDeliveries(); } }, REFRESH_MS);
    setInterval(() => { if (!document.hidden) { updateStats(); db.rpc('cancel_stale_orders').then(() => {}, () => {}); } }, 300000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderJobs(); renderDeliveries(); } });
  }, { once: true });
})();
