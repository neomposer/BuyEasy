window.RiderMoney = {
  render(){
    let earn=JSON.parse(localStorage.getItem('v2_rider_earnings_'+window.RiderAuth.email)||'[]');
    let bal=localStorage.getItem('v2_balance_'+window.RiderAuth.email)||'0';
    document.getElementById('balanceTop').textContent='R'+parseFloat(bal).toFixed(2);
    document.getElementById('wallet').textContent='R'+parseFloat(bal).toFixed(2);
    document.getElementById('earnHist').innerHTML=earn.length?earn.map(e=>`<div class="hist-item hist-earn"><div><span class="hist-badge badge-earn">🟢 NET R${e.amount}</span><div style="margin-top:6px">Gross R${e.gross} - Admin R${e.adminFee} = 15% / R1.50</div><div style="font-size:10px;color:#777">${e.date}</div></div></div>`).join(''):'<p style="font-size:11px;color:#888">No earnings</p>';
  }
};