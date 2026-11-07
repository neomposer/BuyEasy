// buyer/wallet-guard.js - LOCK Add Money until card linked - FIXED
window.getBuyerCards = function(){
  let email=''; try{ email=JSON.parse(localStorage.getItem('bhv2_session')||'{}').email||'buyer@test.com'; }catch{}
  if(!email) email='buyer@test.com';
  let all=[]; 
  let checkKeys = [
    'v2_cards_'+email, 'v2_saved_cards_'+email, 'bhv2_cards_'+email,
    'v2_cards_buyer@test.com', 'v2_buyer_cards_'+email, 'bhv2_cards'
  ];
  checkKeys.forEach(k=>{
    try{
      let v=JSON.parse(localStorage.getItem(k)||'[]');
      if(Array.isArray(v)) all.push(...v);
      else if(v && (v.last4||v.number||v.cardNumber)) all.push(v);
    }catch{}
  });
  for(let i=0;i<localStorage.length;i++){
    let k=localStorage.key(i);
    if(k && (k.startsWith('v2_cards_') || k.startsWith('bhv2_cards_') || k.startsWith('v2_saved_cards_'))){
      if(checkKeys.includes(k)) continue; // FIX: skip already-checked keys to avoid dupes
      try{ let arr=JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(arr)) all.push(...arr.filter(Boolean)); }catch{}
    }
  }
  // FIX: dedupe same card
  let seen={};
  return all.filter(c=>{
    if(!c) return false;
    if(!(c.number || c.last4 || c.cardNumber || c.brand)) return false;
    let id = String(c.last4||'') + '_' + String(c.number||c.cardNumber||'').slice(-4);
    if(seen[id]) return false;
    seen[id]=1;
    return true;
  });
};

window.updateAddMoneyButton = function(){
  let btns = [...document.querySelectorAll('button')];
  let addBtn = btns.find(b=> b.innerText.trim().toLowerCase().includes('add money') || b.innerText.includes('Link Card'));
  if(!addBtn){
    let walletSec = document.querySelector('[id*="wallet"]') || document.body;
    addBtn = walletSec.querySelector('button');
  }
  if(!addBtn) return;

  let cards = window.getBuyerCards();
  let hasCard = cards.length > 0;
  let savedCardsDiv = [...document.querySelectorAll('div')].find(d=>d.textContent.trim()==='Saved Cards');

  if(!hasCard){
    addBtn.disabled = false;
    addBtn.style.background = '#222';
    addBtn.style.color = '#888';
    addBtn.style.border = '1px dashed #444';
    addBtn.innerHTML = '🔒 Link Card First to Add Money';
    addBtn.onclick = (e)=>{
      e.preventDefault();
      alert('🔒 You must link a card first!\n\n1. Scroll to Saved Cards\n2. Click + Add Card\n3. Then you can Add Money');
      if(savedCardsDiv){
        savedCardsDiv.scrollIntoView({behavior:'smooth'});
      }
      if(window.openAddCard) window.openAddCard();
      if(window.showAddCardModal) window.showAddCardModal();
      if(document.getElementById('addCardBtn')) document.getElementById('addCardBtn').click();
    };
  } else {
    addBtn.disabled = false;
    addBtn.style.background = '#fff';
    addBtn.style.color = '#000';
    addBtn.style.border = 'none';
    let last4 = cards[0].last4 || (cards[0].number||cards[0].cardNumber||'').slice(-4) || '****';
    addBtn.innerHTML = 'Add Money • Card *'+last4+' ✓';
    addBtn.onclick = ()=>{
      if(window.openAddMoneyModal) return window.openAddMoneyModal();
      let amt = prompt('Add how much? (Card *'+last4+')\n\nEnter amount: e.g. 100');
      if(!amt || isNaN(amt)) return;
      let sessEmail='buyer@test.com'; try{ sessEmail=JSON.parse(localStorage.getItem('bhv2_session')||'{}').email||'buyer@test.com'; }catch{}
      let balKey = 'v2_wallet_'+sessEmail;
      let cur = Number(localStorage.getItem(balKey)||50);
      cur += Number(amt);
      localStorage.setItem(balKey, cur);
      alert('✅ R'+amt+' added! New balance R'+cur.toFixed(2));
      location.reload();
    };
  }
  console.log('[Wallet Guard] hasCard:', hasCard, 'cards:', cards.length);
};

// HARD LOCK topUp so it can't bypass button
(function(){
  const _origTopUp = window.topUp;
  window.topUp = function(){
    let cards = []; try{ cards = window.getBuyerCards(); }catch(e){ cards=[]; }
    if(cards.length===0){
      alert('🔒 BLOCKED! Cannot add money without linked card.');
      return false;
    }
    if(_origTopUp && _origTopUp!==window.topUp) return _origTopUp.apply(this, arguments);
  };
  window.addMoney = window.topUp;
})();

document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(window.updateAddMoneyButton, 800);
  setInterval(window.updateAddMoneyButton, 3000);
});