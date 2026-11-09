/* BUYEasy - buyer alerts. Order updates ring until you tap them. */
(function () {
  'use strict';
  const db = window.supabaseClient;
  const A = () => window.BuyEasyAlerts;
  const money = v => 'R' + Number(v || 0).toFixed(2);
  let known = null, busy = false, uid = null;

  const goOrders = () => { const t = [...document.querySelectorAll('.bnav-tab,.tab,button')].find(x => /Orders/.test(x.textContent || '')); if (t) t.click(); };

  async function poll() {
    if (busy || !db || !A()) return; busy = true;
    try {
      if (!uid) { const { data } = await db.auth.getSession(); uid = data?.session?.user?.id; }
      if (!uid) return;
      const key = 'be_buyer_status_' + uid;
      if (known === null) { try { known = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { known = null; } }
      const first = known === null; known = known || {};
      const { data, error } = await db.from('orders').select('id,order_number,status,payment_method,total,cancel_reason').eq('buyer_id', uid).order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      (data || []).forEach(o => {
        const prev = known[o.id];
        if (prev !== o.status && !(first && prev === undefined)) {
          const n = o.order_number, cash = o.payment_method === 'cash';
          const m = {
            accepted: ['🏪', 'Store accepted your order', `Order ${n} is being prepared.`, false],
            ready: ['📦', 'Order is ready', `Order ${n} is ready. We are finding a rider.`, false],
            assigned: ['🏍️', 'Rider accepted', `A rider is heading to the store for order ${n}.`, false],
            picked_up: ['🚀', 'Your order is on the way!', `Order ${n} was picked up.${cash ? ` Please have ${money(o.total)} cash ready for the rider.` : ''}`, true],
            delivered: ['✅', 'Order delivered', `Order ${n} was delivered. Please rate your store and rider.`, true],
            cancelled: ['❌', 'Order cancelled', `Order ${n} was cancelled.${o.cancel_reason ? ' ' + o.cancel_reason + '.' : ''}${o.payment_method === 'wallet' ? ' Your wallet was refunded.' : ''}`, true],
            rejected: ['⚠️', 'Order declined', `Order ${n} was declined by the store.`, true]
          }[o.status];
          if (m) A().alert({ id: `buy:${o.id}:${o.status}`, icon: m[0], title: m[1], body: m[2], ring: m[3], actionLabel: m[3] ? 'View orders' : undefined, onAction: goOrders });
          if (['delivered', 'cancelled'].includes(o.status) && window.BuyEasyRatings) setTimeout(() => BuyEasyRatings.check(), 2500);
          if (typeof window.renderOrders === 'function') window.renderOrders();
        }
        known[o.id] = o.status;
      });
      try { localStorage.setItem(key, JSON.stringify(known)); } catch (e) {}
    } catch (e) { console.warn('Buyer alerts:', e.message || e); }
    finally { busy = false; }
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { poll(); db && db.rpc('cancel_stale_orders').then(() => {}, () => {}); }, 2500);
    setInterval(() => { if (!document.hidden) poll(); }, 15000);
    setInterval(() => { if (!document.hidden && db) db.rpc('cancel_stale_orders').then(() => {}, () => {}); }, 300000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  });
})();
