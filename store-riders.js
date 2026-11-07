/* BUYEasy - Store "Riders" tab
   Store owners approve or decline riders who asked to work for the store.
   Only approved riders can see and accept this store's ready orders. */
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let rows = [];
  let busy = false;

  function client() { return window.supabaseClient; }

  function card(r, buttons) {
    const transport = ({ foot: 'On foot', bicycle: 'Bicycle', motorcycle: 'Motorbike', motorbike: 'Motorbike', car: 'Car' })[r.transport_type] || r.transport_type || '';
    return `<div class="hist-item" style="align-items:center;gap:10px">
      <div><b>${esc(r.full_name || 'Rider')}</b>
        <div class="status">${esc(r.phone || '')}${transport ? ' • ' + esc(transport) : ''}</div></div>
      <div style="display:flex;gap:6px">${buttons}</div></div>`;
  }

  function draw() {
    const box = el('ridersBody'); if (!box) return;
    const pending = rows.filter(r => r.status === 'pending');
    const approved = rows.filter(r => r.status === 'approved');
    const badge = el('ridersBadge'); if (badge) badge.textContent = pending.length ? ` (${pending.length})` : '';

    const pendingHtml = pending.length
      ? pending.map(r => card(r,
          `<button class="btn-green" style="padding:8px 12px;font-size:12px" onclick="reviewRider('${esc(r.link_id)}','approved')">Approve</button>
           <button class="btn-white" style="padding:8px 12px;font-size:12px" onclick="reviewRider('${esc(r.link_id)}','rejected')">Decline</button>`)).join('')
      : '<p class="status">No riders are waiting for approval.</p>';

    const approvedHtml = approved.length
      ? approved.map(r => card(r,
          `<button class="btn-white" style="padding:8px 12px;font-size:12px" onclick="reviewRider('${esc(r.link_id)}','removed')">Remove</button>`)).join('')
      : '<p class="status">You have no approved riders yet. <b>Orders from your store can only be delivered by riders you approve.</b></p>';

    box.innerHTML = `<div style="font-weight:900;margin-bottom:6px">Waiting for your approval</div>${pendingHtml}
      <div style="font-weight:900;margin:16px 0 6px">My riders</div>${approvedHtml}`;
  }

  async function loadRiderRequests() {
    if (busy || !client()) return;
    busy = true;
    try {
      const { data, error } = await client().rpc('store_list_rider_requests');
      if (error) throw error;
      rows = data || [];
      draw();
    } catch (e) {
      console.error(e);
      const box = el('ridersBody');
      if (box) box.innerHTML = `<p class="status">Could not load riders: ${esc(e.message)}</p>`;
    } finally { busy = false; }
  }

  async function reviewRider(linkId, decision) {
    const text = { approved: 'Approve this rider for your store?', rejected: 'Decline this rider?', removed: 'Remove this rider from your store?' }[decision];
    if (!confirm(text)) return;
    try {
      const { error } = await client().rpc('store_review_rider', { p_link_id: linkId, p_decision: decision });
      if (error) throw error;
      if (typeof notify === 'function') notify(decision === 'approved' ? 'Rider approved' : decision === 'rejected' ? 'Rider declined' : 'Rider removed');
      busy = false;
      await loadRiderRequests();
    } catch (e) { console.error(e); alert(e.message || 'Could not update this rider.'); }
  }

  window.loadRiderRequests = loadRiderRequests;
  window.reviewRider = reviewRider;

  // refresh when the Riders tab opens
  const originalOpenTab = window.openTab;
  if (typeof originalOpenTab === 'function') {
    window.openTab = function (id, element) {
      originalOpenTab(id, element);
      if (id === 'riders') loadRiderRequests();
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadRiderRequests, 1500);
    setInterval(() => { if (!document.hidden) loadRiderRequests(); }, 30000);
  });
})();
