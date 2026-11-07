// rider/deliveries.js - Phase 4 - Rider picks + delivers = earns
function getRiderEmail(){
  try{ return JSON.parse(localStorage.getItem('bhv2_session')||'{}').email || ''; }catch{ return ''; }
}

function renderRiderJobs(){
  let riderEmail = getRiderEmail();
  let el = document.getElementById('riderJobs') || document.getElementById('jobs') || document.getElementById('deliveries') || document.getElementById('availableJobs');
  if(!el){ setTimeout(renderRiderJobs, 800); return; }

  // Get all jobs - both keys for compatibility
  let allJobs = [];
  try{ allJobs = JSON.parse(localStorage.getItem('v2_rider_jobs')||'[]'); }catch{}
  // Also check per-rider jobs
  let perRider = [];
  try{ perRider = JSON.parse(localStorage.getItem('v2_rider_jobs_'+riderEmail)||'[]'); }catch{}
  if(perRider.length) allJobs = perRider;

  // If still empty, build from store orders that are incoming
  if(!allJobs.length){
    for(let i=0;i<localStorage.length;i++){
      let k=localStorage.key(i);
      if(k.startsWith('v2_orders_')){
        try{
          let orders=JSON.parse(localStorage.getItem(k)||'[]');
          orders.forEach(o=>{
            if(o.status==='incoming' || o.status==='pending'){
              allJobs.push({...o, _fromStore:k});
            }
          });
        }catch{}
      }
    }
  }

  // Filter active
  let active = allJobs.filter(j=> j.status!=='delivered' && j.status!=='history' && j.status!=='completed');

  if(!active.length){
    el.innerHTML='<p style="padding:20px;text-align:center">No jobs available. Wait for buyer checkout (delivery MIN R10).</p>';
    return;
  }

  let html='';
  active.slice().reverse().forEach(job=>{
    let deliveryCalc;
    try{ deliveryCalc = FLOW.calculateRiderFee(job); }catch{ deliveryCalc={total:10, riderNet:10, riderAdminFee:0, breakdown:{distanceKm:0, base:10, distanceFee:0, weatherLabel:'Clear', surgeLabel:'Off-peak'}}; }
    
    let statusBadge = job.status==='incoming' ? '<span style="background:green;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">AVAILABLE</span>' :
                      job.status==='picked_by_rider' ? '<span style="background:blue;color:#fff;padding:2px 8px;border-radius:10px">YOU PICKED</span>' :
                      `<span style="background:#ddd;padding:2px 8px;border-radius:10px">${job.status}</span>`;

    html+=`<div style="border:1px solid #ddd;padding:12px;margin:10px 0;border-radius:12px;background:#fff">
      <div style="display:flex;justify-content:space-between"><b>Job #${job.id}</b> ${statusBadge}</div>
      <div style="font-size:13px;margin:6px 0">Store: ${job.storeName||job.storeEmail}<br>Customer: ${job.customer||job.buyerEmail} ${job.phone||''}<br>Addr: ${job.address||''}<br>Items: ${job.itemsText||job.items||''}</div>
      <div style="font-size:13px;background:#f6f6f6;padding:8px;border-radius:8px">
        Delivery Fee: <b>R${deliveryCalc.total.toFixed(2)}</b> (MIN R10)<br>
        You Get: <b style="color:green">R${deliveryCalc.riderNet.toFixed(2)}</b> — Platform share R${deliveryCalc.riderAdminFee.toFixed(2)} (your delivery pay stays at least R10)<br>
        <span style="font-size:11px;color:#666">Dist ${deliveryCalc.breakdown.distanceKm}km Base R${deliveryCalc.breakdown.base} + Dist R${deliveryCalc.breakdown.distanceFee.toFixed(2)} + ${deliveryCalc.breakdown.weatherLabel} + ${deliveryCalc.breakdown.surgeLabel} | Raw R${deliveryCalc.breakdown.raw||deliveryCalc.total}</span><br>
        Product: R${job.productTotal||job.total} — Store gets 90%, Admin 10% or R1.50
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        ${job.status==='incoming' || job.status==='pending' ? `<button onclick="pickJob(${job.id})" style="flex:1;padding:10px;background:#222;color:#fff;border:none;border-radius:10px">🏍️ Pick Job</button>` : ''}
        ${job.status==='picked_by_rider' || job.status==='on_the_way' ? `<button onclick="deliverJob(${job.id}, '${job.storeEmail}')" style="flex:1;padding:12px;background:#000;color:#fff;border:none;border-radius:10px;font-weight:bold">✅ Delivered — Earn R${deliveryCalc.riderNet.toFixed(2)}</button>` : ''}
      </div>
    </div>`;
  });

  el.innerHTML=html;
}

function pickJob(orderId){
  let riderEmail = getRiderEmail();
  // Update store order status
  for(let i=0;i<localStorage.length;i++){
    let k=localStorage.key(i);
    if(k.startsWith('v2_orders_')){
      try{
        let orders=JSON.parse(localStorage.getItem(k)||'[]');
        let idx=orders.findIndex(o=>o.id==orderId);
        if(idx>-1){
          orders[idx].status='picked_by_rider';
          orders[idx].rider=riderEmail;
          orders[idx].riderEmail=riderEmail;
          localStorage.setItem(k, JSON.stringify(orders));
        }
      }catch{}
    }
  }
  // Also update rider jobs list
  let jobs=JSON.parse(localStorage.getItem('v2_rider_jobs')||'[]');
  let j=jobs.find(x=>x.id==orderId);
  if(j){ j.status='picked_by_rider'; j.riderEmail=riderEmail; localStorage.setItem('v2_rider_jobs', JSON.stringify(jobs)); }
  localStorage.setItem('v2_rider_jobs_'+riderEmail, JSON.stringify(jobs));

  if(window.dbUpdateOrderStatus){ try{ dbUpdateOrderStatus(orderId, 'picked_by_rider', riderEmail, riderEmail); }catch{} }

  alert('✅ Job picked! Now deliver to customer, then click Delivered');
  renderRiderJobs();
}

function deliverJob(orderId, storeEmail){
  let riderEmail = getRiderEmail();
  let res = FLOW.riderDelivered(riderEmail, orderId, storeEmail);
  if(res.ok){
    alert(`✅ DELIVERED!\nDelivery Fee R${res.deliveryFee}\nPlatform share R${res.riderAdminFee}\nYOU EARN R${res.riderNet} added to balance (minimum R10)\n\nStore will now complete to earn R${res.storeNet}`);
    renderRiderJobs();
    if(window.renderRiderBalance) try{renderRiderBalance()}catch{}
  } else {
    alert('❌ '+(res.msg||res.reason||'Error'));
  }
}

window.renderRiderJobs=renderRiderJobs;
window.pickJob=pickJob;
window.deliverJob=deliverJob;

setTimeout(()=>{ try{renderRiderJobs()}catch{} }, 600);
setInterval(()=>{ try{renderRiderJobs()}catch{} }, 10000);
