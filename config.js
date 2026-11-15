/* BuyEasy business details used across the site. Change them here only. */
window.BUYEASY = {
  name: 'BuyEasy',
  area: 'Nkomazi, Mpumalanga',
  whatsapp: '27711511389',          // international format, no + or spaces
  whatsappDisplay: '071 151 1389',
  vapidPublicKey: 'BFDQLuQzo2e18ukJq4VvZPVLIE0LmoxaXmrKbuxQ58kv0MY-uLEMEvNon4A_gaxTn_dJHQcbMqfuNCPsrfbMv-Q',          // public key for push notifications (safe to be public)
  waLink: function (text) { return 'https://wa.me/' + this.whatsapp + (text ? '?text=' + encodeURIComponent(text) : ''); }
};
