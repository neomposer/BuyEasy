/* BuyEasy - the buyer's location is detected AUTOMATICALLY every time the app opens
   (and again when the buyer returns to the app). No need to save it in Settings first.
   It drives "stores within 15 km", the delivery pin and (if empty) the delivery address. */
(function () {
  'use strict';
  const db = window.supabaseClient;
  let last = null, lastSaved = null, lastGeo = null, denied = false, warned = false, busy = null;

  const km = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const $ = id => document.getElementById(id);

  function status(text, color) { const s = $('locStatus'); if (s) { s.style.display = 'block'; s.textContent = text; s.style.color = color || ''; } }

  function applyFix(lat, lng) {
    const moved = !last || km(last, [lat, lng]) > 0.05;
    last = [lat, lng];
    try { buyerLatLng = [lat, lng]; } catch (e) { window.buyerLatLng = [lat, lng]; }
    if ($('b_lat')) $('b_lat').value = lat.toFixed(6);
    if ($('b_lng')) $('b_lng').value = lng.toFixed(6);
    status('✓ Location detected automatically', '#22c55e');
    try { if (typeof buyerMap !== 'undefined' && buyerMap && typeof buyerMarker !== 'undefined' && buyerMarker) { buyerMarker.setLatLng([lat, lng]); if (moved) buyerMap.setView([lat, lng], 16); } } catch (e) {}
    if (moved && window.applyBuyerRange) window.applyBuyerRange();
    if (moved) { saveProfile(lat, lng); fillAddress(lat, lng); }
  }

  async function saveProfile(lat, lng) {
    if (!db || (lastSaved && km(lastSaved, [lat, lng]) < 0.3)) return;
    try {
      const { data } = await db.auth.getSession(); const uid = data && data.session && data.session.user.id; if (!uid) return;
      const { error } = await db.from('profiles').update({ buyer_latitude: lat, buyer_longitude: lng }).eq('id', uid);
      if (!error) lastSaved = [lat, lng];
    } catch (e) {}
  }

  async function fillAddress(lat, lng) {
    const box = $('b_addr'); if (!box) return;
    const canFill = !box.value.trim() || box.dataset.auto === '1';
    if (!canFill || (lastGeo && km(lastGeo, [lat, lng]) < 0.15)) return;
    const key = 'be_geo_' + lat.toFixed(3) + '_' + lng.toFixed(3);
    let text = localStorage.getItem(key);
    if (!text) {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } });
        if (r.ok) {
          const j = await r.json(), a = j.address || {};
          const street = [a.house_number, a.road].filter(Boolean).join(' ');
          text = [street, a.suburb || a.neighbourhood || a.village, a.town || a.city || a.municipality].filter(Boolean).join(', ') || (j.display_name || '').split(',').slice(0, 3).join(',').trim();
          if (text) localStorage.setItem(key, text);
        }
      } catch (e) { /* the buyer can still type the address */ }
    }
    if (text && (!box.value.trim() || box.dataset.auto === '1')) { box.value = text; box.dataset.auto = '1'; lastGeo = [lat, lng]; }
  }

  function explainBlocked() {
    status('📍 Location is off. Tap to turn it on', '#eab308');
    if (warned || !window.BuyEasyUI) return; warned = true;
    BuyEasyUI.alert('BuyEasy finds the stores within 15 km of you automatically. To see them, allow location for this app:\n\n• Android: tap the lock icon in the address bar, then Permissions > Location > Allow\n• iPhone: Settings > Privacy & Security > Location Services > Safari Websites (or BuyEasy) > While Using', { dialog: true, title: 'Turn on your location', icon: '📍' });
  }

  function refresh(wait, force) {
    if (!navigator.geolocation) { status('⚠️ This phone cannot share its location', '#eab308'); return Promise.resolve(null); }
    if (busy) return busy;
    busy = new Promise(resolve => {
      status('📡 Finding your location…');
      navigator.geolocation.getCurrentPosition(p => {
        denied = false; applyFix(p.coords.latitude, p.coords.longitude); busy = null; resolve(last);
      }, e => {
        busy = null;
        if (e.code === 1) { denied = true; if (!last) explainBlocked(); else status('✓ Using your last known location', '#22c55e'); }
        else status('📡 Could not get a GPS fix yet', '#eab308');
        resolve(last);
      }, { enableHighAccuracy: false, maximumAge: force ? 0 : 60000, timeout: wait || 12000 });
    });
    return busy;
  }

  document.addEventListener('input', e => { if (e.target && e.target.id === 'b_addr') e.target.dataset.auto = '0'; });
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => refresh(15000), 900);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && (!last || !denied)) refresh(); });
    setInterval(() => { if (!document.hidden && !denied) refresh(); }, 5 * 60 * 1000);
  });
  window.BuyerLocation = { refresh: (w, f) => refresh(w, f !== false), get: () => last };
})();
