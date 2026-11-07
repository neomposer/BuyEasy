window.AdminStores = {
  render(){
    let stores=[]; for(let i=0;i<localStorage.length;i++){ let k=localStorage.key(i); if(k.startsWith('v2_profile_')){ let p=JSON.parse(localStorage.getItem(k)||'{}'); if(p.storeName) stores.push({email:k.replace('v2_profile_',''), ...p}); } }
    let el=document.getElementById('adminStoresList'); if(!el) return;
    el.innerHTML=stores.length?stores.map(s=>`<div style="padding:10px;background:#111;border-radius:10px;margin-top:8px;border:1px solid #222"><b>${s.storeName}</b> • ${s.email}<br><span style="font-size:10px;color:#666">${s.storeAddress||''} • ${s.storeLat||''},${s.storeLng||''}</span><br><span style="font-size:10px;color:${s.approved?'#22c55e':'#eab308'}">${s.approved?'Approved':'Pending'}</span> <button onclick="AdminStores.approve('${s.email}')" style="margin-left:8px;padding:4px 8px;border-radius:6px;border:none;background:#fff;color:#111;font-size:10px;font-weight:800;cursor:pointer">Approve</button></div>`).join(''):'No stores';
  },
  approve(email){
    let p=JSON.parse(localStorage.getItem('v2_profile_'+email)||'{}'); p.approved=true; localStorage.setItem('v2_profile_'+email, JSON.stringify(p));
    let logs=JSON.parse(localStorage.getItem('bhv2_admin_audit')||'[]'); logs.unshift({action:'store_approved', actor:JSON.parse(localStorage.getItem('bhv2_admin_session')||'{}').email||'admin', details:`Approved store ${email}`, date:new Date().toLocaleString(), ts:Date.now()}); localStorage.setItem('bhv2_admin_audit', JSON.stringify(logs));
    window.AdminUtils.done('Store approved'); this.render();
  }
};