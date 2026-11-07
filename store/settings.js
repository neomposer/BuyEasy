// Load existing
let email = localStorage.getItem('v2_email');
function loadProfile(){
  let p = JSON.parse(localStorage.getItem('v2_profile_'+email)||'{}');
  if(document.getElementById('s_name')){
    document.getElementById('s_name').value = p.storeName||'';
    document.getElementById('s_owner').value = p.owner||'';
    document.getElementById('s_phone').value = p.phone||'';
    document.getElementById('s_bank').value = p.bank||'Capitec';
    document.getElementById('s_acc').value = p.acc||'';
    document.getElementById('s_holder').value = p.holder||'';
    document.getElementById('storeName').textContent = p.storeName||'My Store';
    document.getElementById('avatar').textContent = (p.storeName||'S')[0].toUpperCase();
  }
}
function saveProfile(){
  let data = {
    storeName: document.getElementById('s_name').value,
    owner: document.getElementById('s_owner').value,
    phone: document.getElementById('s_phone').value
  };
  let old = JSON.parse(localStorage.getItem('v2_profile_'+email)||'{}');
  localStorage.setItem('v2_profile_'+email, JSON.stringify({...old, ...data}));
  showDone('Store profile saved: '+data.storeName);
  loadProfile();
}
function savePayout(){
  let acc = document.getElementById('s_acc').value.trim();
  if(!acc) return alert('Enter account number');
  let data = {
    bank: document.getElementById('s_bank').value,
    acc: acc,
    holder: document.getElementById('s_holder').value
  };
  let old = JSON.parse(localStorage.getItem('v2_profile_'+email)||'{}');
  localStorage.setItem('v2_profile_'+email, JSON.stringify({...old, ...data}));
  showDone('Payout saved • '+data.bank+' • '+acc);
}
loadProfile();