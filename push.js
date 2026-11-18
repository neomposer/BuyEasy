/* BuyEasy push notifications: alerts that reach the phone even when the app is closed.
   PushAlerts.init('buyer' | 'store' | 'rider')
   Android: works in Chrome. iPhone: the person must first "Add to Home Screen" (iOS 16.4+). */
(function () {
  'use strict';
  const db = window.supabaseClient;
  window.PushAlerts = { init() {} };                         // safe no-op until everything is ready
  const PUB = window.BUYEASY && BUYEASY.vapidPublicKey;
  if (!db || !PUB) return;
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let role = 'buyer', card = null, banner = null, state = 'unknown';

  const u8 = b64 => { const p = '='.repeat((4 - b64.length % 4) % 4); const r = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  const reg = () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(() => navigator.serviceWorker.ready);

  async function save(sub) {
    const j = sub.toJSON();
    const { error } = await db.rpc('push_save_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_role: role, p_user_agent: ua.slice(0, 200) });
    if (error) throw error;
  }
  async function current() { if (!supported) return null; const r = await reg(); return r.pushManager.getSubscription(); }

  async function enable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { state = perm === 'denied' ? 'denied' : 'default'; return draw(); }
      const r = await reg();
      let sub = await r.pushManager.getSubscription();
      if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(PUB) });
      await save(sub); state = 'on'; draw();
      if (window.BuyEasyAlerts) BuyEasyAlerts.alert({ id: 'push-on-' + Date.now(), icon: '🔔', title: 'Alerts are on', body: 'You will now get order alerts even when the app is closed.', ring: false });
    } catch (e) { console.error(e); alert('Could not turn on alerts: ' + (e.message || e)); }
  }
  async function disable() {
    try { const sub = await current(); if (sub) { await db.rpc('push_remove_subscription', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); } state = 'default'; draw(); }
    catch (e) { alert(e.message || 'Could not turn off alerts.'); }
  }
  async function test() {
    const { error } = await db.rpc('push_send_test'); if (error) return alert(error.message);
    alert('Test sent. If nothing arrives in a few seconds, check that push setup was finished (see PUSH-SETUP.txt) and that notifications are allowed for this app.');
  }
  async function detect() {
    if (isIOS && !standalone) { state = 'ios-install'; return; }
    if (!supported) { state = 'unsupported'; return; }
    if (Notification.permission === 'denied') { state = 'denied'; return; }
    const sub = await current().catch(() => null);
    if (sub && Notification.permission === 'granted') { state = 'on'; save(sub).catch(() => {}); } else state = 'default';
  }

  function css() {
    if (document.getElementById('bePushCss')) return;
    const s = document.createElement('style'); s.id = 'bePushCss';
    s.textContent = `.bp-card{border-radius:20px;padding:16px;margin-bottom:12px;border:1px solid var(--border);background:linear-gradient(160deg,var(--card),var(--card2))}
.bp-card.on{border-color:rgba(34,197,94,.45)}.bp-card.warn{border-color:rgba(245,158,11,.45)}
.bp-h{display:flex;gap:12px;align-items:center}.bp-i{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:21px;background:var(--card3)}
.bp-h b{font-size:15px;display:block}.bp-h span{font-size:12.5px;color:var(--muted);line-height:1.45}
.bp-steps{margin:10px 0 0;padding-left:20px;font-size:13px;line-height:1.7;color:var(--muted)}.bp-steps b{color:var(--text)}
.bp-row{display:flex;gap:8px;margin-top:12px}.bp-row button{flex:1;min-height:44px;border-radius:12px;border:1px solid var(--border);background:var(--card3);color:var(--text);font-weight:800;cursor:pointer}
.bp-row button.g{background:var(--green);color:#052e16;border-color:var(--green)}
#bePushBanner{padding:0 12px;max-width:760px;margin:10px auto 0}`;
    document.head.appendChild(s);
  }
  function body() {
    if (state === 'on') return { cls: 'on', icon: '🔔', t: 'Alerts are ON', s: 'You get order alerts even when the app is closed.', btns: '<button data-bp="test">Send test</button><button data-bp="off">Turn off</button>' };
    if (state === 'denied') return { cls: 'warn', icon: '🔕', t: 'Alerts are blocked', s: 'Open your phone or browser settings, allow notifications for BuyEasy, then come back here.', btns: '' };
    if (state === 'unsupported') return { cls: 'warn', icon: '📵', t: 'Alerts not supported here', s: 'Open BuyEasy in Chrome (Android) or Safari (iPhone, added to Home Screen).', btns: '' };
    if (state === 'ios-install') return { cls: 'warn', icon: '📲', t: 'Add BuyEasy to your Home Screen', s: 'iPhone only allows alerts for apps on the Home Screen. It takes 20 seconds:', steps: ['Tap the <b>Share</b> button (square with arrow) in Safari', 'Choose <b>Add to Home Screen</b>, then <b>Add</b>', 'Open <b>BuyEasy</b> from your Home Screen and turn alerts on here'], btns: '' };
    return { cls: '', icon: '🔔', t: 'Never miss an order', s: role === 'rider' ? 'Get a loud alert for every new job, even when the app is closed.' : role === 'store' ? 'Get a loud alert for every new order, even when the app is closed.' : 'Get updates when your order is accepted, on the way and delivered.', btns: '<button class="g" data-bp="on">Turn on alerts</button>' };
  }
  function html() {
    const b = body();
    return `<div class="bp-card ${b.cls}"><div class="bp-h"><div class="bp-i">${b.icon}</div><div><b>${b.t}</b><span>${b.s}</span></div></div>${b.steps ? `<ol class="bp-steps">${b.steps.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}${b.btns ? `<div class="bp-row">${b.btns}</div>` : ''}</div>`;
  }
  function handle(e) {
    const b = e.target.closest('[data-bp]'); if (!b) return;
    ({ on: enable, off: disable, test: test })[b.dataset.bp]();
  }
  function draw() {
    css();
    if (card) card.innerHTML = html();
    if (banner) { const dismissed = Number(localStorage.getItem('be_push_dismiss') || 0) > Date.now(); banner.innerHTML = (state === 'default' || state === 'ios-install') && !dismissed ? `${html().replace('<div class="bp-row">', '<div class="bp-row"><button data-bp="later">Not now</button>')}` : ''; }
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-bp="later"]')) { localStorage.setItem('be_push_dismiss', String(Date.now() + 86400000)); draw(); return; } handle(e); });

  async function mount() {
    await detect(); css();
    const settings = document.getElementById('settings');
    if (settings && !document.getElementById('bePushCard')) { card = document.createElement('div'); card.id = 'bePushCard'; const help = settings.querySelector('.be-help'); settings.insertBefore(card, help ? help.nextSibling : settings.firstChild); }
    const bh = document.getElementById('brandHeader');
    if (bh && !document.getElementById('bePushBanner') && (role === 'store' || role === 'rider')) { banner = document.createElement('div'); banner.id = 'bePushBanner'; bh.parentNode.insertBefore(banner, bh.nextSibling); }
    draw();
  }
  window.PushAlerts = { init(r) { role = r || role; document.addEventListener('DOMContentLoaded', () => setTimeout(mount, 1200)); } };
})();
