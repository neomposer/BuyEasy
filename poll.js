/* BuyEasy smart refresh: asks the server less often when nothing is happening.
   - fast while the person is using the app, slower when idle, paused when hidden or offline
   - slows down further when Supabase live updates are connected
   - backs off automatically if the server returns errors
   BuyEasyPoll.every(fn, {fast, slow, relaxed})     BuyEasyPoll.realtime(['orders'], onChange) */
(function () {
  'use strict';
  const db = window.supabaseClient;
  let last = Date.now(), live = false;
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(ev => addEventListener(ev, () => { last = Date.now(); }, { passive: true }));

  function delayFor(o) {
    const idle = Date.now() - last > 120000;
    const d = live ? (o.relaxed || 45000) : idle ? (o.slow || 45000) : (o.fast || 15000);
    return d * (1 + Math.random() * 0.2);                      // small random spread so phones do not all call together
  }
  function every(fn, o) {
    o = o || {}; let t = null, errors = 0;
    const schedule = ms => { clearTimeout(t); t = setTimeout(tick, ms); };
    async function tick() {
      if (document.hidden || !navigator.onLine) return schedule(10000);
      try { await fn(); errors = 0; } catch (e) { errors++; }
      schedule(errors ? Math.min(120000, delayFor(o) * Math.pow(2, errors)) : delayFor(o));
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { clearTimeout(t); tick(); } });
    schedule(delayFor(o));
    return { now() { clearTimeout(t); tick(); } };
  }
  function realtime(tables, onChange) {
    if (!db || !db.channel) return;
    let timer = null;
    const fire = () => { clearTimeout(timer); timer = setTimeout(() => { try { onChange(); } catch (e) {} }, 600); };
    try {
      const ch = db.channel('be-live-' + Math.random().toString(36).slice(2));
      tables.forEach(tb => ch.on('postgres_changes', { event: '*', schema: 'public', table: tb }, fire));
      ch.subscribe(status => { live = status === 'SUBSCRIBED'; });
    } catch (e) { /* polling continues */ }
  }
  window.BuyEasyPoll = { every, realtime };
})();
