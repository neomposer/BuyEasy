/* BuyEasy business details used across the site. Change them here only. */
window.BUYEASY = {
  name: 'BuyEasy',
  area: 'Nkomazi, Mpumalanga',
  whatsapp: '27711511389',          // international format, no + or spaces
  whatsappDisplay: '071 151 1389',
  waLink: function (text) { return 'https://wa.me/' + this.whatsapp + (text ? '?text=' + encodeURIComponent(text) : ''); }
};
