// store/money.js - Wallet
function requestWithdraw(){
  let email = localStorage.getItem('v2_email');
  let profile = JSON.parse(localStorage.getItem('v2_profile_'+email)||'{}');
  if(!profile.acc){
    alert('First save your payout details in Settings tab');
    return;
  }
  showDone('Withdrawal request sent: R0.00 to '+profile.bank+' • '+profile.acc);
}