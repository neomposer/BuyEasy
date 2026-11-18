/* BuyEasy UI kit: professional pop-ups used everywhere in the app.
   BuyEasyUI.toast(text, 'ok'|'error'|'info')
   await BuyEasyUI.confirm(text, {title, okLabel, cancelLabel, danger})  -> true / false
   await BuyEasyUI.prompt(text, defaultValue, {title, placeholder, okLabel}) -> string | null
   BuyEasyUI.sheet({title, subtitle, items:[{icon,label,desc,danger,onClick}]})  (bottom action menu)
   const p = BuyEasyUI.progress('Compressing video…'); p.update('Compressing… 40%'); p.done();
   The old alert() is replaced so every message looks the same. */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function css() {
    if (document.getElementById('beUiCss')) return;
    const s = document.createElement('style'); s.id = 'beUiCss';
    s.textContent = `
#beToasts{position:fixed;left:0;right:0;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:2147483200;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 14px;pointer-events:none;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
.beu-toast{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;max-width:460px;width:100%;box-sizing:border-box;padding:13px 15px;border-radius:16px;background:var(--card,#161616);color:var(--text,#f3f3f3);border:1px solid var(--border,#2a2a2a);border-left:4px solid var(--c,#3b82f6);box-shadow:0 14px 36px rgba(0,0,0,.45);font-size:13.5px;line-height:1.45;animation:beuIn .22s ease}
.beu-toast i{font-style:normal;font-size:18px;line-height:1.2}.beu-toast.ok{--c:#22c55e}.beu-toast.error{--c:#ef4444}.beu-toast.info{--c:#3b82f6}
@keyframes beuIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
#beuLayer{position:fixed;inset:0;z-index:2147483300;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);padding:18px;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
#beuLayer.show{display:flex}#beuLayer.bottom{align-items:flex-end;padding:0}
.beu-box{width:min(100%,420px);background:var(--card,#161616);color:var(--text,#f3f3f3);border:1px solid var(--border,#2a2a2a);border-radius:22px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.55);animation:beuPop .2s ease}
.bottom .beu-box{width:min(100%,520px);border-radius:24px 24px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));animation:beuUp .25s ease}
@keyframes beuPop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}@keyframes beuUp{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
.beu-ico{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;font-size:25px;margin-bottom:12px;background:rgba(34,197,94,.14)}
.beu-ico.danger{background:rgba(239,68,68,.15)}.beu-ico.warn{background:rgba(245,158,11,.15)}
.beu-box h3{margin:0 0 6px;font-size:18px;font-weight:900;letter-spacing:-.3px}.beu-box p{margin:0;font-size:14px;line-height:1.55;color:var(--muted,#a1a1aa);white-space:pre-line}
.beu-box input{width:100%;box-sizing:border-box;margin-top:14px;padding:13px 14px;border-radius:12px;border:1.5px solid var(--border,#2a2a2a);background:var(--card3,#0f0f0f);color:var(--text,#f3f3f3);font:15px Inter,system-ui,sans-serif}
.beu-box input:focus{outline:none;border-color:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.16)}
.beu-row{display:flex;gap:10px;margin-top:20px}.beu-row button{flex:1;min-height:48px;border-radius:14px;border:0;font-weight:900;font-size:14px;cursor:pointer}
.beu-ok{background:linear-gradient(180deg,#2bd36b,#1fb257);color:#052e16}.beu-ok.danger{background:#dc2626;color:#fff}.beu-cancel{background:var(--card3,#222);color:var(--text,#f3f3f3);border:1px solid var(--border,#2a2a2a)!important}
.beu-sheet-h{display:flex;align-items:center;gap:12px;padding:2px 4px 12px;border-bottom:1px solid var(--border,#2a2a2a);margin-bottom:8px}
.beu-sheet-h b{display:block;font-size:16px}.beu-sheet-h span{font-size:12.5px;color:var(--muted,#a1a1aa)}
.beu-item{display:flex;gap:14px;align-items:center;width:100%;text-align:left;padding:14px 10px;border:0;border-radius:14px;background:transparent;color:var(--text,#f3f3f3);cursor:pointer;font:inherit}
.beu-item:hover,.beu-item:active{background:var(--card3,#222)}.beu-item .ic{flex:0 0 42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:20px;background:var(--card3,#222)}
.beu-item b{display:block;font-size:15px;font-weight:800}.beu-item small{display:block;margin-top:2px;color:var(--muted,#a1a1aa);font-size:12.5px;line-height:1.4}
.beu-item.danger b{color:#f87171}.beu-item.danger .ic{background:rgba(239,68,68,.14)}
.beu-spin{width:44px;height:44px;border-radius:50%;border:4px solid rgba(34,197,94,.2);border-top-color:#22c55e;animation:beuSpin .9s linear infinite;margin:0 auto 14px}@keyframes beuSpin{to{transform:rotate(360deg)}}
.beu-prog{text-align:center}.beu-bar{height:8px;border-radius:6px;background:var(--card3,#222);overflow:hidden;margin-top:14px}.beu-bar div{height:100%;width:0;background:#22c55e;transition:width .3s}`;
    document.head.appendChild(s);
  }
  let toasts = null, layer = null;
  function ensure() {
    css();
    if (!toasts) { toasts = document.createElement('div'); toasts.id = 'beToasts'; (document.body || document.documentElement).appendChild(toasts); }
    if (!layer) { layer = document.createElement('div'); layer.id = 'beuLayer'; (document.body || document.documentElement).appendChild(layer); }
  }
  const classify = t => /could not|couldn't|failed|error|invalid|cannot|can't|not allowed|too low|exceeds|unable|denied|blocked|required|not available|no longer/i.test(t) ? 'error'
    : /^(thank|saved|done|sent|order placed|request sent|promotion|updated|approved|alerts are on|welcome|✔|✅)/i.test(String(t).trim()) ? 'ok' : 'info';

  function toast(text, type) {
    ensure(); type = type || classify(text);
    const el = document.createElement('div'); el.className = 'beu-toast ' + type;
    el.innerHTML = `<i>${{ ok: '✅', error: '⚠️', info: 'ℹ️' }[type]}</i><div>${esc(text)}</div>`;
    toasts.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, Math.min(9000, 3200 + String(text).length * 35));
    el.addEventListener('click', () => el.remove());
  }

  function open(html, bottom) { ensure(); layer.className = 'show' + (bottom ? ' bottom' : ''); layer.innerHTML = html; return layer; }
  function close() { if (layer) { layer.className = ''; layer.innerHTML = ''; } }

  function dialog(text, opts) {                       // long messages
    return new Promise(res => {
      opts = opts || {};
      const L = open(`<div class="beu-box" role="alertdialog"><div class="beu-ico ${opts.danger ? 'danger' : ''}">${opts.icon || 'ℹ️'}</div><h3>${esc(opts.title || 'BuyEasy')}</h3><p>${esc(text)}</p>
        <div class="beu-row"><button class="beu-ok" data-r="1">${esc(opts.okLabel || 'OK')}</button></div></div>`);
      L.querySelector('[data-r]').onclick = () => { close(); res(); };
    });
  }
  function confirmBox(text, opts) {
    opts = opts || {};
    return new Promise(res => {
      const L = open(`<div class="beu-box" role="alertdialog"><div class="beu-ico ${opts.danger ? 'danger' : 'warn'}">${opts.icon || (opts.danger ? '🗑️' : '❓')}</div><h3>${esc(opts.title || 'Please confirm')}</h3><p>${esc(text)}</p>
        <div class="beu-row"><button class="beu-cancel" data-r="0">${esc(opts.cancelLabel || 'Cancel')}</button><button class="beu-ok ${opts.danger ? 'danger' : ''}" data-r="1">${esc(opts.okLabel || 'Yes, continue')}</button></div></div>`);
      L.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { close(); res(b.dataset.r === '1'); });
    });
  }
  function promptBox(text, value, opts) {
    opts = opts || {};
    return new Promise(res => {
      const L = open(`<div class="beu-box" role="dialog"><div class="beu-ico">✏️</div><h3>${esc(opts.title || 'BuyEasy')}</h3><p>${esc(text)}</p>
        <input id="beuIn" value="${esc(value || '')}" placeholder="${esc(opts.placeholder || '')}" autocomplete="off">
        <div class="beu-row"><button class="beu-cancel" data-r="0">Cancel</button><button class="beu-ok" data-r="1">${esc(opts.okLabel || 'Save')}</button></div></div>`);
      const inp = L.querySelector('#beuIn'); setTimeout(() => { inp.focus(); inp.select(); }, 60);
      const done = ok => { const v = inp.value; close(); res(ok ? v : null); };
      L.querySelectorAll('[data-r]').forEach(b => b.onclick = () => done(b.dataset.r === '1'));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    });
  }
  function sheet(o) {
    o = o || {};
    const L = open(`<div class="beu-box" role="menu"><div class="beu-sheet-h"><div style="flex:1"><b>${esc(o.title || '')}</b>${o.subtitle ? `<span>${esc(o.subtitle)}</span>` : ''}</div><button class="beu-cancel" data-x style="padding:9px 14px;border-radius:12px;border:0;font-weight:800;cursor:pointer">Close</button></div>
      ${(o.items || []).map((it, i) => `<button class="beu-item ${it.danger ? 'danger' : ''}" data-i="${i}"><span class="ic">${it.icon || '•'}</span><span><b>${esc(it.label)}</b>${it.desc ? `<small>${esc(it.desc)}</small>` : ''}</span></button>`).join('')}</div>`, true);
    L.querySelector('[data-x]').onclick = close;
    L.onclick = e => { if (e.target === L) close(); };
    L.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const it = o.items[Number(b.dataset.i)]; close(); if (it && it.onClick) it.onClick(); });
  }
  function progress(text) {
    const L = open(`<div class="beu-box beu-prog"><div class="beu-spin"></div><h3 id="beuPT">${esc(text || 'Working…')}</h3><p id="beuPS"></p><div class="beu-bar"><div id="beuPB"></div></div></div>`);
    return {
      update(t, pct, sub) { const a = L.querySelector('#beuPT'), b = L.querySelector('#beuPB'), c = L.querySelector('#beuPS'); if (a && t) a.textContent = t; if (b && pct != null) b.style.width = Math.max(2, Math.min(100, pct)) + '%'; if (c && sub != null) c.textContent = sub; },
      done() { close(); }
    };
  }
  const BuyEasyUI = {
    toast,
    alert: (t, o) => (String(t).length > 150 || (o && o.dialog)) ? dialog(String(t), o) : (toast(String(t)), Promise.resolve()),
    confirm: confirmBox, prompt: promptBox, sheet, progress, close
  };
  window.BuyEasyUI = BuyEasyUI;
  window.alert = msg => { BuyEasyUI.alert(String(msg ?? '')); };    // every old alert now looks professional
})();
