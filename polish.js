/* BuyEasy dashboard polish helpers: friendly empty states and loading placeholders. */
(function () {
  'use strict';
  window.beEmpty = function (icon, title, text, btnLabel, btnOnclick) {
    return '<div class="be-empty"><div class="ico">' + icon + '</div><b>' + title + '</b><p>' + text + '</p>' +
      (btnLabel ? '<button type="button" onclick="' + btnOnclick + '">' + btnLabel + '</button>' : '') + '</div>';
  };
  window.beSkeleton = function (n) { return '<div class="be-skel">' + '<i></i>'.repeat(n || 2) + '</div>'; };

  // Turn the bottom-nav labels into "icon over label" (emoji + word) once the page has loaded.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.bnav-tab').forEach(function (t) {
      if (t.querySelector('.ic')) return;
      var node = t.firstChild; if (!node || node.nodeType !== 3) return;
      var m = node.textContent.trim().match(/^(\S+)\s+(.+)$/); if (!m) return;
      var ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = m[1];
      var lb = document.createElement('span'); lb.className = 'lb'; lb.textContent = m[2];
      t.replaceChild(lb, node); t.insertBefore(ic, lb);
    });
  });
})();

/* Collapsible order cards (buyer, store, rider): every order starts minimized and opens on tap.
   The open/closed state is remembered while the list refreshes. */
(function () {
  'use strict';
  const open = new Set();
  try { JSON.parse(sessionStorage.getItem('be_oc') || '[]').forEach(x => open.add(String(x))); } catch (e) {}
  window.beCard = { isOpen: id => open.has(String(id)), cls: id => open.has(String(id)) ? ' open' : '' };
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-oc-toggle]'); if (!t) return;
    if (e.target.closest('a,button,input,select,textarea,[data-oc-stop]')) return;
    const card = t.closest('.oc'); if (!card) return;
    const id = String(card.dataset.oc || ''), isOpen = card.classList.toggle('open');
    if (id) { if (isOpen) open.add(id); else open.delete(id); try { sessionStorage.setItem('be_oc', JSON.stringify([...open].slice(-80))); } catch (err) {} }
  });
})();
