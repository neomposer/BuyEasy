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
