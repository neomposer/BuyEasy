/* BUYEasy - professional "no internet" screen shown over any page when the phone is offline. */
(function () {
  'use strict';
  let box = null, checking = false;
  function build() {
    if (box) return box;
    const css = document.createElement('style');
    css.textContent = `#beOffline{position:fixed;inset:0;z-index:2147483600;background:linear-gradient(160deg,#052e16 0%,#0b0b0b 55%);color:#fff;display:none;align-items:center;justify-content:center;padding:28px;font-family:Inter,system-ui,sans-serif;text-align:center}
#beOffline.show{display:flex}.beo-card{max-width:360px;width:100%}
.beo-ring{width:116px;height:116px;margin:0 auto 22px;border-radius:50%;display:grid;place-items:center;background:rgba(34,197,94,.12);border:2px solid rgba(34,197,94,.45);animation:beoPulse 2.2s infinite}
@keyframes beoPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.45)}70%{box-shadow:0 0 0 26px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
#beOffline h1{font-size:24px;margin:0 0 8px;font-weight:900;letter-spacing:-.4px}#beOffline p{margin:0 0 22px;color:#b9c4bd;font-size:14px;line-height:1.55}
#beOffline ul{list-style:none;padding:0;margin:0 0 24px;text-align:left;background:rgba(255,255,255,.05);border-radius:14px;padding:12px 16px;font-size:13px;color:#d7e0da}
#beOffline li{padding:5px 0}#beOffline li:before{content:"✓";color:#22c55e;font-weight:900;margin-right:8px}
#beoRetry{width:100%;padding:14px;border:0;border-radius:14px;background:#22c55e;color:#04210f;font-weight:900;font-size:15px;cursor:pointer}
#beoRetry:disabled{opacity:.65}.beo-brand{margin-top:22px;font-size:12px;color:#7d8a82;letter-spacing:.5px}
#beBack{position:fixed;top:12px;left:50%;transform:translate(-50%,-90px);transition:transform .35s;z-index:2147483601;background:#22c55e;color:#04210f;font-weight:800;padding:10px 18px;border-radius:999px;font:700 13px Inter,system-ui,sans-serif}
#beBack.show{transform:translate(-50%,0)}`;
    document.head.appendChild(css);
    box = document.createElement('div'); box.id = 'beOffline'; box.setAttribute('role', 'alertdialog');
    box.innerHTML = `<div class="beo-card"><div class="beo-ring"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8a15 15 0 0 0-8.4-4.6M5 12.9a10 10 0 0 1 3.4-2M19 12.9a10 10 0 0 0-2.3-1.9M8.5 16.4a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1" fill="#22c55e"/><path d="M3 3l18 18"/></svg></div>
      <h1>You're offline</h1><p>BuyEasy can't reach the internet right now. Your data or Wi-Fi may be off, or you have no signal.</p>
      <ul><li>Turn on mobile data or Wi-Fi</li><li>Move to a spot with better signal</li><li>We'll reconnect automatically</li></ul>
      <button id="beoRetry" type="button">Try again</button><div class="beo-brand">BuyEasy</div></div>`;
    document.body.appendChild(box);
    const back = document.createElement('div'); back.id = 'beBack'; back.textContent = '✓ Back online'; document.body.appendChild(back);
    box.querySelector('#beoRetry').addEventListener('click', verify);
    return box;
  }
  async function reachable() {
    if (!navigator.onLine) return false;
    try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
      await fetch(location.origin + '/manifest.json?ping=' + Date.now(), { cache: 'no-store', signal: c.signal }); clearTimeout(t); return true; }
    catch (e) { return false; }
  }
  async function verify() {
    if (checking) return; checking = true;
    const b = build().querySelector('#beoRetry'); b.disabled = true; b.textContent = 'Checking…';
    const ok = await reachable();
    b.disabled = false; b.textContent = 'Try again'; checking = false;
    if (ok) { hide(true); }
  }
  function show() { build().classList.add('show'); }
  function hide(announce) {
    if (!box || !box.classList.contains('show')) return;
    box.classList.remove('show');
    if (announce) { const b = document.getElementById('beBack'); b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 2200); }
  }
  function init() {
    if (!navigator.onLine) show();
    addEventListener('offline', show);
    addEventListener('online', () => setTimeout(verify, 400));
    setInterval(() => { if (box && box.classList.contains('show')) verify(); }, 8000);
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
