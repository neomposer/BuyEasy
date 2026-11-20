/* BUYEasy buyer catalogue, cart, checkout and history.
 * Load this AFTER the inline scripts in buyer-dashboard.html.
 * The cart keeps only product IDs and quantities in localStorage. Prices,
 * availability, delivery charges and wallet deductions come from Supabase.
 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  const CART_KEY = 'buyeasy_cart_v1';
  const state = { user: null, profile: null, products: [], stores: [], favourites: [], loading: false };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => 'R' + Number(value || 0).toFixed(2);
  // Remove only legacy BUYEasy saved-card entries; the old page stored full card data locally.
  try {
    for (let i=localStorage.length-1;i>=0;i--) {
      const key=localStorage.key(i)||'';
      if (key==='v2_saved_cards'||key==='bhv2_cards'||key.startsWith('v2_cards_')||key.startsWith('v2_saved_cards_')||key.startsWith('v2_buyer_cards_')||key.startsWith('bhv2_cards_')) localStorage.removeItem(key);
    }
    window._tempCard=null;
  } catch (error) { console.warn('Could not clear old BUYEasy card cache',error); }
  function msg(message) { if (typeof window.showDone === 'function') window.showDone(message); else alert(message); }
  function fail(error) { console.error('[BUYEasy buyer]', error); msg(error?.message || 'Could not connect to BUYEasy. Please try again.'); }
  function cartRead() {
    try {
      const rows = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter(x => typeof x.product_id === 'string' && Number.isInteger(x.quantity) && x.quantity > 0) : [];
    } catch { return []; }
  }
  function cartWrite(rows) { localStorage.setItem(CART_KEY, JSON.stringify(rows)); }
  async function auth() {
    if (!db) throw new Error('Supabase is not connected. Check the connection script.');
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Please sign in again to continue.');
    state.user = data.session.user;
    return state.user;
  }
  async function loadProfile() {
    const user = await auth();
    const { data, error } = await db.from('profiles').select('id,email,role,full_name,phone,delivery_address,buyer_latitude,buyer_longitude,avatar_url').eq('id', user.id).single();
    if (error) throw error;
    if (data.role !== 'buyer') {
      const switched = await db.rpc('switch_dashboard_role', { p_role: 'buyer' });
      if (switched.error) throw switched.error;
      data.role = 'buyer';
    }
    state.profile = data;
    const local = readLegacyProfile();
    const name = $('b_name'), phone = $('b_phone'), addr = $('b_addr'), lat = $('b_lat'), lng = $('b_lng');
    if (name) name.value = data.full_name || local.name || '';
    if (phone) phone.value = data.phone || local.phone || '';
    if (addr) addr.value = data.delivery_address || local.addr || local.address || '';
    if (lat) lat.value = data.buyer_latitude ?? local.lat ?? '';
    if (lng) lng.value = data.buyer_longitude ?? local.lng ?? '';
    if (data.full_name && $('buyerName')) $('buyerName').textContent = data.full_name;
    if (data.buyer_latitude != null && data.buyer_longitude != null && typeof buyerLatLng !== 'undefined') buyerLatLng = [data.buyer_latitude, data.buyer_longitude]; if (window.applyBuyerRange) window.applyBuyerRange();
    const { data: store, error: storeError } = await db.from('stores').select('id,is_approved').eq('owner_id', user.id).maybeSingle();
    if (storeError) throw storeError;
    const { data: riderApps, error: riderError } = await db.from('rider_applications').select('id').eq('user_id', user.id).eq('status', 'approved').limit(1);
    if (riderError) throw riderError;
    const switches = $('dashboardSwitches');
    if (switches) {
      switches.innerHTML = '';
      if (store?.is_approved) switches.insertAdjacentHTML('beforeend', '<button onclick="switchToStoreDashboard()" style="border:1px solid var(--border);background:var(--card3);color:var(--text);border-radius:9px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer">🏪 Store</button>');
      if ((riderApps || []).length) switches.insertAdjacentHTML('beforeend', '<button onclick="switchToRiderDashboard()" style="border:1px solid var(--border);background:var(--card3);color:var(--text);border-radius:9px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer">🏍️ Rider</button>');
    }
    return data;
  }
  window.switchToStoreDashboard = () => window.switchDashboardRole('store', 'store-dashboard.html');
  window.switchToRiderDashboard = () => window.switchDashboardRole('rider', 'rider-dashboard.html');
  function readLegacyProfile() {
    const em = state.user?.email || localStorage.getItem('bhv2_email') || '';
    for (const key of ['v2_buyer_' + em, 'v2_buyer_profile_' + em, 'v2_profile_' + em]) {
      try { const value = JSON.parse(localStorage.getItem(key) || '{}'); if (value && Object.keys(value).length) return value; } catch { /* ignore corrupt old cache */ }
    }
    return {};
  }
  const MAX_KM = 15;   // stores further than this from the buyer are hidden
  const inRange = p => { const ll = (typeof buyerLatLng !== 'undefined') ? buyerLatLng : null; if (!ll || p.storeLat == null || p.storeLng == null) return false; return window.haversine(ll[0], ll[1], Number(p.storeLat), Number(p.storeLng)) <= MAX_KM; };
  window.applyBuyerRange = () => { if (!state.all) return; state.products = state.all.filter(inRange); if (typeof globalProducts !== 'undefined') globalProducts = state.products.slice(); ['renderShop', 'renderFavs', 'renderPopularProducts'].forEach(n => { if (typeof window[n] === 'function') window[n](); }); };
  async function loadCatalogue() {
    await auth();
    const { data, error } = await db.from('buyer_catalogue').select('product_id,store_id,store_name,store_phone,store_address,store_latitude,store_longitude,is_online,name,price,quantity,image_url,media,description,created_at').order('created_at', { ascending: false }).limit(400);
    if (error) throw error;
    state.all = (data || []).map(row => ({
      id: row.product_id, productId: row.product_id, storeId: row.store_id,
      storeEmail: row.store_id, storeName: row.store_name || 'Store', storePhone: row.store_phone || '',
      storeAddr: row.store_address || '', storeLat: row.store_latitude, storeLng: row.store_longitude,
      online: !!row.is_online, name: row.name, price: Number(row.price), qty: Number(row.quantity),
      img: row.image_url || '', media: Array.isArray(row.media) ? row.media : [], description: row.description || ''
    }));
    state.products = state.all.filter(inRange);
    refreshTrust();
    await loadFavourites();
    if (typeof globalProducts !== 'undefined') globalProducts = state.products.slice();
    if (typeof window.renderShop === 'function') window.renderShop();
    if (typeof window.renderFavs === 'function') window.renderFavs();
    return state.products;
  }

  /* ---------- verified badges, rider availability and sponsored stores ---------- */
  state.riders = {}; state.promos = [];
  async function refreshTrust() {
    try {
      const ids = [...new Set((state.all || []).map(p => p.storeId).filter(Boolean))];
      if (!ids.length) return;
      if (window.BuyEasyBadge) await BuyEasyBadge.loadStores(ids);
      const av = await db.rpc('store_rider_availability', { p_store_ids: ids });
      if (!av.error) { state.riders = {}; (av.data || []).forEach(r => { state.riders[r.store_id] = Number(r.online_riders); }); }
      const pr = await db.rpc('public_active_promotions');
      if (!pr.error) state.promos = pr.data || [];
      drawShop(); renderFeatured(); renderCart();
    } catch (e) { console.warn('Trust refresh', e.message || e); }
  }
  BuyEasyPoll.every(refreshTrust, { fast: 60000, slow: 120000, relaxed: 120000 });
  window.refreshTrust = refreshTrust;

  function renderFeatured() {
    let box = $('featuredBox');
    if (!box) { const anchor = $('nearestStores'); if (!anchor || !anchor.parentNode) return; box = document.createElement('div'); box.id = 'featuredBox'; anchor.parentNode.insertBefore(box, anchor.previousElementSibling || anchor); }
    const byStore = new Map(); (state.products || []).forEach(p => { if (!byStore.has(p.storeId)) byStore.set(p.storeId, []); byStore.get(p.storeId).push(p); });
    const cards = (state.promos || []).filter(pr => byStore.has(pr.store_id)).map(pr => {
      const prods = byStore.get(pr.store_id); const first = prods[0];
      const feat = (pr.product_ids || []).map(id => prods.find(p => p.id === id)).filter(Boolean); const show = (feat.length ? feat : prods).slice(0, 3);
      return { pr, first, show, online: prods.some(p => p.online) };
    }).filter(c => c.online);
    if (!cards.length) { box.innerHTML = ''; return; }
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin:14px 2px 8px"><b style="font-size:15px">⭐ Featured stores</b><span class="be-sponsored">Sponsored</span></div>
      <div class="be-feature">${cards.slice(0, 8).map(c => { const p = c.first, tag = c.pr.tagline;
        const dist = (typeof buyerLatLng !== 'undefined' && buyerLatLng && p.storeLat != null) ? window.haversine(...buyerLatLng, p.storeLat, p.storeLng) : null;
        return `<div class="be-fcard" onclick="viewStore('${esc(p.storeId)}')"><div class="be-fhead"><span class="be-logo">${esc((p.storeName || 'S').trim().charAt(0).toUpperCase())}</span>
          <div style="min-width:0"><b style="font-size:15px">${esc(p.storeName)}${window.BuyEasyBadge ? BuyEasyBadge.storeBadge(p.storeId, 15) : ''}</b>
          <div style="font-size:12px;color:var(--muted)">${window.BuyEasyBadge ? BuyEasyBadge.stars(BuyEasyBadge.store(p.storeId)) : ''}${dist !== null ? ` • ${dist.toFixed(1)} km` : ''}</div></div></div>
          ${tag ? `<div style="font-size:13px">${esc(tag)}</div>` : ''}
          <div class="be-fthumbs">${c.show.map(x => `<span style="background-image:url('${esc(x.img || '')}')"></span>`).join('')}</div></div>`; }).join('')}</div>`;
  }
  window.renderFeatured = renderFeatured;

  function cartProducts() {
    return cartRead().map(item => {
      const p = state.products.find(x => x.id === item.product_id);
      return p ? { ...p, qty: item.quantity, cartId: item.product_id } : null;
    }).filter(Boolean);
  }
  function drawShop() {
    const list = $('shopList');
    if (!list) return;
    const search = ($('shopSearch')?.value || '').trim().toLowerCase();
    const all = state.products.slice();
    let rows = all.filter(p => (`${p.name} ${p.storeName} ${p.description}`).toLowerCase().includes(search));
    if (typeof buyerLatLng !== 'undefined' && buyerLatLng) {
      rows.forEach(p => { p.dist = p.storeLat != null && p.storeLng != null ? window.haversine(...buyerLatLng, p.storeLat, p.storeLng) : 9999; });
      rows.sort((a,b) => a.dist-b.dist || Number(b.online)-Number(a.online));
    } else rows.sort((a,b) => Number(b.online)-Number(a.online));
    if (typeof selectedStore !== 'undefined' && selectedStore !== 'all' && selectedStore !== 'fav') rows = rows.filter(p => p.storeId === selectedStore);
    if (typeof selectedStore !== 'undefined' && selectedStore === 'fav') rows = rows.filter(p => isFavProduct(p.id) || isFavStoreId(p.storeId));
    if (typeof globalProducts !== 'undefined') globalProducts = rows;
    if ($('allProductsTitle')) $('allProductsTitle').textContent = `🛒 Products • ${rows.length}`;
    if ($('shopSub')) $('shopSub').textContent = `${rows.length} results${buyerLatLng ? ' • Stores near you first' : ' • Save GPS to see nearest'}`;
    if (!rows.length) { list.innerHTML = (typeof buyerLatLng!=='undefined'&&buyerLatLng) ? beEmpty('🏪','No stores near you yet','No products within 15 km of you right now. New stores are joining, check back soon.') : beEmpty('📍','Turn on your location','We find stores within 15 km of you automatically. Please allow location for BuyEasy.','Allow location',"BuyerLocation.refresh(15000,true)"); return; }
    list.innerHTML = rows.map((p, index) => {
      const media = p.media.length ? p.media : (p.img ? [{type:'image',src:p.img}] : []);
      const first = media[0]?.src || p.img;
      return `<div class="prod-card ${p.online ? '' : 'offline'}">${p.online ? '' : '<div class="offline-overlay"><span class="offline-text">OFFLINE</span></div>'}
        <button class="fav-btn ${isFavProduct(p.id)?'active':''}" onclick="event.stopPropagation();toggleFavProd('${esc(p.id)}','${esc(p.storeId)}')">${isFavProduct(p.id)?'❤️':'🤍'}</button>
        <div style="position:relative;width:100%;height:130px;overflow:hidden;border-radius:12px;background:#222;cursor:pointer" onclick="openGallery('${esc(p.id)}')">${first?`<img loading="lazy" decoding="async" src="${esc(first)}" style="width:100%;height:100%;object-fit:cover">`:'<div style="display:grid;place-items:center;height:100%">🛒</div>'}</div>
        <div class="prod-info"><div class="prod-name" onclick="openGallery('${esc(p.id)}')">${esc(p.name)}</div>
        <div class="prod-meta"><span class="dot ${p.online?'online':'offline'}"></span><span onclick="viewStore('${esc(p.storeId)}')">${esc(p.storeName)}</span>${window.BuyEasyBadge ? BuyEasyBadge.storeBadge(p.storeId, 14) : ''}${state.riders && state.riders[p.storeId] === 0 ? ' <span class="be-pickup">🚶 Pickup only</span>' : ''}${p.dist<9999?` • ${p.dist.toFixed(1)} km`:''}</div>
        <div class="prod-price">${money(p.price)}</div><div class="store-actions"><button onclick="addToCartByIndex(${index})" ${p.online?'':'disabled'} class="add-btn" style="flex:1">${p.online?'Add':'Off'}</button><button onclick="viewStore('${esc(p.storeId)}')" class="icon-btn">🏪</button><button onclick="openStoreLocation('${esc(p.storeId)}')" class="icon-btn">📍</button><button onclick="openGallery('${esc(p.id)}')" class="icon-btn">👁️</button></div></div></div>`;
    }).join('');
    if (typeof window.renderNearestStores === 'function') window.renderNearestStores();
    if (typeof window.renderChips === 'function') window.renderChips(all);
    if (typeof window.renderPopular === 'function') window.renderPopular();
  }
  async function loadFavourites() {
    if(!state.user) return;
    const {data,error}=await db.from('buyer_favourites').select('id,store_id,product_id').eq('buyer_id',state.user.id);
    if(error) throw error;
    state.favourites=data||[];
  }
  function isFavProduct(id) { return state.favourites.some(x => x.product_id===id); }
  function isFavStoreId(id) { return state.favourites.some(x => x.store_id===id && !x.product_id); }
  function addProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p || !p.online) return msg('This product is currently unavailable.');
    const rows = cartRead(); const item = rows.find(x => x.product_id === id);
    if (item) item.quantity = Math.min(50, item.quantity + 1); else rows.push({product_id:id,quantity:1});
    cartWrite(rows); renderCart(); updateStats(); msg('Added to cart.');
  }
  function renderCart() {
    const el = $('cartList'); if (!el) return;
    const rows = cartProducts();
    const totalQty=cartRead().reduce((n,p)=>n+p.quantity,0);
    if($('cartBadge')) $('cartBadge').textContent=String(totalQty);
    if($('cartTopCount2')) $('cartTopCount2').textContent=totalQty?`(${totalQty})`:'';
    if($('cartCountTop')) $('cartCountTop').textContent=`${totalQty} items in cart`;
    if (!rows.length) { el.innerHTML=beEmpty('🧺','Your cart is empty','Add something from a nearby store.','Browse stores',"openTab('shop',document.getElementById('bnav-shop'))"); if($('cartTotal')) $('cartTotal').textContent='R0.00'; updateDeliveryPreview(); return; }
    const groups = new Map(); rows.forEach(p => { if(!groups.has(p.storeId)) groups.set(p.storeId,[]); groups.get(p.storeId).push(p); });
    const sum = rows.reduce((n,p)=>n+p.price*p.qty,0);
    el.innerHTML = [...groups.entries()].map(([storeId,items]) => `<div class="cart-group"><b>${esc(items[0].storeName)}</b>${items.map(p=>`<div class="cart-row"><span>${esc(p.name)} • ${money(p.price)}</span><span><button class="qty-btn" onclick="changeQty('${p.id}',-1)">−</button> ${p.qty} <button class="qty-btn" onclick="changeQty('${p.id}',1)">+</button></span></div>`).join('')}</div>`).join('');
    if ($('cartTotal')) $('cartTotal').textContent=money(sum);
    if ($('cartCount')) $('cartCount').textContent=String(rows.reduce((n,p)=>n+p.qty,0));
    updateDeliveryPreview();
    cartRiderNotice();
  }
  function cartRiderNotice() {
    const el = $('cartList'); if (!el) return;
    el.querySelectorAll('.rider-notice').forEach(n => n.remove());
    const none = [...new Set(cartProducts().filter(p => state.riders && state.riders[p.storeId] === 0).map(p => p.storeName))];
    if (!none.length) return;
    el.insertAdjacentHTML('beforeend', `<div class="rider-notice"><b>🚶 No riders online for ${none.map(esc).join(', ')}</b><p>You will need to <b>collect these items yourself</b> from the store. No delivery fee is charged. We will ask you to confirm before you order.</p></div>`);
  }
  function changeQuantity(id, delta) {
    const rows=cartRead(); const item=rows.find(x=>x.product_id===id); if(!item) return;
    item.quantity += delta; cartWrite(rows.filter(x=>x.quantity>0)); renderCart(); updateStats();
  }
  /* ---------- checkout: one tap = one order ---------- */
  let checkingOut = false;
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  // The same cart keeps the same request key until the order succeeds, so a double tap, a slow
  // connection or an automatic retry can never create a second order.
  function requestKeys(rows, method) {
    const sig = JSON.stringify([rows.map(r => [r.product_id, r.quantity]).sort(), method]);
    let k = {}; try { k = JSON.parse(sessionStorage.getItem('be_co') || '{}'); } catch (e) {}
    if (k.sig !== sig) k = { sig, d: uuid(), p: uuid() };
    try { sessionStorage.setItem('be_co', JSON.stringify(k)); } catch (e) {}
    return k;
  }
  function checkoutBusy(on) {
    document.querySelectorAll('[onclick*="checkout"]').forEach(btn => {
      if (on) { btn.dataset.label = btn.textContent; btn.textContent = 'Placing your order…'; btn.disabled = true; btn.style.opacity = '.7'; }
      else { btn.disabled = false; btn.style.opacity = ''; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
    });
  }
  async function checkout() {
    if (checkingOut) return;                       // second tap while the first is still running: ignore
    checkingOut = true; checkoutBusy(true);
    let wait = (window.BuyEasyUI && BuyEasyUI.progress) ? BuyEasyUI.progress('Placing your order…') : null;
    try {
      const user = await auth();
      const profile = state.profile || await loadProfile();
      const rows = cartRead(); if (!rows.length) throw new Error('Your cart is empty.');
      const storeOf = r => state.products.find(p => p.id === r.product_id)?.storeId;
      if (window.BuyerLocation && !BuyerLocation.get()) { try { await BuyerLocation.refresh(3000, false); } catch (e) {} }   // only waits if we have no fix at all
      const name = $('b_name')?.value.trim() || profile.full_name;
      const phone = $('b_phone')?.value.trim() || profile.phone;
      const address = $('b_addr')?.value.trim() || profile.delivery_address;
      const lat = Number($('b_lat')?.value || profile.buyer_latitude);
      const lng = Number($('b_lng')?.value || profile.buyer_longitude);
      const goSettings = text => { if (typeof window.openTab === 'function') window.openTab('settings', document.getElementById('bnav-settings')); throw new Error(text); };
      if (!name || !phone) goSettings('Add your name and phone number in Settings before ordering.');

      // stores with NO online rider can only be collected by the buyer
      const ids = [...new Set(rows.map(storeOf).filter(Boolean))];
      const av = await db.rpc('store_rider_availability', { p_store_ids: ids }); if (av.error) throw av.error;
      const none = new Set((av.data || []).filter(x => Number(x.online_riders) === 0).map(x => x.store_id));
      const pickRows = rows.filter(r => none.has(storeOf(r))), delRows = rows.filter(r => !none.has(storeOf(r)));
      if (delRows.length && (!address || !Number.isFinite(lat) || !Number.isFinite(lng))) goSettings('Add your delivery address and map pin in Settings before ordering.');
      if (pickRows.length) {
        const names = [...new Set(pickRows.map(r => state.products.find(p => p.id === r.product_id)?.storeName))].join(', ');
        if (wait) { wait.done(); wait = null; }          // close the spinner before asking
        const ok = await BuyEasyUI.confirm(`No riders are online for ${names}. You will need to collect ${pickRows.length > 1 ? 'these items' : 'this order'} yourself from the store. No delivery fee is charged.`, { title: 'Collect it yourself?', okLabel: 'Yes, I will collect', icon: '🚶' });
        if (!ok) return;
        wait = BuyEasyUI.progress('Placing your order…');
      }
      const rawPay = (typeof selectedPay !== 'undefined' ? selectedPay : 'wallet');
      const method = (rawPay === 'cod' || rawPay === 'cash_on_delivery') ? 'cash' : rawPay;   // Cash on Delivery is stored as 'cod' by the button
      if (method === 'card') throw new Error('Card payments are not connected yet. Choose Wallet or Cash.');

      // save the details in the background (not needed to place the order)
      if (address && Number.isFinite(lat) && Number.isFinite(lng)) {
        const same = name === profile.full_name && phone === profile.phone && address === profile.delivery_address && Math.abs((profile.buyer_latitude ?? 0) - lat) < 0.0005 && Math.abs((profile.buyer_longitude ?? 0) - lng) < 0.0005;
        if (!same) { db.from('profiles').update({ full_name: name, phone, delivery_address: address, buyer_latitude: lat, buyer_longitude: lng }).eq('id', user.id).then(r => { if (!r.error) Object.assign(profile, { full_name: name, phone, delivery_address: address, buyer_latitude: lat, buyer_longitude: lng }); }, () => {}); }
      }

      const keys = requestKeys(rows, method);
      const call = (items, fulfil, key) => db.rpc('buyer_checkout', { p_items: items, p_customer_name: name, p_customer_phone: phone, p_delivery_address: address || '', p_buyer_latitude: Number.isFinite(lat) ? lat : null, p_buyer_longitude: Number.isFinite(lng) ? lng : null, p_payment_method: method, p_fulfillment: fulfil, p_request_id: key });
      if (delRows.length) { const r = await call(delRows, 'delivery', keys.d); if (r.error) throw r.error; cartWrite(pickRows); }
      if (pickRows.length) { const r = await call(pickRows, 'pickup', keys.p); if (r.error) throw r.error; cartWrite([]); }
      try { sessionStorage.removeItem('be_co'); } catch (e) {}
      renderCart(); Promise.all([renderOrders(), updateStats()]).catch(() => {});
      msg(pickRows.length && !delRows.length
        ? 'Order placed. The store will prepare it. Collect it from the store when it is ready. No delivery fee.'
        : method === 'wallet'
          ? 'Order placed. The delivery fee shown at checkout is locked and will never increase. If a lower-cost Rider accepts, we automatically return the difference to your Wallet.'
          : 'Order placed. The delivery fee shown at checkout is the most you will pay and will never increase. If a lower-cost Rider accepts, your cash total is reduced.');
      if (typeof window.openTab === 'function') window.openTab('orders', document.querySelectorAll('.bnav-tab')[2]);
    } catch (error) { fail(error); }
    finally { checkingOut = false; checkoutBusy(false); try { wait && wait.done && wait.done(); } catch (e) {} }
  }
  async function renderOrders() {
    const el=$('ordersList'); if(!el) return;
    try {
      const user=await auth();
      const {data,error}=await db.from('orders').select('id,order_number,status,payment_method,payment_status,customer_name,product_total,delivery_fee,total,delivery_breakdown,created_at,store_id,order_items(product_name,quantity,unit_price,subtotal),stores(store_name)')
        .eq('buyer_id',user.id).order('created_at',{ascending:false});
      if(error) throw error;
      const q=($('orderSearch')?.value||'').trim().toLowerCase();
      const historyStatus=new Set(['delivered','cancelled','rejected']);
      const filtered=(data||[]).filter(o=> (typeof curTab==='undefined' || (curTab==='history'?historyStatus.has(o.status):!historyStatus.has(o.status))) && `${o.order_number} ${o.status} ${(o.order_items||[]).map(i=>i.product_name).join(' ')}`.toLowerCase().includes(q));
      el.innerHTML=filtered.length?filtered.map(o=>{const step=({pending:1,accepted:2,preparing:2,ready:3,assigned:3,picked_up:4,delivered:5})[o.status]||1; const capped=o.delivery_breakdown?.capped_to_keep_affordable; const pendingMode=o.status==='pending'; return `<div class="oc${beCard.cls(o.id)}" data-oc="${esc(o.id)}" style="padding:12px;background:var(--card3);border-radius:14px;margin-top:10px;border:1px solid var(--border2);color:var(--text)"><div class="oc-head" data-oc-toggle style="display:flex;justify-content:space-between;gap:8px"><b>${esc(o.stores?.store_name||'Order')} • ${esc(o.order_number)}</b><span class="pill">${esc(o.status.replaceAll('_',' '))}</span></div><div class="oc-sum" data-oc-toggle><span>${new Date(o.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'})} • ${(o.order_items||[]).reduce((n,i)=>n+Number(i.quantity||1),0)} item(s) • <b>${money(o.total)}</b></span><span class="oc-chev">▾</span></div><div style="display:flex;gap:4px;margin:10px 0 0">${[1,2,3,4,5].map(i=>`<div style="height:6px;flex:1;border-radius:8px;background:${step>=i?'#22c55e':'#333'}"></div>`).join('')}</div><div class="oc-body" style="margin-top:8px"><div style="font-size:11px;color:var(--muted2);margin-top:5px">${new Date(o.created_at).toLocaleString()} • ${(o.order_items||[]).map(i=>`${esc(i.product_name)} × ${i.quantity}`).join(', ')}</div><div style="margin:10px 0">Products ${money(o.product_total)} + delivery ${money(o.delivery_fee)} = <b>${money(o.total)}</b></div>${capped?'<div style="font-size:11px;color:#22c55e;font-weight:800">Delivery capped to keep it affordable.</div>':''}${pendingMode?'<div style="font-size:10px;color:var(--muted);margin-top:5px">This is the most you will pay. The delivery fee cannot increase. If a lower-cost Rider accepts, Wallet money is returned or your cash total is reduced.</div>':''}<small>Payment: ${esc(o.payment_method==='cash'?'Cash on delivery':'Wallet')} • ${esc(o.payment_status)}</small>${step<5?`<button onclick="BuyerTracking && BuyerTracking.openMap('${o.id}')" class="btn-white" style="width:100%;margin-top:8px">🗺️ Track Rider Live</button>`:'<div style="color:#22c55e;margin-top:8px">✓ Completed — in History</div>'}</div></div>`;
}).join(''):beEmpty('📦','No orders here yet','When you place an order you can follow it here.');
    } catch(error) { fail(error); }
  }
  async function updateStats() {
    try {
      const user=await auth();
      const [{data:wallet,error:wError},{data:orders,error:oError}]=await Promise.all([
        db.from('wallets').select('balance,currency').eq('user_id',user.id).maybeSingle(),
        db.from('orders').select('total,created_at').eq('buyer_id',user.id)
      ]);
      if(wError) throw wError; if(oError) throw oError;
      const balance=Number(wallet?.balance||0);
      for(const id of ['wallet','balanceTop','walletPayInfo']) if($(id)) $(id).textContent=id==='walletPayInfo'?`${money(balance)} available`:money(balance);
      const today=(orders||[]).filter(x=>new Date(x.created_at).toDateString()===new Date().toDateString()).reduce((s,x)=>s+Number(x.total||0),0);
      if($('spentToday')) $('spentToday').textContent=money(today);
    } catch(error) { console.warn('Buyer balance refresh failed',error); }
  }
  async function renderWalletHistory() {
    try {
      const user=await auth();
      const {data,error}=await db.from('transactions').select('id,type,amount,description,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
      if(error) throw error;
      const el=$('earnHist'); if(!el)return;
      el.innerHTML=(data||[]).length?data.map(t=>`<div class="hist-item"><div><b>${esc(t.description||t.type)}</b><div style="font-size:10px;color:var(--muted2)">${new Date(t.created_at).toLocaleString()}</div></div><b style="color:${Number(t.amount)>=0?'#22c55e':'#ef4444'}">${Number(t.amount)>=0?'+':''}${money(t.amount)}</b></div>`).join(''):'<p style="font-size:11px;color:var(--muted)">No wallet transactions yet.</p>';
    } catch(error) { console.warn('Wallet history could not be loaded',error); }
  }
  function renderPopularProducts() {
    const el=$('popularList'); if(!el)return;
    const popular=state.products.filter(p=>p.online).map(p=>({...p,dist:(typeof buyerLatLng!=='undefined'&&buyerLatLng&&p.storeLat!=null&&p.storeLng!=null)?window.haversine(...buyerLatLng,p.storeLat,p.storeLng):9999}));
    if(typeof buyerLatLng!=='undefined'&&buyerLatLng) popular.sort((a,b)=>a.dist-b.dist);
    const shown=popular.slice(0,6);
    if($('popularSub')) $('popularSub').textContent=buyerLatLng?`Closest popular products • ${shown.length}`:`Popular products • ${shown.length}`;
    el.innerHTML=shown.length?shown.map(p=>`<div class="prod-card" style="position:relative"><div class="fav-btn ${isFavProduct(p.id)?'active':''}" onclick="toggleFavProd('${p.id}','${p.storeId}')">${isFavProduct(p.id)?'❤️':'🤍'}</div><img loading="lazy" decoding="async" src="${esc(p.img)}" style="width:100%;height:110px;object-fit:cover" onclick="openGallery('${p.id}')"><div class="prod-info"><div class="prod-name">🔥 ${esc(p.name)}</div><div class="prod-meta">${esc(p.storeName)} • ${money(p.price)}</div>${p.dist<9999?`<div class="prod-meta">${p.dist.toFixed(1)} km away</div>`:''}<button onclick="addToCartByProductId('${p.id}')" class="add-btn">Add</button></div></div>`).join(''):'<p style="color:var(--muted);font-size:10px">No popular products yet</p>';
  }
  function viewStore(storeId) {
    const products=state.products.filter(p=>p.storeId===storeId), store=products[0]; if(!store)return;
    currentStoreModal={email:storeId,profile:{storeName:store.storeName,storeAddress:store.storeAddr},phone:store.storePhone,lat:store.storeLat,lng:store.storeLng};
    if($('storeModalName')) $('storeModalName').textContent=store.storeName;
    if($('storeModalInfo')) $('storeModalInfo').textContent=`${store.storeAddr||'No address'} • ${store.online?'Online':'Offline'}`;
    if($('storeModalProds')) $('storeModalProds').innerHTML=products.map(p=>`<div class="prod-card"><img loading="lazy" decoding="async" src="${esc(p.img)}"><div class="prod-info"><div class="prod-name">${esc(p.name)}</div><div class="prod-price">${money(p.price)}</div><button onclick="addToCartFromModal('${p.id}','${p.storeId}')" class="add-btn" ${p.online?'':'disabled'}>${p.online?'Add':'Offline'}</button></div></div>`).join('')||'<p>No products.</p>';
    if($('storeModal')) $('storeModal').classList.add('open');
    if(typeof window.updateFavBtn==='function') window.updateFavBtn();
  }
  async function saveBuyer() {
    try {
      const user=await auth();
      const values={full_name:$('b_name')?.value.trim()||'',phone:$('b_phone')?.value.trim()||'',delivery_address:$('b_addr')?.value.trim()||'',buyer_latitude:$('b_lat')?.value?Number($('b_lat').value):null,buyer_longitude:$('b_lng')?.value?Number($('b_lng').value):null};
      if(!values.full_name||!values.phone||!values.delivery_address||values.buyer_latitude===null||values.buyer_longitude===null) throw new Error('Please enter your name, phone, address and delivery pin.');
      const {error}=await db.from('profiles').update(values).eq('id',user.id); if(error) throw error;
      state.profile={...state.profile,...values}; if(typeof buyerLatLng!=='undefined') buyerLatLng=[values.buyer_latitude,values.buyer_longitude]; if(window.applyBuyerRange) window.applyBuyerRange();
      if($('buyerName')) $('buyerName').textContent=values.full_name; msg('Delivery details saved.');
    } catch(error) { fail(error); }
  }
  async function toggleFavourite(productId, storeId) {
    try {
      const user=await auth(); const {data,error}=await db.from('buyer_favourites').select('id').eq('buyer_id',user.id).eq('product_id',productId).maybeSingle();
      if(error) throw error;
      if(data) { const result=await db.from('buyer_favourites').delete().eq('id',data.id); if(result.error) throw result.error; }
      else { const result=await db.from('buyer_favourites').insert({buyer_id:user.id,product_id:productId,store_id:storeId}); if(result.error) throw result.error; }
      msg(data?'Removed from favourites.':'Added to favourites.'); await loadCatalogue();
    } catch(error) { fail(error); }
  }
  async function toggleStoreFavourite(storeId) {
    try {
      const user=await auth(); const {data,error}=await db.from('buyer_favourites').select('id').eq('buyer_id',user.id).eq('store_id',storeId).is('product_id',null).maybeSingle();
      if(error) throw error;
      const result=data ? await db.from('buyer_favourites').delete().eq('id',data.id) : await db.from('buyer_favourites').insert({buyer_id:user.id,store_id:storeId});
      if(result.error) throw result.error;
      await loadCatalogue(); if(typeof window.renderFavs==='function') window.renderFavs();
      msg(data?'Store removed from favourites.':'Store added to favourites.');
    } catch(error) { fail(error); }
  }
  function renderFavourites() {
    const storesEl=$('favStoresList'), productsEl=$('favProdsList');
    const storeFavs=state.favourites.filter(x=>x.store_id&&!x.product_id);
    const productFavs=state.favourites.filter(x=>x.product_id);
    if(storesEl) storesEl.innerHTML=storeFavs.length?storeFavs.map(f=>{const p=state.products.find(x=>x.storeId===f.store_id); const name=p?.storeName||'Favourite store'; return `<div class="fav-store-row"><div class="fav-store-left"><div class="fav-store-icon">${esc(name[0]||'S')}</div><div><div class="fav-store-name">${esc(name)}</div></div></div><div class="fav-store-actions"><button class="pill" onclick="setStore('${f.store_id}')">View</button><button class="pill" onclick="toggleFavStore('${f.store_id}')">✕</button></div></div>`;}).join(''):'<p style="color:var(--muted);font-size:11px">No favourite stores yet.</p>';
    if(productsEl) productsEl.innerHTML=productFavs.length?productFavs.map(f=>{const p=state.products.find(x=>x.id===f.product_id); if(!p)return ''; return `<div class="fav-prod-card"><div class="fav-remove" onclick="toggleFavProd('${p.id}','${p.storeId}')">✕</div><img loading="lazy" decoding="async" src="${esc(p.img)}"><div class="fav-prod-info"><div class="fav-prod-name">${esc(p.name)}</div><div class="fav-prod-meta">${esc(p.storeName)}</div><div class="fav-prod-price">${money(p.price)}</div><div class="fav-prod-actions"><button onclick="addToCartByIndexFav('${p.id}','${p.storeId}')" class="add-btn">Add</button></div></div></div>`;}).join(''):'<p style="color:var(--muted);font-size:11px">No favourite products yet.</p>';
  }
  function unavailablePayment() { msg('Card storage and wallet top-ups are disabled until a real payment provider is connected. No card details are saved.'); return false; }

  // Replace the browser-storage implementations after the legacy page scripts load.
  window.BuyerSupabase = { state, loadCatalogue, loadProfile, checkout, renderOrders, updateStats, cartRead, cartWrite };
  window.getAllProducts = () => state.products.slice();
  window.isStoreOnline = id => !!state.products.find(p=>p.storeId===id)?.online;
  window.getCart = cartRead;
  window.renderShop = drawShop;
  window.renderCart = renderCart;
  window.addToCartByIndex = index => { const p=(typeof globalProducts!=='undefined'?globalProducts:state.products)[index]; if(p) addProduct(p.id); };
  window.addToCartByIndexPopular = index => { const p=state.products[index]; if(p) addProduct(p.id); };
  window.addToCartByProductId = id => addProduct(id);
  window.addToCartByIndexFav = (id,storeId) => addProduct(id);
  window.addToCartFromModal = id => addProduct(id);
  window.changeQty = changeQuantity;
  window.checkout = checkout;
  window.renderOrders = renderOrders;
  window.updateStats = updateStats;
  window.saveBuyer = saveBuyer;
  window.toggleFavProd = toggleFavourite;
  window.toggleFavStore = toggleStoreFavourite;
  window.isFavStore = isFavStoreId;
  window.isFavProd = isFavProduct;
  window.getFavStores = () => state.favourites.filter(x=>x.store_id&&!x.product_id).map(x=>x.store_id);
  window.getFavProds = () => state.favourites.filter(x=>x.product_id).map(x=>({id:x.product_id,storeEmail:x.store_id}));
  window.renderFavs = renderFavourites;
  window.viewStore = viewStore;
  window.openStoreLocation = storeId => { const p=state.products.find(x=>x.storeId===storeId); if(!p?.storeLat||!p?.storeLng)return msg('This store has not added a map location yet.'); currentStoreModal={email:storeId,profile:{storeName:p.storeName},lat:p.storeLat,lng:p.storeLng}; if(typeof window.openStoreMapFromModal==='function')window.openStoreMapFromModal(); };
  window.renderPopular = renderPopularProducts;
  window.renderHistory = renderWalletHistory;
  window.getCards = () => [];
  window.getBuyerCards = () => [];
  window.saveCardFromModal = unavailablePayment;
  window.payWithEnteredCard = unavailablePayment;
  window.openAddCard = unavailablePayment;
  window.renderSavedCards = function(){
    const info=$('cardPayInfo'), list=$('savedCardsList');
    if(info)info.textContent='Card payments not connected yet';
    if(list)list.innerHTML='<p style="color:var(--muted);font-size:12px">Card payments are not connected yet. No card details are stored here.</p>';
  };
  window.updateAddMoneyButton = function(){
    document.querySelectorAll('button').forEach(button=>{
      if((button.textContent||'').toLowerCase().includes('add money')){
        button.textContent='Top-ups unavailable';button.disabled=true;button.title='A secure payment provider is not connected yet.';
      }
    });
  };
  window.topUp = window.addMoney = unavailablePayment;
  window.setPay = function(method) {
    if(method==='card') { unavailablePayment(); method='wallet'; }
    if(typeof selectedPay!=='undefined') selectedPay=method;
    document.querySelectorAll('.pay-opt').forEach(el=>el.classList.remove('active'));
    const node=$('pay'+method.charAt(0).toUpperCase()+method.slice(1)); if(node) node.classList.add('active');
    updateStats();
  };
  let feePreviewToken=0;
  window.updateDeliveryPreview = async () => {
    const el=$('deliveryFeePreview'); if(!el) return;
    const token=++feePreviewToken,rows=cartProducts();
    if(!rows.length) { el.innerHTML=''; return; }
    const products=rows.reduce((sum,p)=>sum+Number(p.price||0)*Number(p.qty||1),0),groups=new Map();
    rows.forEach(p=>{if(!groups.has(p.storeId))groups.set(p.storeId,{store:p,subtotal:0});groups.get(p.storeId).subtotal+=p.price*p.qty;});
    const buyerLat=Number($('b_lat')?.value||state.profile?.buyer_latitude),buyerLng=Number($('b_lng')?.value||state.profile?.buyer_longitude);
      el.innerHTML='<div>Calculating your checkout delivery fee…</div>';
    try{
      const quotes=await Promise.all([...groups.values()].map(async group=>{
        const store=group.store;
        if(!Number.isFinite(buyerLat)||!Number.isFinite(buyerLng)||store.storeLat==null||store.storeLng==null) return {store,fee:null,capped:false};
        const distance=typeof window.haversine==='function'?window.haversine(buyerLat,buyerLng,Number(store.storeLat),Number(store.storeLng)):1.5;
        const {data,error}=await db.rpc('buyeasy_delivery_quote',{p_product_total:group.subtotal,p_delivery_distance_km:distance,p_transport_type:'motorcycle'});
        if(error)throw error;
        return {store,fee:Number(data.maximum_delivery_fee),capped:!!data.maximum_capped_to_keep_affordable};
      }));
      if(token!==feePreviewToken)return;
      const missing=quotes.some(q=>q.fee===null),delivery=quotes.reduce((sum,q)=>sum+(q.fee||0),0),capped=quotes.some(q=>q.capped),known=quotes.filter(q=>q.fee!==null);
      el.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px"><span>Products</span><b>${money(products)}</b></div>
        ${known.map(q=>`<div style="display:flex;justify-content:space-between;gap:10px;margin-top:6px"><span>${esc(q.store.storeName)} • delivery fee</span><b>${money(q.fee)}${q.capped?'*':''}</b></div>`).join('')}
        <div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:14px"><span>Your total${missing?' (fee unavailable)':''}</span><b>${money(products+delivery)}</b></div>
        ${capped?'<div style="margin-top:6px;color:#22c55e;font-size:11px;font-weight:800">* Delivery capped to keep it affordable.</div>':''}
        <div style="margin-top:7px;font-size:11px;line-height:1.45">The delivery fee and total shown are the most you will pay. The price is locked when you place the order and can never increase. If a lower-cost Rider accepts, your Wallet is refunded or your cash amount is reduced.${missing?' Save your map pin and make sure each store has a GPS location to see the fee before checkout.':''}</div>`;
    }catch(error){if(token===feePreviewToken)el.textContent='We could not calculate your delivery fee yet. Check that your saved map pin and Store location are available, then try again. '+(error?.message||'');}
  };
  window.openGallery = function(id) {
    const product=state.products.find(p=>p.id===id); if(!product) return;
    if(typeof galleryMedia!=='undefined') galleryMedia=product.media.length?product.media:(product.img?[{type:'image',src:product.img}]:[]);
    if(typeof galleryIndex!=='undefined') galleryIndex=0;
    if($('galleryTitle')) $('galleryTitle').textContent=product.name;
    if($('galleryModal')) $('galleryModal').style.display='flex';
    if(typeof window.renderGallery==='function') window.renderGallery();
  };
  document.addEventListener('DOMContentLoaded', async () => {
    try { await auth(); await loadProfile(); await loadCatalogue(); await renderOrders(); await updateStats(); await renderWalletHistory(); renderCart(); window.renderSavedCards(); window.updateAddMoneyButton(); }
    catch(error) { fail(error); }
  }, { once:true });
})();
