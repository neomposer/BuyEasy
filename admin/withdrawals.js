window.AdminWithdrawals = {
  render(){
    let all=[]; for(let i=0;i<localStorage.length;i++){ let k=localStorage.key(i); if(k.startsWith('v2_withdraw_')){ let email=k.replace('v2_withdraw_',''); let arr=JSON.parse(localStorage.getItem(k)||'[]'); arr.forEach(w=>all.push({...w, email})); } }
    let el=document.getElementById('adminWithdrawList'); if(!el) return;
    el.innerHTML=all.length?all.map(w=>`<div style="padding:10px;background:#111;border-radius:10px;margin-top:8px;border:1px solid #222"><b>${w.email}</b> • R${w.amount} • ${w.method||''} ${w.acc||''}<br><span style="font-size:10px;color:#666">${w.date} • ${w.status}</span> <button onclick="AdminWithdrawals.approve('${w.email}','${w.date}')" style="margin-left:8px;padding:4px 8px;border-radius:6px;border:none;background:#22c55e;color:#111;font-size:10px;font-weight:800">Approve</button></div>`).join(''):'No withdrawals';
  },
  approve(email, date){
    let key='v2_withdraw_'+email; let arr=JSON.parse(localStorage.getItem(key)||'[]'); let idx=arr.findIndex(w=>w.date==date); if(idx>-1){ arr[idx].status='Approved'; localStorage.setItem(key, JSON.stringify(arr)); let logs=JSON.parse(localStorage.getItem('bhv2_admin_audit')||'[]'); logs.unshift({action:'withdraw_approved', actor:JSON.parse(localStorage.getItem('bhv2_admin_session')||'{}').email||'admin', details:`Approved R${arr[idx].amount} for ${email}`, date:new Date().toLocaleString(), ts:Date.now()}); localStorage.setItem('bhv2_admin_audit', JSON.stringify(logs)); window.AdminUtils.done('Withdrawal approved'); this.render(); }
  }
};