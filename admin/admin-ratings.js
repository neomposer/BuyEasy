/* BUYEasy admin - review ratings & comments, flag or suspend suspicious accounts. */
(function () {
  'use strict';
  const db = window.supabaseClient;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const color = s => ({ active: '#22c55e', flagged: '#f59e0b', suspended: '#ef4444' }[s] || '#9ca3af');
  let filter = 5;

  function actions(id, status) {
    const b = (st, label, bg) => status === st ? '' : `<button onclick="adminSetStatus('${esc(id)}','${st}')" style="padding:6px 10px;border:0;border-radius:8px;background:${bg};color:#fff;font-weight:800;font-size:11px;cursor:pointer">${label}</button>`;
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${b('flagged', '🚩 Flag', '#b45309')}${b('suspended', '⛔ Suspend', '#b91c1c')}${b('active', '✔ Clear', '#15803d')}</div>`;
  }

  async function load() {
    const box = document.getElementById('ratingsBody'); if (!box) return;
    box.innerHTML = '<p style="color:var(--muted)">Loading…</p>';
    try {
      const [sum, list] = await Promise.all([db.rpc('admin_rating_summary'), db.rpc('admin_list_ratings', { p_max_stars: filter, p_limit: 200 })]);
      if (sum.error) throw sum.error; if (list.error) throw list.error;
      const people = (sum.data || []).map(p => `<div style="padding:10px;background:var(--card3);border:1px solid var(--border2);border-radius:12px;margin-top:8px">
        <div style="display:flex;justify-content:space-between;gap:8px"><b style="word-break:break-all">${esc(p.email)}</b><span style="color:${color(p.status)};font-weight:900;font-size:11px">${esc(String(p.status).toUpperCase())}</span></div>
        <div style="font-size:12px;color:var(--muted)">${esc(p.role)} • avg <b style="color:#f59e0b">${Number(p.avg_stars).toFixed(2)}</b> • ${p.ratings_count} ratings • ${p.low_count} low (1-2★)</div>${actions(p.user_id, p.status)}</div>`).join('') || '<p style="color:var(--muted)">No ratings yet.</p>';
      const rows = (list.data || []).map(r => `<div style="padding:10px;background:var(--card3);border:1px solid var(--border2);border-radius:12px;margin-top:8px">
        <div style="display:flex;justify-content:space-between"><b style="color:#f59e0b">${stars(r.stars)}</b><span style="font-size:11px;color:var(--muted)">${new Date(r.created_at).toLocaleString()}</span></div>
        <div style="font-size:12px;margin-top:4px">${r.comment ? esc(r.comment) : '<i style="color:var(--muted)">No comment</i>'}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Order ${esc(r.order_number)} • ${esc(r.rater_role)} <b>${esc(r.rater_email)}</b> → ${esc(r.ratee_role)} <b>${esc(r.ratee_email)}</b> <span style="color:${color(r.ratee_status)}">(${esc(r.ratee_status)})</span></div>${actions(r.ratee_id, r.ratee_status)}</div>`).join('') || '<p style="color:var(--muted)">No ratings match this filter.</p>';
      box.innerHTML = `<div style="font-weight:900;margin:4px 0">Accounts (lowest average first)</div>${people}
        <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 4px"><b>Ratings &amp; comments</b>
        <select onchange="adminRatingsFilter(this.value)" style="padding:8px;border-radius:8px;background:var(--card3);color:var(--text);border:1px solid var(--border2)">
          <option value="5" ${filter === 5 ? 'selected' : ''}>All ratings</option><option value="2" ${filter === 2 ? 'selected' : ''}>Low only (1-2★)</option></select></div>${rows}`;
    } catch (e) { box.innerHTML = `<p style="color:#ef4444">Could not load ratings: ${esc(e.message)}. Did you run the 02 SQL file?</p>`; }
  }
  window.adminRatingsFilter = v => { filter = Number(v); load(); };
  window.adminSetStatus = async (id, status) => {
    const label = { flagged: 'flag', suspended: 'SUSPEND', active: 'clear' }[status];
    if (!confirm(`Are you sure you want to ${label} this account?`)) return;
    const note = status === 'active' ? '' : (prompt('Reason / note (optional):') || '');
    const { error } = await db.rpc('admin_set_account_status', { p_user_id: id, p_status: status, p_note: note });
    if (error) return alert(error.message);
    load();
  };
  window.loadAdminRatings = load;
  const orig = window.openAdminTab;
  if (typeof orig === 'function') window.openAdminTab = function (id, el) { orig(id, el); if (id === 'ratings') load(); };
})();
