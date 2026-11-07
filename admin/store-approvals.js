/* Admin-only store application review, backed by the approval RPC. */
(function(){
  'use strict';
  const db=window.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function renderStores(){
    const el=document.getElementById('storesList');if(!el)return;
    const count=document.getElementById('storesCount');
    try{
      if(!db)throw new Error('Supabase connection not found.');
      const {data,error}=await db.from('store_applications').select('id,user_id,store_name,owner_name,phone,address,status,created_at').order('created_at',{ascending:false});
      if(error)throw error;
      const rows=data||[];const pending=rows.filter(x=>x.status==='pending').length;
      if(count)count.textContent=`${pending} pending`;
      el.innerHTML=rows.length?rows.map(app=>`<div style="padding:12px;background:var(--card3);border:1px solid var(--border2);border-radius:12px;margin-top:8px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(app.store_name)}</b><span class="badge ${app.status==='approved'?'b-green':app.status==='rejected'?'b-red':'b-yellow'}">${esc(app.status).toUpperCase()}</span></div><div style="font-size:11px;color:var(--muted2);margin-top:6px">Owner: ${esc(app.owner_name)} • Phone: ${esc(app.phone)}<br>Address: ${esc(app.address)}<br>Applied: ${new Date(app.created_at).toLocaleString()}</div>${app.status==='pending'?`<div style="display:flex;gap:8px;margin-top:10px"><button class="pill" style="background:var(--green);color:#000;font-weight:800" onclick="reviewStoreApplication('${app.id}','approved')">Approve store</button><button class="pill" style="color:var(--red)" onclick="reviewStoreApplication('${app.id}','rejected')">Reject</button></div>`:''}</div>`).join(''):'<p style="color:var(--muted);font-size:12px">No store applications yet.</p>';
    }catch(error){console.error('Store applications could not load:',error);el.innerHTML=`<p style="color:#ef4444;font-size:12px">Could not load store applications: ${esc(error.message)}</p>`;}
  }
  async function reviewStoreApplication(id,decision){
    const label=decision==='approved'?'approve this store application':'reject this store application';
    if(!confirm(`Are you sure you want to ${label}?`))return;
    try{
      const {error}=await db.rpc('admin_review_store_application',{p_application_id:id,p_decision:decision});
      if(error)throw error;
      if(typeof window.proAlert==='function')window.proAlert('Updated',decision==='approved'?'Store approved. The applicant can switch between Buyer and Store dashboards.':'Application rejected.','success');
      else alert(decision==='approved'?'Store approved. The applicant can switch between Buyer and Store dashboards.':'Application rejected.');
      await renderStores();
      if(typeof window.renderUsers==='function')await window.renderUsers();
      if(typeof window.getStats==='function')await window.getStats();
    }catch(error){console.error('Store application review failed:',error);alert(error.message||'Could not review this application.');}
  }
  window.renderStores=renderStores;
  window.reviewStoreApplication=reviewStoreApplication;
  // Keep the admin UI from using its old LocalStorage-only approval handler.
  window.approveStore=(id)=>reviewStoreApplication(id,'approved');
  window.rejectStoreApplication=(id)=>reviewStoreApplication(id,'rejected');
  renderStores();
})();
