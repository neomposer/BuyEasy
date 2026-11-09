/* BUYEasy - heartbeat. Lets the system know the store / rider / buyer is active.
   After 12 hours with no activity, stores and riders are switched offline automatically. */
(function () {
  'use strict';
  const db = window.supabaseClient; if (!db) return;
  const beat = () => { if (!document.hidden) db.rpc('touch_activity').then(() => {}, () => {}); };
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(beat, 1500);
    setInterval(beat, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(); });
  });
})();
