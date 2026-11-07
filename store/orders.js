// store/orders.js - Phase 4 - Incoming → Ready → Picked → Complete & Earn
function getStoreEmail(){
  try{ return JSON.parse(localStorage.getItem('bhv2_session')||'{}').email || ''; }catch{ return ''; }
}

function renderStoreOrders(){
  let storeEmail = getStoreEmail();
  if(!storeEmail) return;
  let orders = JSON.parse(localStorage.getItem('v2_orders_'+storeEmail) || '[]');
  let el = document.getElementById('storeOrders') || document.getElementById('orders') || document.getElementById('orderList');
  if(!el){ setTimeout(renderStoreOrders, 800); return; }

  if(!orders.length){
    el.innerHTML='<p style="padding:20px;text-align:center">No orders yet. When buyer checks out, it appears here (incoming)</p>';
    return;
  }

  let html='';
  orders.slice().reverse().forEach(o=>{
    if(o.status==='history') return; // hide completed
    let isPicked = o.status==='picked_by_rider';
    let badge = o.status==='incoming' ? '<span style="background:orange;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">INCOMING</span>' : 
                o.status==='picked_by_rider' ? '<span style="background:blue;color:#fff;padding:2px 8px;border-radius:10px">RIDER PICKED - READY TO COMPLETE</span>' :
                `<span style="background:#ddd;padding:2px 8px;border-radius:10px">${o.status}</span>`;
    
    html+=`<div style="border:1px solid #ddd;padding:12px;margin:10px 0;border-radius:12px;background:#fff">
      <div style="display:flex;justify-content:space-between"><b>Order #${o.id}</b> ${badge}</div>
      <div style="font-size:13px;margin:6px 0">Customer: ${o.customer||o.buyerEmail} — ${o.phone||''}<br>Addr: ${o.address||''}<br>Items: ${o.itemsText||''}</div>
      <div style="font-size:13px;background:#f6f6f6;padding:8px;border-radius:8px">
        Product R${o.productTotal||o.total} — Your Net R${o.storeNet|| (parseFloat(o.productTotal||0)*0.9).toFixed(2)} (Admin Fee R${o.storeAdminFee|| (parseFloat(o.productTotal||0)<10?1.5:(parseFloat(o.productTotal||0)*0.1).toFixed(2))} — 10% or R1.50)<br>
        Delivery R${o.deliveryFee||'8+'} — Rider gets R${o.riderNet||''} (Admin R${o.riderAdminFee||''})
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        ${!isPicked ? `<small style="color:#666">Waiting for rider to pick...</small>` : 
        `<button onclick="completeStoreOrder(${o.id})" style="flex:1;padding:10px;background:#000;color:#fff;border:none;border-radius:10px;font-weight:bold">✅ Complete & Earn R${o.storeNet|| (parseFloat(o.productTotal||0)*0.9).toFixed(2)}</button>`}
      </div>
    </div>`;
  });

  el.innerHTML = html || '<p>No active orders</p>';
}

function completeStoreOrder(orderId){
  let storeEmail = getStoreEmail();
  let res = FLOW.storeSelfComplete(storeEmail, orderId);
  if(res.ok){
    alert(`✅ Completed!\nGross R${res.gross}\nAdmin Fee R${res.storeAdminFee} (10% or R1.50)\nYOU EARN R${res.storeNet} — added to balance`);
    renderStoreOrders();
    if(window.renderStoreBalance) renderStoreBalance();
  } else {
    if(res.reason==='rider_not_picked') alert('❌ Rider has not picked yet. Wait for rider status = picked_by_rider');
    else alert('❌ '+ (res.reason||res.msg||'Error'));
  }
}

window.renderStoreOrders=renderStoreOrders;
window.completeStoreOrder=completeStoreOrder;

setTimeout(()=>{ try{renderStoreOrders()}catch{} }, 600);
setInterval(()=>{ try{renderStoreOrders()}catch{} }, 10000);