/* BUYEasy - store alerts. New orders and rider requests ring until attended. */
(function () {
  'use strict';
  const db = window.supabaseClient;
  const A = () => window.BuyEasyAlerts;
  const money = v => 'R' + Number(v || 0).toFixed(2);
  let known = null, busy = false;

  function goOrders() { const t = [...document.querySelectorAll('.bnav-tab')].find(x => /Orders/.test(x.textContent)); if (t && window.openTab) window.openTab('orders', t); }
  function goRiders() { const t = [...document.querySelectorAll('.bnav-tab')].find(x => /Riders/.test(x.textContent)); if (t && window.openTab) window.openTab('riders', t); }

  async function poll() {
    if (busy || !db || typeof currentStore === 'undefined' || !currentStore || !A()) return;
    busy = true;
    try {
      const key = 'be_store_status_' + currentStore.id;
      if (known === null) { try { known = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { known = null; } }
      const first = known === null; known = known || {};
      const { data, error } = await db.from('orders').select('id,order_number,status,payment_method,total,updated_at').eq('store_id', currentStore.id).order('created_at', { ascending: false }).limit(60);
      if (error) throw error;
      let changed = false;
      (data || []).forEach(o => {
        const prev = known[o.id], cash = o.payment_method === 'cash' ? '\n💵 Cash on delivery: the rider collects ' + money(o.total) : '';
        if (o.status === 'pending') {
          A().alert({ id: `ord:${o.id}:pending`, icon: '🛒', title: 'New order!', body: `Order ${o.order_number} • ${money(o.total)}${cash}`, ring: true, actionLabel: 'View order', onAction: goOrders });
        } else { A().resolve(`ord:${o.id}:pending`); }
        if (prev !== o.status) {
          changed = true;
          if (!first || prev !== undefined) {
            if (o.status === 'assigned') A().alert({ id: `ord:${o.id}:assigned`, icon: '🏍️', title: 'Rider accepted', body: `A rider is coming to collect order ${o.order_number}.`, ring: false });
            if (o.status === 'picked_up') A().alert({ id: `ord:${o.id}:picked`, icon: '📦', title: 'Order picked up', body: `Order ${o.order_number} was collected by the rider.`, ring: false });
            if (o.status === 'delivered') { A().alert({ id: `ord:${o.id}:delivered`, icon: '✅', title: 'Order delivered', body: `Order ${o.order_number} was delivered.`, ring: false }); if (window.BuyEasyRatings) setTimeout(() => BuyEasyRatings.check(true), 1500); }
            if (o.status === 'cancelled') A().alert({ id: `ord:${o.id}:cancelled`, icon: '❌', title: 'Order cancelled', body: `Order ${o.order_number} was cancelled.`, ring: true, actionLabel: 'OK' });
          }
        }
        known[o.id] = o.status;
      });
      try { localStorage.setItem(key, JSON.stringify(known)); } catch (e) {}
      if (changed && typeof loadOrders === 'function') loadOrders().catch(() => {});

      const r = await db.rpc('store_list_rider_requests');
      if (!r.error) (r.data || []).filter(x => x.status === 'pending').forEach(x =>
        A().alert({ id: `req:${x.link_id}`, icon: '🏍️', title: 'Rider wants to work for you', body: `${x.full_name || 'A rider'} asked to deliver your orders.`, ring: true, actionLabel: 'Review', onAction: goRiders }));
    } catch (e) { console.warn('Store alerts:', e.message || e); }
    finally { busy = false; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { poll(); db && db.rpc('cancel_stale_orders').then(() => {}, () => {}); }, 2500);
    setInterval(() => { if (!document.hidden) poll(); }, 15000);
    setInterval(() => { if (!document.hidden && db) db.rpc('cancel_stale_orders').then(() => {}, () => {}); }, 300000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  });
})();
