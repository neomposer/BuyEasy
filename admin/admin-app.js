/* BUYEasy Admin - simple, fully working dashboard (Supabase). */
(function () {
  'use strict';
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => 'R' + Number(v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = v => Number(v || 0).toLocaleString('en-ZA');
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0) + '%';
  const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
  const when = d => (d ? new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : 'never');
  const ago = d => { if (!d) return 'never'; const h = (Date.now() - new Date(d)) / 36e5; return h < 1 ? 'just now' : h < 24 ? Math.floor(h) + 'h ago' : Math.floor(h / 24) + 'd ago'; };
  const rpc = async (name, args) => { const { data, error } = await db.rpc(name, args || {}); if (error) throw error; return data; };
  function toast(m) { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = 'none', 2600); }
  const statusTag = s => ({ active: '<span class="tag t-g">Active</span>', flagged: '<span class="tag t-a">Flagged</span>', suspended: '<span class="tag t-r">Suspended</span>' }[s] || '');

  const TABS = [['overview', '📊 Overview'], ['stores', '🏪 Stores'], ['riders', '🏍️ Riders'], ['orders', '📦 Orders'], ['users', '👥 Users'],
    ['ratings', '⭐ Ratings'], ['feedback', '💬 Feedback'], ['news', '📢 Announcements'], ['promos', '📣 Promotions'], ['support', '🛟 Support'], ['settings', '⚙️ Settings']];
  const S = { tab: 'overview', days: 30, badges: {}, ordFilter: 'all', ordSearch: '', userRole: 'all', userSearch: '', rateRole: 'store', rateSort: 'low', fbRole: 'all', fbSort: 'low', tkStatus: 'open', storeSort: 'sales' };

  function drawNav() {
    $('nav').innerHTML = TABS.map(([id, label]) => {
      const n = { stores: S.badges.pending_stores, riders: S.badges.pending_riders, support: S.badges.open_tickets }[id];
      return `<button class="${S.tab === id ? 'on' : ''}" data-t="${id}">${label}${n > 0 ? `<span class="dot">${n}</span>` : ''}</button>`;
    }).join('');
  }
  $('nav').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) go(b.dataset.t); });
  const chips = (list, cur, key) => `<div class="row">${list.map(([v, l]) => `<button class="chip ${cur === v ? 'on' : ''}" data-set="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  $('view').addEventListener('click', e => {
    const c = e.target.closest('[data-set]');
    if (c) { const v = c.dataset.v; S[c.dataset.set] = isNaN(v) || v === '' ? v : Number(v); return render(); }
    const a = e.target.closest('[data-act]'); if (a) action(a.dataset.act, a.dataset);
  });
  $('view').addEventListener('input', e => {
    if (e.target.dataset.search) { clearTimeout(input.t); input.t = setTimeout(() => { S[e.target.dataset.search] = e.target.value; render(true); }, 350); }
  });
  const input = {};

  async function go(t) { S.tab = t; drawNav(); await render(); }
  async function render(keepFocus) {
    const v = $('view');
    if (!keepFocus) v.innerHTML = '<div class="empty">Loading…</div>';
    try { await VIEWS[S.tab](v); }
    catch (e) { console.error(e); v.innerHTML = `<div class="card err">Could not load this page: ${esc(e.message)}<br><small>If this mentions a missing function, run the 02 and 03 SQL files in Supabase.</small></div>`; }
    if (keepFocus) { const f = v.querySelector('[data-search]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
  }
  async function loadBadges() { try { S.badges = await rpc('admin_analytics', { p_days: 30 }); drawNav(); } catch (e) { console.warn(e); } }

  /* ---------------- actions ---------------- */
  async function action(kind, d) {
    try {
      if (kind === 'store-review') { if (!(await BuyEasyUI.confirm(d.dec === 'approved' ? 'The store can start selling right away.' : 'The applicant will be told it was rejected.', { title: d.dec === 'approved' ? 'Approve this store?' : 'Reject this store?', okLabel: d.dec === 'approved' ? 'Approve' : 'Reject', danger: d.dec !== 'approved' }))) return; await rpc('admin_review_store_application', { p_application_id: d.id, p_decision: d.dec }); toast('Done'); }
      else if (kind === 'rider-review') { if (!(await BuyEasyUI.confirm(d.dec === 'approved' ? 'The rider can ask stores to work for them.' : 'The applicant will be told it was rejected.', { title: d.dec === 'approved' ? 'Approve this rider?' : 'Reject this rider?', okLabel: d.dec === 'approved' ? 'Approve' : 'Reject', danger: d.dec !== 'approved' }))) return; await rpc('admin_review_rider_application', { p_application_id: d.id, p_decision: d.dec }); toast('Done'); }
      else if (kind === 'status') {
        const word = { flagged: 'flag', suspended: 'SUSPEND', active: 'clear' }[d.st];
        if (!(await BuyEasyUI.confirm(`${d.email || 'This account'} will be ${d.st === 'active' ? 'cleared' : d.st === 'flagged' ? 'flagged for review' : 'suspended and blocked from using BuyEasy'}.`, { title: `${word[0].toUpperCase() + word.slice(1)} this account?`, okLabel: word[0].toUpperCase() + word.slice(1), danger: d.st === 'suspended', icon: d.st === 'active' ? '✅' : d.st === 'flagged' ? '🚩' : '⛔' }))) return;
        const note = d.st === 'active' ? '' : (await BuyEasyUI.prompt('Reason (optional):', '', { title: 'Add a note', placeholder: 'e.g. Fake orders, complaints from stores' })) || '';
        await rpc('admin_set_account_status', { p_user_id: d.id, p_status: d.st, p_note: note }); toast('Account updated');
      }
      else if (kind === 'email') {
        const ne = await BuyEasyUI.prompt(`New email for ${d.email}`, d.email, { title: 'Change email', placeholder: 'name@email.com', okLabel: 'Next' }); if (!ne || ne.trim().toLowerCase() === String(d.email).toLowerCase()) return;
        if (!(await BuyEasyUI.confirm(`From ${d.email}\nto ${ne.trim()}\n\nThe user will be signed out and must log in with the new email.`, { title: 'Change this email?', okLabel: 'Change email', icon: '✉️' }))) return;
        await rpc('admin_change_user_email', { p_user_id: d.id, p_new_email: ne }); toast('Email changed');
      }
      else if (kind === 'reply') {
        const box = document.getElementById('re_' + d.id); const text = box ? box.value : '';
        if (d.mode !== 'close' && !text.trim()) return alert('Write a reply first.');
        await rpc('admin_reply_ticket', { p_ticket_id: d.id, p_reply: d.mode === 'close' ? '' : text, p_close: d.mode !== 'keep' }); toast('Saved');
      }
      else if (kind === 'verify') {
        const make = d.v === '1';
        if (!(await BuyEasyUI.confirm(make ? `${d.email} will show a Verified badge that everyone can see, as a sign of a trusted, well-rated member.` : `The Verified badge will be removed from ${d.email}.`, { title: make ? 'Give the Verified badge?' : 'Remove the badge?', okLabel: make ? 'Give badge' : 'Remove', icon: '🏅' }))) return;
        const note = make ? (await BuyEasyUI.prompt('Why are they verified? (optional)', '', { title: 'Add a note', placeholder: 'e.g. 4.9 rating, 100 deliveries' })) || '' : '';
        await rpc('admin_set_verified', { p_user_id: d.id, p_verified: make, p_note: note }); toast(make ? 'Verified badge given' : 'Badge removed');
      }
      else if (kind === 'announce') {
        const t = $('annTitle').value.trim(), b = $('annBody').value.trim();
        if (t.length < 3 || b.length < 3) return alert('Add a title and a message.');
        await rpc('admin_post_announcement', { p_title: t, p_body: b, p_kind: $('annKind').value, p_audience: $('annAud').value, p_pinned: $('annPin').checked, p_expires_hours: Number($('annExp').value) || null });
        toast('Announcement published');
      }
      else if (kind === 'ann-toggle') { await rpc('admin_set_announcement', { p_id: d.id, p_active: d.on === '1', p_delete: false }); toast(d.on === '1' ? 'Announcement is live' : 'Announcement hidden'); }
      else if (kind === 'ann-del') { if (!(await BuyEasyUI.confirm('This announcement will be removed for everyone.', { title: 'Delete announcement?', okLabel: 'Delete', danger: true }))) return; await rpc('admin_set_announcement', { p_id: d.id, p_active: false, p_delete: true }); toast('Deleted'); }
      else if (kind === 'weather') { const v = $('weatherSel').value; await rpc('admin_set_weather', { p_condition: v }); toast('Weather set to ' + v); return; }
      else if (kind === 'cleanup') { const n = await rpc('cancel_stale_orders'); toast(`Cleanup done. ${n} old order(s) cancelled.`); return; }
      else if (kind === 'comments') { return showComments(d.id, d.email); }
      else if (kind === 'goto') { return go(d.tab); }
      await loadBadges(); await render();
    } catch (e) { alert(e.message || 'Something went wrong.'); }
  }
  const seal = (v, n) => (v && window.BuyEasyBadge ? BuyEasyBadge.icon(n || 15) : '');
  const verifyBtn = (id, verified, email) => `<button class="btn ${verified ? '' : 'g'}" data-act="verify" data-id="${esc(id)}" data-v="${verified ? '0' : '1'}" data-email="${esc(email)}">${verified ? '✔ Remove badge' : '🏅 Verify'}</button>`;
  const accountButtons = (id, status, email) => ['flagged', 'suspended', 'active'].filter(s => s !== status).map(s =>
    `<button class="btn ${s === 'suspended' ? 'r' : s === 'flagged' ? 'a' : 'g'}" data-act="status" data-id="${esc(id)}" data-st="${s}" data-email="${esc(email)}">${{ flagged: '🚩 Flag', suspended: '⛔ Suspend', active: '✔ Clear' }[s]}</button>`).join('');

  /* ---------------- views ---------------- */
  const VIEWS = {
    async overview(v) {
      const a = await rpc('admin_analytics', { p_days: S.days }); S.badges = a; drawNav();
      const top = (await rpc('admin_store_performance', { p_days: S.days })).slice(0, 5);
      const steps = [['Website visitors', a.visitors, null], ['Signed up (from visitors)', a.visitors_registered, a.visitors], ['Placed an order', a.buyers_ordered, a.accounts_total],
        ['Got a delivery', a.buyers_delivered, a.buyers_ordered_all], ['Ordered again', a.repeat_buyers, a.buyers_delivered]];
      const maxv = Math.max(1, ...steps.map(s => Number(s[1])));
      const tot = Math.max(1, a.orders_total);
      v.innerHTML = `<h2>Overview</h2>${chips([[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [0, 'All time']], S.days, 'days')}
      <div class="grid">
        <div class="kpi"><small>BuyEasy earnings</small><b>${money(a.platform_earnings)}</b><i>${money(a.fees_earned)} fees + ${money(a.promo_revenue)} promotions</i></div>
        <div class="kpi"><small>Store sales</small><b>${money(a.sales_delivered)}</b><i>delivered, excl. delivery</i></div>
        <div class="kpi"><small>Orders</small><b>${num(a.orders_total)}</b><i>${num(a.orders_delivered)} delivered</i></div>
        <div class="kpi"><small>Delivery success</small><b>${pct(a.orders_delivered, a.orders_total)}</b><i>${num(a.orders_cancelled)} cancelled</i></div>
        <div class="kpi"><small>Cash orders</small><b>${num(a.orders_cash)}</b><i>no BuyEasy fee on cash</i></div>
        <div class="kpi"><small>New accounts</small><b>${num(a.accounts_new)}</b><i>${num(a.accounts_total)} in total</i></div>
      </div>
      <div class="two" style="margin-top:12px">
        <div class="card funnel"><h3>Customer journey</h3>
          ${steps.map(([l, n, base]) => `<div class="step"><div class="lab"><span>${l}</span><b>${num(n)}${base !== null ? ` <small style="color:var(--muted);font-weight:600">${pct(n, base)}</small>` : ''}</b></div><div class="bar"><div style="width:${Math.round((Number(n) / maxv) * 100)}%"></div></div></div>`).join('')}
          <div class="m" style="color:var(--muted);font-size:11px;margin-top:8px">Visitors are counted from the day this version went live. "Signed up" = visitors who created an account. "Ordered again" = customers with 2 or more delivered orders.</div></div>
        <div class="card"><h3>Order health</h3>
          <div class="stack"><div style="width:${(a.orders_delivered / tot) * 100}%;background:var(--green)"></div><div style="width:${(a.orders_open / tot) * 100}%;background:var(--amber)"></div><div style="width:${(a.orders_cancelled / tot) * 100}%;background:var(--red)"></div></div>
          <div class="row" style="margin-top:10px;font-size:12px"><span class="tag t-g">Delivered ${num(a.orders_delivered)}</span><span class="tag t-a">In progress ${num(a.orders_open)}</span><span class="tag t-r">Cancelled ${num(a.orders_cancelled)}</span></div>
          <h3 style="margin-top:16px">Stores &amp; riders</h3>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <div class="kpi"><small>Active stores</small><b>${num(a.stores_active)}<small style="font-size:13px;color:var(--muted)"> / ${num(a.stores_approved)}</small></b><i>delivered in last 30 days (${pct(a.stores_active, a.stores_approved)})</i></div>
            <div class="kpi"><small>Verified members</small><b>${num(a.verified_users)}</b><i>trusted badge given</i></div>
            <div class="kpi"><small>Online now</small><b>${num(a.stores_online)} <small style="font-size:13px;color:var(--muted)">stores</small></b><i>${num(a.riders_online)} of ${num(a.riders_approved)} riders online</i></div>
          </div></div>
      </div>
      <div class="two">
        <div class="card"><h3>Needs your attention</h3>
          <div class="row"><button class="btn ${a.pending_stores ? 'g' : ''}" data-act="goto" data-tab="stores">🏪 ${num(a.pending_stores)} store applications</button>
          <button class="btn ${a.pending_riders ? 'g' : ''}" data-act="goto" data-tab="riders">🏍️ ${num(a.pending_riders)} rider applications</button>
          <button class="btn ${a.open_tickets ? 'g' : ''}" data-act="goto" data-tab="support">🛟 ${num(a.open_tickets)} open support tickets</button></div></div>
        <div class="card"><h3>Top stores by sales</h3>${top.length ? top.map((s, i) => `<div class="item"><div class="h"><b>${i + 1}. ${esc(s.store_name)}</b><b>${money(s.sales)}</b></div><div class="m">${num(s.orders_delivered)} delivered${s.avg_rating ? ` • <span class="stars">${stars(s.avg_rating)}</span> ${s.avg_rating}` : ''}</div></div>`).join('') : '<div class="empty">No sales yet.</div>'}</div>
      </div>`;
    },

    async stores(v) {
      const [apps, perf] = await Promise.all([
        db.from('store_applications').select('id,user_id,store_name,owner_name,phone,address,status,created_at').eq('status', 'pending').order('created_at', { ascending: false }),
        rpc('admin_store_performance', { p_days: S.days })]);
      if (apps.error) throw apps.error;
      const rows = perf.slice().sort((a, b) => S.storeSort === 'rating' ? (Number(b.avg_rating || 0) - Number(a.avg_rating || 0)) : Number(b.sales) - Number(a.sales));
      v.innerHTML = `<h2>Stores</h2>
      <div class="card"><h3>Waiting for approval (${apps.data.length})</h3>${apps.data.length ? apps.data.map(a => `<div class="item"><div class="h"><div><b>${esc(a.store_name)}</b><div class="m">${esc(a.owner_name)} • ${esc(a.phone)}<br>${esc(a.address)}<br>Applied ${when(a.created_at)}</div></div></div>
        <div class="acts"><button class="btn g" data-act="store-review" data-id="${esc(a.id)}" data-dec="approved">Approve</button><button class="btn r" data-act="store-review" data-id="${esc(a.id)}" data-dec="rejected">Reject</button></div></div>`).join('') : '<div class="empty">No stores are waiting.</div>'}</div>
      <h3>Store performance</h3>${chips([[7, '7 days'], [30, '30 days'], [90, '90 days'], [0, 'All time']], S.days, 'days')}${chips([['sales', 'Best sales'], ['rating', 'Best rated']], S.storeSort, 'storeSort')}
      <div class="card scroll">${rows.length ? `<table><tr><th>#</th><th>Store</th><th>Sales</th><th>Delivered</th><th>Cancelled</th><th>Rating</th><th>Last order</th><th>Status</th><th>Badge</th></tr>${rows.map((s, i) => `<tr><td>${i + 1}</td><td><b>${esc(s.store_name)}</b>${seal(s.is_verified)}<div class="m" style="color:var(--muted);font-size:11px">${esc(s.owner_email)}</div></td><td><b>${money(s.sales)}</b></td><td>${num(s.orders_delivered)}</td><td>${num(s.orders_cancelled)}</td><td>${s.avg_rating ? `<span class="stars">★</span> ${s.avg_rating} <small style="color:var(--muted)">(${s.rating_count})</small>` : '<span style="color:var(--muted)">none</span>'}</td><td>${ago(s.last_order_at)}</td><td>${s.is_online ? '<span class="tag t-g">Online</span>' : '<span class="tag t-n">Offline</span>'}</td><td>${verifyBtn(s.owner_id, s.is_verified, s.store_name)}</td></tr>`).join('')}</table>` : '<div class="empty">No approved stores yet.</div>'}</div>`;
    },

    async riders(v) {
      const [apps, list] = await Promise.all([
        db.from('rider_applications').select('id,user_id,full_name,phone,transport_type,status,created_at').eq('status', 'pending').order('created_at', { ascending: false }),
        rpc('admin_rider_overview')]);
      if (apps.error) throw apps.error;
      v.innerHTML = `<h2>Riders</h2>
      <div class="card"><h3>Waiting for approval (${apps.data.length})</h3>${apps.data.length ? apps.data.map(a => `<div class="item"><b>${esc(a.full_name)}</b><div class="m">${esc(a.phone)} • ${esc(a.transport_type)}<br>Applied ${when(a.created_at)}</div>
        <div class="acts"><button class="btn g" data-act="rider-review" data-id="${esc(a.id)}" data-dec="approved">Approve</button><button class="btn r" data-act="rider-review" data-id="${esc(a.id)}" data-dec="rejected">Reject</button></div></div>`).join('') : '<div class="empty">No riders are waiting.</div>'}</div>
      <div class="card"><h3>Approved riders (${list.length})</h3>${list.length ? list.map(r => `<div class="item"><div class="h"><div><b>${esc(r.full_name)}</b>${seal(r.is_verified)} ${r.is_online ? '<span class="tag t-g">Online</span>' : '<span class="tag t-n">Offline</span>'} ${statusTag(r.status)}<div class="m">${esc(r.email)} • ${esc(r.phone)} • ${esc(r.transport_type)}</div></div>
        <div style="text-align:right"><b>${num(r.deliveries)}</b><div class="m">deliveries</div></div></div>
        <div class="m">${r.avg_rating ? `<span class="stars">${stars(r.avg_rating)}</span> ${r.avg_rating} (${r.rating_count} ratings)` : 'No ratings yet'}</div>
        <div class="acts">${verifyBtn(r.user_id, r.is_verified, r.email)}${accountButtons(r.user_id, r.status, r.email)}<button class="btn" data-act="comments" data-id="${esc(r.user_id)}" data-email="${esc(r.email)}">Comments</button></div></div>`).join('') : '<div class="empty">No approved riders.</div>'}</div>`;
    },

    async orders(v) {
      const rows = await rpc('admin_list_orders', { p_status: S.ordFilter === 'open' ? 'all' : S.ordFilter, p_search: S.ordSearch, p_limit: 150 });
      const list = S.ordFilter === 'open' ? rows.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status)) : rows;
      const tone = s => s === 'delivered' ? 't-g' : ['cancelled', 'rejected'].includes(s) ? 't-r' : 't-a';
      v.innerHTML = `<h2>Orders</h2>${chips([['all', 'All'], ['open', 'In progress'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']], S.ordFilter, 'ordFilter')}
      <div class="row"><input data-search="ordSearch" placeholder="Search order number or store" value="${esc(S.ordSearch)}" style="flex:1;min-width:200px"></div>
      ${list.length ? list.map(o => `<div class="item"><div class="h"><div><b>${esc(o.order_number)}</b> <span class="tag ${tone(o.status)}">${esc(o.status.replace(/_/g, ' '))}</span>${o.payment_method === 'cash' ? ' <span class="tag t-a">Cash</span>' : ''}
        <div class="m">${esc(o.store_name || 'Store')} • Buyer ${esc(o.buyer_email || '-')}${o.rider_email ? ' • Rider ' + esc(o.rider_email) : ''}<br>${when(o.created_at)}${o.cancel_reason ? '<br><span style="color:#f87171">' + esc(o.cancel_reason) + '</span>' : ''}</div></div><div style="text-align:right"><b>${money(o.total)}</b><div class="m">delivery ${money(o.delivery_fee)}</div></div></div></div>`).join('') : '<div class="empty">No orders found.</div>'}`;
    },

    async users(v) {
      const rows = await rpc('admin_list_users', { p_search: S.userSearch, p_role: S.userRole, p_limit: 150 });
      v.innerHTML = `<h2>Users</h2>${chips([['all', 'Everyone'], ['buyer', 'Buyers'], ['store', 'Stores'], ['rider', 'Riders']], S.userRole, 'userRole')}
      <div class="row"><input data-search="userSearch" placeholder="Search email, name or phone" value="${esc(S.userSearch)}" style="flex:1;min-width:200px"></div>
      ${rows.length ? rows.map(u => `<div class="item"><div class="h"><div><b style="word-break:break-all">${esc(u.email)}</b>${seal(u.is_verified)} <span class="tag t-b">${esc(u.role)}</span> ${statusTag(u.status)}
        <div class="m">${esc(u.full_name || '')} ${u.phone ? '• ' + esc(u.phone) : ''}<br>Joined ${when(u.created_at)} • last active ${ago(u.last_seen_at)} • ${num(u.orders_count)} orders</div></div></div>
        <div class="acts"><button class="btn" data-act="email" data-id="${esc(u.id)}" data-email="${esc(u.email)}">✉️ Change email</button>${['store', 'rider'].includes(u.role) ? verifyBtn(u.id, u.is_verified, u.email) : ''}${u.role === 'admin' ? '' : accountButtons(u.id, u.status, u.email)}</div></div>`).join('') : '<div class="empty">No users found.</div>'}`;
    },

    async ratings(v) {
      const sum = await rpc('admin_rating_summary');
      let rows = sum.filter(r => r.role === S.rateRole);
      rows.sort((a, b) => S.rateSort === 'low' ? Number(a.avg_stars) - Number(b.avg_stars) : Number(b.avg_stars) - Number(a.avg_stars));
      v.innerHTML = `<h2>Ratings between users</h2>${chips([['buyer', 'Buyers'], ['rider', 'Riders'], ['store', 'Stores']], S.rateRole, 'rateRole')}${chips([['low', 'Most underrated first'], ['high', 'Best rated first']], S.rateSort, 'rateSort')}
      ${rows.length ? rows.map(r => `<div class="item"><div class="h"><div><b style="word-break:break-all">${esc(r.email)}</b>${seal(r.is_verified)} ${statusTag(r.status)}<div class="m"><span class="stars">${stars(r.avg_stars)}</span> <b>${Number(r.avg_stars).toFixed(2)}</b> • ${num(r.ratings_count)} ratings • ${num(r.low_count)} low (1-2★)</div></div></div>
        <div class="acts"><button class="btn" data-act="comments" data-id="${esc(r.user_id)}" data-email="${esc(r.email)}">💬 Read comments</button>${r.role !== 'buyer' ? verifyBtn(r.user_id, r.is_verified, r.email) : ''}${accountButtons(r.user_id, r.status, r.email)}</div><div id="cm_${esc(r.user_id)}"></div></div>`).join('') : '<div class="empty">No ratings for this group yet.</div>'}`;
    },

    async feedback(v) {
      const rows = await rpc('admin_list_feedback', { p_role: S.fbRole, p_sort: S.fbSort });
      const avg = rows.length ? (rows.reduce((n, r) => n + r.rating, 0) / rows.length).toFixed(2) : '-';
      v.innerHTML = `<h2>Feedback from "Rate us"</h2>${chips([['all', 'Everyone'], ['buyer', 'Buyers'], ['rider', 'Riders'], ['store', 'Stores']], S.fbRole, 'fbRole')}${chips([['low', 'Most underrated first'], ['high', 'Best rated first']], S.fbSort, 'fbSort')}
      <div class="card"><b>${rows.length}</b> responses • average <b>${avg}</b> ${avg !== '-' ? `<span class="stars">${stars(avg)}</span>` : ''}</div>
      ${rows.length ? rows.map(f => `<div class="item"><div class="h"><div><span class="stars">${stars(f.rating)}</span> <span class="tag t-b">${esc(f.user_role || '')}</span> ${f.category ? `<span class="tag t-n">${esc(f.category)}</span>` : ''}</div><span class="m">${when(f.created_at)}</span></div>
        <div style="margin-top:6px">${f.message ? esc(f.message) : '<i style="color:var(--muted)">No message</i>'}</div><div class="m">${esc(f.email)}</div></div>`).join('') : '<div class="empty">No feedback yet.</div>'}`;
    },


    async news(v) {
      const rows = await rpc('admin_list_announcements');
      const kindTag = k => ({ info: '<span class="tag t-b">Update</span>', success: '<span class="tag t-g">Good news</span>', warning: '<span class="tag t-a">Important</span>', promo: '<span class="tag t-b" style="background:rgba(168,85,247,.15);color:#c084fc">Offer</span>' }[k] || '');
      v.innerHTML = `<h2>Announcements</h2>
      <div class="card"><h3>New announcement</h3>
        <input id="annTitle" maxlength="120" placeholder="Title, e.g. We are now live in Nkomazi!" style="width:100%;margin-bottom:8px">
        <textarea id="annBody" maxlength="1500" placeholder="Write your message. Keep it short and clear."></textarea>
        <div class="row" style="margin-top:8px">
          <select id="annKind"><option value="info">📢 Update</option><option value="success">✅ Good news</option><option value="warning">⚠️ Important</option><option value="promo">🎉 Offer</option></select>
          <select id="annAud"><option value="all">Everyone</option><option value="buyer">Buyers</option><option value="store">Stores</option><option value="rider">Riders</option></select>
          <input id="annExp" type="number" min="0" placeholder="Hide after (hours)" style="width:150px">
          <label style="display:flex;gap:6px;align-items:center;color:var(--muted);font-size:13px"><input id="annPin" type="checkbox"> Pin to top</label>
        </div>
        <div class="acts"><button class="btn g" data-act="announce">Publish announcement</button></div>
        <div class="m" style="color:var(--muted);font-size:12px;margin-top:8px">Users see it as a banner at the top of their dashboard until they tap "Got it". Leave "Hide after" empty to keep it up.</div></div>
      <h3>Published (${rows.length})</h3>
      ${rows.length ? rows.map(a => `<div class="item"><div class="h"><div><b>${esc(a.title)}</b> ${kindTag(a.kind)} <span class="tag t-n">${esc(a.audience === 'all' ? 'Everyone' : a.audience + 's')}</span>${a.pinned ? ' <span class="tag t-a">Pinned</span>' : ''} ${a.is_active ? '<span class="tag t-g">Live</span>' : '<span class="tag t-n">Hidden</span>'}
        <div class="m">${esc(a.body)}</div><div class="m">${when(a.created_at)}${a.expires_at ? ' • hides ' + when(a.expires_at) : ''} • read by ${num(a.reads)}</div></div></div>
        <div class="acts"><button class="btn" data-act="ann-toggle" data-id="${esc(a.id)}" data-on="${a.is_active ? '0' : '1'}">${a.is_active ? 'Hide' : 'Show again'}</button><button class="btn r" data-act="ann-del" data-id="${esc(a.id)}">Delete</button></div></div>`).join('') : '<div class="empty">No announcements yet.</div>'}`;
    },

    async promos(v) {
      const rows = await rpc('admin_list_promotions');
      const total = rows.reduce((n, p) => n + Number(p.amount), 0), live = rows.filter(p => p.state === 'active').length;
      const tone = s => s === 'active' ? 't-g' : s === 'queued' ? 't-b' : 't-n';
      v.innerHTML = `<h2>Store promotions</h2>
      <div class="grid"><div class="kpi"><small>Promotion revenue</small><b>${money(total)}</b><i>R1 per hour</i></div><div class="kpi"><small>Live now</small><b>${num(live)}</b><i>stores featured</i></div><div class="kpi"><small>Total bought</small><b>${num(rows.length)}</b><i>promotions</i></div></div>
      <div style="margin-top:12px">${rows.length ? rows.map(p => `<div class="item"><div class="h"><div><b>${esc(p.store_name)}</b> <span class="tag ${tone(p.state)}">${esc(p.state)}</span><div class="m">${esc(p.owner_email)} • ${num(p.hours)} hours<br>${when(p.starts_at)} to ${when(p.ends_at)}</div></div><b>${money(p.amount)}</b></div></div>`).join('') : '<div class="empty">No promotions bought yet.</div>'}</div>`;
    },

    async support(v) {
      const rows = await rpc('admin_list_tickets', { p_status: S.tkStatus });
      v.innerHTML = `<h2>Customer support</h2>${chips([['open', 'Open'], ['closed', 'Resolved'], ['all', 'All']], S.tkStatus, 'tkStatus')}
      ${rows.length ? rows.map(t => `<div class="item"><div class="h"><div><b>${esc(t.subject)}</b> <span class="tag ${t.status === 'open' ? 't-a' : 't-g'}">${t.status === 'open' ? 'Open' : 'Resolved'}</span> <span class="tag t-b">${esc(t.user_role || '')}</span>
        <div class="m">${esc(t.email)} • ${when(t.created_at)}</div></div></div><div style="margin-top:8px">${esc(t.message)}</div>
        ${t.admin_reply ? `<div class="m" style="margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(34,197,94,.1);color:#b9f3cd">Your reply: ${esc(t.admin_reply)}</div>` : ''}
        <textarea id="re_${esc(t.id)}" placeholder="Write a reply…" style="margin-top:8px"></textarea>
        <div class="acts"><button class="btn g" data-act="reply" data-id="${esc(t.id)}" data-mode="send">Reply &amp; resolve</button><button class="btn" data-act="reply" data-id="${esc(t.id)}" data-mode="keep">Reply, keep open</button>${t.status === 'open' ? `<button class="btn" data-act="reply" data-id="${esc(t.id)}" data-mode="close">Resolve without reply</button>` : ''}
        <button class="btn" data-act="email" data-id="${esc(t.user_id)}" data-email="${esc(t.email)}">✉️ Change user email</button></div></div>`).join('') : '<div class="empty">No tickets here.</div>'}`;
    },

    async settings(v) {
      const w = await rpc('admin_get_weather').catch(() => 'clear');
      const ps = await rpc('admin_push_stats').catch(() => null);
      v.innerHTML = `<h2>Settings</h2>
      <div class="card"><h3>Weather (delivery fee)</h3><div class="m" style="color:var(--muted);margin-bottom:8px">When the weather is not "clear", R1.50 is added to every delivery fee.</div>
        <div class="row"><select id="weatherSel">${['clear', 'rain', 'storm'].map(x => `<option value="${x}" ${w === x ? 'selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select><button class="btn g" data-act="weather">Save</button></div></div>
      <div class="card"><h3>Housekeeping</h3><div class="m" style="color:var(--muted);margin-bottom:8px">Cancels orders unfinished after 12 hours and switches inactive stores and riders offline. This also runs automatically.</div><button class="btn" data-act="cleanup">Run now</button></div>
      <div class="card"><h3>Push notifications</h3>${ps ? `<div class="row"><span class="tag ${ps.configured ? 't-g' : 't-a'}">${ps.configured ? 'Server connected' : 'Not set up yet'}</span><span class="tag t-n">${num(ps.devices)} phones</span><span class="tag t-n">${num(ps.stores)} stores</span><span class="tag t-n">${num(ps.riders)} riders</span><span class="tag t-n">${num(ps.buyers)} buyers</span></div><div class="m" style="color:var(--muted);font-size:12.5px">${num(ps.waiting)} waiting to send • ${num(ps.failed)} failed${ps.configured ? '' : '<br>Finish the steps in PUSH-SETUP.txt to switch alerts on for closed apps.'}</div>` : '<div class="m" style="color:var(--muted)">Run the 06 SQL file to enable push notifications.</div>'}</div>
      <div class="card"><h3>How BuyEasy earns</h3><div class="m" style="color:var(--muted);line-height:1.6">BuyEasy earns a fee <b>only when a customer pays with the wallet or a card</b>. Cash on delivery orders earn BuyEasy nothing. Store promotions (R1 per hour) are also counted.</div></div>
      <div class="card"><h3>Going live</h3><div class="m" style="color:var(--muted);line-height:1.6">To remove all test orders, run <b>99-RESET-test-orders-RUN-ONCE.sql</b> in Supabase (change NO to YES inside it). Users, stores, products and riders are kept.</div></div>
      <div class="card"><h3>Payments</h3><div class="m" style="color:var(--muted)">Yoco is not connected yet. Wallet top-ups and payouts stay switched off until it is.</div></div>`;
    }
  };

  async function showComments(userId, email) {
    const box = document.getElementById('cm_' + userId);
    const rows = (await rpc('admin_list_ratings', { p_max_stars: 5, p_limit: 300 })).filter(r => r.ratee_id === userId);
    const html = rows.length ? rows.map(r => `<div class="item" style="background:var(--card)"><span class="stars">${stars(r.stars)}</span> <span class="m">${esc(r.rater_role)} ${esc(r.rater_email)} • order ${esc(r.order_number)} • ${when(r.created_at)}</span><div style="margin-top:4px">${r.comment ? esc(r.comment) : '<i style="color:var(--muted)">No comment</i>'}</div></div>`).join('') : '<div class="m" style="margin-top:8px">No comments yet.</div>';
    if (box) box.innerHTML = html; else alert(rows.map(r => `${r.stars}★ ${r.comment || ''}`).join('\n') || 'No comments yet.');
  }

  (async function start() {
    const ok = await checkAdminSession();
    if (!ok) return;
    await go('overview');
    loadBadges();
    setInterval(loadBadges, 60000);
  })();
})();
