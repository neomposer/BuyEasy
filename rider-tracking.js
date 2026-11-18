/* BUYEasy - rider tracking map.
   Shows: You -> Store (before pickup) and You -> Customer (after pickup),
   plus the Store -> Customer leg. GPS is used ONLY while a delivery is active. */
window.RiderTracking = (function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let map = null, mRider = null, mStore = null, mBuyer = null, lnMain = null, lnLeg = null;
  let watchId = null, pos = null, active = null, gpsMsg = '', acc = null, fixAt = 0, hiAcc = false, centered = false, mAcc = null;

  const dot = c => L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11],
    html: `<div style="width:16px;height:16px;background:${c};border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px ${c}"></div>` });
  const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const ok = p => p && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  function km(a, b) {
    const R = 6371, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const gmap = (dest, wp) => 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + dest.join(',') + (wp ? '&waypoints=' + wp.join(',') : '');

  function init() {
    if (map || !window.L || !document.getElementById('riderMap')) return;
    map = L.map('riderMap', { zoomControl: false }).setView([-29.8587, 31.0218], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
  }
  function clearLayers() {
    [mRider, mStore, mBuyer, lnMain, lnLeg, mAcc].forEach(l => { if (l && map) map.removeLayer(l); });
    mRider = mStore = mBuyer = lnMain = lnLeg = mAcc = null;
  }
  /* GPS is detected automatically. It runs all the time the rider screen is open:
     low power when idle, high accuracy while a delivery is active. */
  function startWatch() {
    if (!navigator.geolocation) { gpsMsg = 'Your phone does not support location.'; return paintIdle(false); }
    const wantHigh = !!active;
    if (watchId !== null && wantHigh === hiAcc) return;
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    hiAcc = wantHigh;
    watchId = navigator.geolocation.watchPosition(p => {
      pos = [p.coords.latitude, p.coords.longitude]; acc = p.coords.accuracy; fixAt = Date.now(); gpsMsg = '';
      if (active) draw(false); else paintIdle(!centered);
    }, e => {
      gpsMsg = e.code === 1 ? 'Location is blocked. Allow location for BuyEasy in your phone settings, then reopen the app.' : 'Looking for your location…';
      if (active) draw(false); else paintIdle(false);
    }, { enableHighAccuracy: hiAcc, maximumAge: hiAcc ? 5000 : 30000, timeout: 20000 });
  }
  function stopWatch() { if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; } pos = null; }

  /* map with no delivery: show where the rider is right now */
  function paintIdle(center) {
    const s = document.getElementById('navStatus'), d = document.getElementById('navDetail');
    if (s) s.textContent = ok(pos) ? '📍 You are here' : '📍 Finding your location…';
    if (d) d.textContent = ok(pos) ? (acc ? `Accurate to about ${Math.round(acc)} m` : 'Location found') : gpsMsg;
    const empty = document.getElementById('trackEmpty');
    if (empty && !active) empty.innerHTML = ok(pos) ? 'Accept a job to see your route here: you → store → customer.' : esc(gpsMsg || 'Looking for your location…');
    if (!map || !window.L || active) return;
    clearLayers();
    if (ok(pos)) {
      mAcc = L.circle(pos, { radius: Math.max(15, acc || 30), color: '#22c55e', weight: 1, fillColor: '#22c55e', fillOpacity: 0.12 }).addTo(map);
      mRider = L.marker(pos, { icon: dot('#22c55e') }).addTo(map).bindPopup('You are here');
      if (center) { map.setView(pos, 16); centered = true; }
    }
  }

  function setActive(order) {
    active = order || null;
    const card = document.getElementById('trackCard'), empty = document.getElementById('trackEmpty');
    startWatch();                                           // switches accuracy up or down
    if (!active) { clearLayers(); if (card) card.classList.add('hidden'); if (empty) empty.classList.remove('hidden'); paintIdle(!centered); return; }
    if (empty) empty.classList.add('hidden');
    draw(true);
  }

  function draw(fit) {
    const card = document.getElementById('trackCard');
    if (!active || !card) return;
    const S = [num(active.storeLat), num(active.storeLng)], B = [num(active.buyerLat), num(active.buyerLng)];
    const toStore = active.status === 'assigned';
    const target = toStore ? S : B, targetName = toStore ? (active.storeName || 'the store') : (active.customer || 'the customer');
    if (map && window.L) {
      clearLayers();
      if (ok(pos)) mRider = L.marker(pos, { icon: dot('#22c55e') }).addTo(map).bindPopup('You');
      if (ok(S)) mStore = L.marker(S, { icon: dot('#f59e0b') }).addTo(map).bindPopup('🏪 ' + esc(active.storeName || 'Store'));
      if (ok(B)) mBuyer = L.marker(B, { icon: dot('#3b82f6') }).addTo(map).bindPopup('🏠 ' + esc(active.customer || 'Customer'));
      if (ok(pos) && ok(target)) lnMain = L.polyline([pos, target], { color: '#22c55e', weight: 5 }).addTo(map);
      if (toStore && ok(S) && ok(B)) lnLeg = L.polyline([S, B], { color: '#3b82f6', weight: 4, dashArray: '8 8' }).addTo(map);
      if (fit) { const pts = [pos, S, B].filter(ok); if (pts.length) { try { map.fitBounds(L.latLngBounds(pts).pad(0.3)); } catch (e) {} } }
    }
    const d1 = ok(pos) && ok(target) ? km(pos, target) : null, d2 = ok(S) && ok(B) ? km(S, B) : null;
    const lines = [];
    lines.push(`<div style="font-weight:900;font-size:13px">${toStore ? '1️⃣ Go to the store' : '2️⃣ Deliver to the customer'}</div>`);
    lines.push(`<div style="margin-top:4px">${toStore ? '🏪' : '🏠'} <b>${esc(targetName)}</b>${active.address && !toStore ? '<br>📍 ' + esc(active.address) : ''}</div>`);
    if (d1 !== null) lines.push(`<div style="color:#22c55e;margin-top:4px">≈ ${d1.toFixed(1)} km from you (straight line)</div>`);
    else lines.push(`<div style="color:#f59e0b;margin-top:4px">${esc(gpsMsg || 'Looking for your location…')}</div>`);
    if (toStore && d2 !== null) lines.push(`<div style="color:#60a5fa">Then store → customer ≈ ${d2.toFixed(1)} km</div>`);
    if (active.cash > 0) lines.push(`<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(245,158,11,.15);color:#f59e0b;font-weight:800">💵 Collect R${Number(active.cash).toFixed(2)} cash from the customer</div>`);
    document.getElementById('trackInfo').innerHTML = lines.join('');

    const b = [];
    if (ok(target)) b.push(`<a class="btn-green" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="${gmap(target, null)}">🧭 Navigate to ${toStore ? 'store' : 'customer'}</a>`);
    if (toStore && ok(S) && ok(B)) b.push(`<a class="btn-white" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="${gmap(B, S)}">🗺️ Full route: store → customer</a>`);
    b.push(toStore
      ? `<button class="btn-green" onclick="markPickedUp('${esc(active.id)}')">📦 I have picked up the order</button>`
      : `<button class="btn-green" onclick="completeDel('${esc(active.id)}')">✅ Delivered</button>`);
    document.getElementById('trackBtns').innerHTML = b.join('');
    card.classList.remove('hidden');
    const s = document.getElementById('navStatus'); if (s) s.textContent = toStore ? '🏪 Heading to the store' : '🏠 Heading to the customer';
    const dd = document.getElementById('navDetail'); if (dd) dd.textContent = d1 !== null ? `≈ ${d1.toFixed(1)} km to go` : 'Locating you…';
  }

  return {
    init, setActive,
    autoStart() { init(); startWatch(); paintIdle(true); },
    getPos() { return ok(pos) ? { lat: pos[0], lng: pos[1], acc, at: fixAt } : null; },
    refresh() { init(); if (map) map.invalidateSize(); if (active) draw(true); else paintIdle(true); },
    center() { if (map && ok(pos)) map.setView(pos, 16); else startWatch(); }
  };
})();
