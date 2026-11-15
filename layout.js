/* BuyEasy layout: slim top bar. The profile card lives inside the Settings tab only.
   The Online/Offline switch (store, rider) stays in the top bar so it is always reachable. */
(function () {
  'use strict';
  function run() {
    var settings = document.getElementById('settings'), hdr = document.getElementById('topHeader');
    var bar = document.getElementById('brandHeader'), online = document.getElementById('onlineIcon');
    if (online && bar) { var right = bar.lastElementChild || bar; right.insertBefore(online, right.firstChild); online.classList.add('in-bar'); }
    if (hdr && settings && hdr.parentNode !== settings) {
      var help = settings.querySelector('.be-help');
      if (help && help.nextSibling) settings.insertBefore(hdr, help.nextSibling); else settings.insertBefore(hdr, settings.firstChild);
      hdr.classList.add('in-settings');
    }
  }
  document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 120); setTimeout(run, 900); });
})();
