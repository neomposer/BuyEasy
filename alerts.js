/* BUYEasy alerts - rings and vibrates until the person attends to it (like Uber).
   BuyEasyAlerts.alert({id,title,body,ring,actionLabel,onAction})
   BuyEasyAlerts.resolve(id)  -> remove an alert that no longer applies (no ack saved)
   Notes: sound needs one tap on the page after it opens (browser rule). When the app is
   in the background, a system notification is shown if the person allowed notifications.
   A fully closed app cannot ring without a push server. */
(function () {
  'use strict';
  const KEY = 'buyeasy_ack_v1';
  let acked = new Set();
  try { acked = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) {}
  const active = new Map();
  let ctx = null, ringTimer = null, titleTimer = null, host = null;
  const baseTitle = document.title;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function persist() { try { localStorage.setItem(KEY, JSON.stringify([...acked].slice(-400))); } catch (e) {} }

  function unlock() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
  }
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(ev => addEventListener(ev, unlock, { passive: true }));

  function tone(freq, at, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.28, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(ctx.destination); o.start(at); o.stop(at + dur + 0.02);
  }
  function chime(strong) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    (strong ? [[988, 0], [740, .22], [988, .44], [740, .66]] : [[880, 0], [1175, .18]]).forEach(([f, o]) => tone(f, t + o, .17));
  }
  function buzz() { try { navigator.vibrate && navigator.vibrate([350, 150, 350]); } catch (e) {} }

  function anyRinging() { return [...active.values()].some(a => a.ring); }
  function syncRing() {
    if (anyRinging()) {
      if (!ringTimer) {
        chime(true); buzz();
        ringTimer = setInterval(() => { chime(true); buzz(); }, 2000);
        titleTimer = setInterval(() => { document.title = document.title === baseTitle ? '🔔 NEW ALERT' : baseTitle; }, 900);
      }
    } else {
      clearInterval(ringTimer); clearInterval(titleTimer); ringTimer = titleTimer = null;
      document.title = baseTitle;
      try { navigator.vibrate && navigator.vibrate(0); } catch (e) {}
    }
  }

  function ensureHost() {
    if (host) return host;
    const css = document.createElement('style');
    css.textContent = `#beAlerts{position:fixed;left:0;right:0;top:0;z-index:2147483000;display:flex;flex-direction:column;gap:8px;padding:10px;pointer-events:none;font-family:Inter,system-ui,sans-serif}
.be-card{pointer-events:auto;background:#101010;color:#fff;border:2px solid #22c55e;border-radius:18px;padding:14px;box-shadow:0 12px 40px rgba(0,0,0,.55);max-width:520px;width:100%;margin:0 auto;box-sizing:border-box}
.be-card.ring{animation:bePulse 1s infinite}
@keyframes bePulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.65),0 12px 40px rgba(0,0,0,.55)}50%{box-shadow:0 0 0 12px rgba(34,197,94,0),0 12px 40px rgba(0,0,0,.55)}}
.be-title{font-weight:900;font-size:15px}.be-body{font-size:13px;color:#cfcfcf;margin-top:4px;line-height:1.4;white-space:pre-line}
.be-row{display:flex;gap:8px;margin-top:12px}.be-row button{flex:1;padding:11px;border-radius:12px;border:0;font-weight:800;cursor:pointer;font-size:13px}
.be-go{background:#22c55e;color:#04210f}.be-ok{background:#262626;color:#fff}.be-snd{font-size:11px;color:#f59e0b;margin-top:8px}`;
    document.head.appendChild(css);
    host = document.createElement('div'); host.id = 'beAlerts';
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  function render() {
    const h = ensureHost();
    const cards = [...active.values()].slice(-3).reverse();
    const soundOff = anyRinging() && (!ctx || ctx.state !== 'running');
    h.innerHTML = cards.map(a => `<div class="be-card ${a.ring ? 'ring' : ''}" role="alert">
      <div class="be-title">${esc(a.icon || '🔔')} ${esc(a.title)}</div>
      <div class="be-body">${esc(a.body || '')}</div>
      ${soundOff && a.ring ? '<div class="be-snd">Tap anywhere to turn the alert sound on.</div>' : ''}
      <div class="be-row">${a.actionLabel ? `<button class="be-go" data-act="go" data-id="${esc(a.id)}">${esc(a.actionLabel)}</button>` : ''}
      <button class="be-ok" data-act="ok" data-id="${esc(a.id)}">${a.actionLabel ? 'Dismiss' : 'OK'}</button></div></div>`).join('');
  }

  addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#beAlerts button[data-act]');
    if (!b) return;
    const a = active.get(b.dataset.id); if (!a) return;
    if (b.dataset.act === 'go' && typeof a.onAction === 'function') { try { a.onAction(); } catch (err) { console.error(err); } }
    BuyEasyAlerts.ack(a.id);
  });

  function systemNotify(a) {
    if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body: a.body || '', tag: a.id, requireInteraction: !!a.ring, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [300, 150, 300] };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(r => r.showNotification(a.title, opts)).catch(() => new Notification(a.title, opts));
      } else { new Notification(a.title, opts); }
    } catch (e) {}
  }

  const BuyEasyAlerts = {
    alert(o) {
      if (!o || !o.id || acked.has(o.id)) return false;
      const isNew = !active.has(o.id);
      active.set(o.id, Object.assign({ ring: true }, o));
      render(); syncRing();
      if (isNew) {
        systemNotify(active.get(o.id));
        if (!o.ring) { chime(false); buzz(); setTimeout(() => BuyEasyAlerts.ack(o.id), 9000); }
      }
      return true;
    },
    ack(id) { acked.add(id); persist(); active.delete(id); render(); syncRing(); },
    resolve(id) { if (active.delete(id)) { render(); syncRing(); } },
    has(id) { return active.has(id) || acked.has(id); },
    test() { acked.delete('test'); this.alert({ id: 'test', title: 'Test alert', body: 'This is how important alerts will look and sound.', ring: true }); }
  };
  window.BuyEasyAlerts = BuyEasyAlerts;
})();
