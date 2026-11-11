/* BUYEasy - "Customer support" and "Rate us" buttons at the top of the profile tab.
   BuyEasyHelp.mount('settings', 'buyer')   // section id, role of this dashboard */
(function () {
  'use strict';
  const db = window.supabaseClient; if (!db) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let role = 'buyer', modal = null, rate = 0, category = '';
  const CATS = ['Speed', 'Orders', 'Payments', 'Delivery', 'Design', 'Other'];

  function css() {
    if (document.getElementById('beHelpCss')) return;
    const s = document.createElement('style'); s.id = 'beHelpCss';
    s.textContent = `.be-help{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.be-help button{padding:14px 10px;border-radius:14px;border:1px solid #2b2b2b;background:#141414;color:#fff;font:800 13px Inter,system-ui,sans-serif;cursor:pointer}
.be-help button:first-child{background:#22c55e;color:#04210f;border-color:#22c55e}
#beHelpModal{position:fixed;inset:0;z-index:2147482500;background:rgba(0,0,0,.78);display:none;align-items:flex-end;justify-content:center;font-family:Inter,system-ui,sans-serif}
.beh-sheet{background:#141414;color:#fff;width:min(100%,520px);max-height:90vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px;box-sizing:border-box}
.beh-sheet input,.beh-sheet textarea{width:100%;box-sizing:border-box;margin-top:8px;padding:11px;border-radius:10px;border:1px solid #333;background:#0e0e0e;color:#fff;font:13px Inter,system-ui,sans-serif}
.beh-sheet textarea{min-height:96px}
.beh-row{display:flex;gap:8px;margin-top:12px}.beh-row button,.beh-x{padding:12px;border:0;border-radius:12px;font-weight:800;cursor:pointer;flex:1}
.beh-go{background:#22c55e;color:#04210f}.beh-x{background:#262626;color:#fff;flex:0 0 auto;padding:8px 12px}
.beh-stars{display:flex;gap:6px;margin:10px 0}.beh-stars button{flex:1;font-size:26px;padding:6px 0;border:1px solid #333;border-radius:10px;background:#0e0e0e;color:#555;cursor:pointer}
.beh-stars button.on{color:#f59e0b;border-color:#f59e0b}
.beh-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.beh-chips button{padding:8px 12px;border-radius:999px;border:1px solid #333;background:#0e0e0e;color:#ddd;font-weight:700;font-size:12px;cursor:pointer}
.beh-chips button.on{background:#22c55e;color:#04210f;border-color:#22c55e}
.beh-tk{background:#1c1c1c;border:1px solid #2b2b2b;border-radius:14px;padding:12px;margin-top:10px;font-size:13px}
.beh-reply{margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(34,197,94,.12);color:#b9f3cd}`;
    document.head.appendChild(s);
  }
  function ensure() {
    if (modal) return; css();
    modal = document.createElement('div'); modal.id = 'beHelpModal';
    modal.addEventListener('click', e => { if (e.target === modal) hide(); });
    document.body.appendChild(modal);
  }
  const hide = () => { if (modal) modal.style.display = 'none'; };
  const show = html => { ensure(); modal.innerHTML = `<div class="beh-sheet">${html}</div>`; modal.style.display = 'flex'; };

  /* ---------- customer support ---------- */
  function support() {
    show(`<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px">💬 Customer support</b><button class="beh-x" id="bhX">Close</button></div>
      <p style="color:#9a9a9a;font-size:12px;margin:6px 0 0">Tell us what went wrong. A BuyEasy admin will reply here.</p>
      <input id="bhSub" maxlength="120" placeholder="Subject (e.g. Problem with my order)">
      <textarea id="bhMsg" maxlength="2000" placeholder="Describe the problem. Include the order number if you have one."></textarea>
      <div class="beh-row"><button class="beh-go" id="bhSend">Send message</button></div>
      ${window.BUYEASY ? `<a href="${window.BUYEASY.waLink('Hi BuyEasy support, I need help with my account.')}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:10px;padding:12px;border-radius:12px;background:#25D366;color:#04210f;font-weight:800;text-decoration:none">💬 Chat on WhatsApp (${window.BUYEASY.whatsappDisplay})</a>` : ''}
      <div style="font-weight:900;margin-top:18px">My messages</div><div id="bhList"><p style="color:#9a9a9a;font-size:12px">Loading…</p></div>`);
    modal.querySelector('#bhX').onclick = hide;
    modal.querySelector('#bhSend').onclick = async () => {
      const subject = modal.querySelector('#bhSub').value.trim(), message = modal.querySelector('#bhMsg').value.trim();
      if (subject.length < 3 || message.length < 5) return alert('Please add a subject and a short message.');
      const b = modal.querySelector('#bhSend'); b.disabled = true;
      const { error } = await db.rpc('support_create_ticket', { p_subject: subject, p_message: message });
      b.disabled = false;
      if (error) return alert(error.message);
      modal.querySelector('#bhSub').value = ''; modal.querySelector('#bhMsg').value = '';
      alert('Message sent. We will reply here.'); loadTickets();
    };
    loadTickets();
  }
  async function loadTickets() {
    const box = modal && modal.querySelector('#bhList'); if (!box) return;
    const { data, error } = await db.rpc('support_my_tickets');
    if (error) { box.innerHTML = `<p style="color:#ef4444;font-size:12px">${esc(error.message)}</p>`; return; }
    box.innerHTML = (data || []).length ? data.map(t => `<div class="beh-tk"><b>${esc(t.subject)}</b>
      <span style="float:right;font-size:11px;color:${t.status === 'open' ? '#f59e0b' : '#22c55e'}">${t.status === 'open' ? 'Open' : 'Resolved'}</span>
      <div style="color:#bbb;margin-top:4px">${esc(t.message)}</div>
      ${t.admin_reply ? `<div class="beh-reply"><b>BuyEasy support:</b> ${esc(t.admin_reply)}</div>` : ''}
      <div style="font-size:11px;color:#777;margin-top:6px">${new Date(t.created_at).toLocaleString()}</div></div>`).join('')
      : '<p style="color:#9a9a9a;font-size:12px">No messages yet.</p>';
  }

  /* ---------- rate us ---------- */
  function rateUs() {
    rate = 0; category = '';
    show(`<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px">⭐ Rate BuyEasy</b><button class="beh-x" id="bhX">Close</button></div>
      <p style="color:#9a9a9a;font-size:12px;margin:6px 0 0">How are we doing? Tell us what to improve for your needs.</p>
      <div class="beh-stars">${[1, 2, 3, 4, 5].map(n => `<button data-s="${n}">★</button>`).join('')}</div>
      <div style="font-size:12px;color:#9a9a9a">What is it about?</div>
      <div class="beh-chips">${CATS.map(c => `<button data-c="${c}">${c}</button>`).join('')}</div>
      <textarea id="bhFb" maxlength="1000" placeholder="What should we improve? What do you need from BuyEasy?"></textarea>
      <div class="beh-row"><button class="beh-go" id="bhSendFb">Send feedback</button></div>`);
    modal.querySelector('#bhX').onclick = hide;
    modal.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { rate = Number(b.dataset.s); modal.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', Number(x.dataset.s) <= rate)); });
    modal.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { category = b.dataset.c; modal.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
    modal.querySelector('#bhSendFb').onclick = async () => {
      if (!rate) return alert('Tap 1 to 5 stars first.');
      const b = modal.querySelector('#bhSendFb'); b.disabled = true;
      const { error } = await db.rpc('submit_feedback', { p_rating: rate, p_category: category, p_message: modal.querySelector('#bhFb').value, p_role: role });
      b.disabled = false;
      if (error) return alert(error.message);
      hide(); alert('Thank you! Your feedback helps us improve BuyEasy.');
    };
  }

  function mount(sectionId, r) {
    role = r || role;
    const sec = document.getElementById(sectionId); if (!sec || sec.querySelector('.be-help')) return;
    css();
    const box = document.createElement('div'); box.className = 'be-help';
    box.innerHTML = '<button type="button" data-h="support">💬 Customer support</button><button type="button" data-h="rate">⭐ Rate us</button>';
    box.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (!b) return; (b.dataset.h === 'support' ? support : rateUs)(); });
    sec.insertBefore(box, sec.firstChild);
  }
  window.BuyEasyHelp = { mount, support, rateUs };
})();
