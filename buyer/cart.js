// buyer/cart.js - FIXED Phase 4 - Uses FLOW.createOrders with MIN R8 + Admin Rules

function getCart(buyerEmail){
  return JSON.parse(localStorage.getItem('v2_cart_'+buyerEmail) || localStorage.getItem('cart_'+buyerEmail) || localStorage.getItem('cart') || '[]');
}

function saveCart(buyerEmail, cart){
  localStorage.setItem('v2_cart_'+buyerEmail, JSON.stringify(cart));
  localStorage.setItem('cart', JSON.stringify(cart)); // backward compat
}

function renderCart(){
  let sess = {};
  try{ sess = JSON.parse(localStorage.getItem('bhv2_session')||'{}'); }catch{}
  let email = sess.email || 'guest';
  let cart = getCart(email);
  
  let el = document.getElementById('cartList') || document.getElementById('cart-items') || document.getElementById('cart');
  if(!el) return;
  
  if(!cart.length){
    el.innerHTML='<p style="padding:20px;text-align:center">Cart empty</p>';
    let totalEl = document.getElementById('cartTotal') || document.getElementById('total');
    if(totalEl) totalEl.innerText='R0';
    return;
  }

  // Group by store for preview
  let byStore={};
  let grandProd=0;
  cart.forEach(it=>{
    let se=it.storeEmail;
    if(!byStore[se]) byStore[se]={items:[], total:0};
    byStore[se].items.push(it);
    let t=(parseFloat(it.price)||0)*(parseInt(it.qty)||1);
    byStore[se].total+=t;
    grandProd+=t;
  });

  let html='';
  Object.keys(byStore).forEach(storeEmail=>{
    let group=byStore[storeEmail];
    // Calculate delivery preview for this store
    let deliveryCalc={total:8, breakdown:{distanceKm:1.5}};
    try{
      let storeProfile=JSON.parse(localStorage.getItem('v2_profile_'+storeEmail)||'{}');
      let buyerProfile=JSON.parse(localStorage.getItem('v2_profile_'+email)||'{}');
      deliveryCalc = FLOW.calculateRiderFee({
        address: buyerProfile.storeAddress||buyerProfile.address||'123 Main',
        storeEmail: storeEmail,
        buyerEmail: email,
        storeLat: storeProfile.storeLat,
        storeLng: storeProfile.storeLng,
        buyerLat: buyerProfile.buyerLat||buyerProfile.lat,
        buyerLng: buyerProfile.buyerLng||buyerProfile.lng,
        lat: buyerProfile.lat,
        lng: buyerProfile.lng
      });
    }catch{}

    html+=`<div style="border:1px solid #ddd;padding:10px;margin:10px 0;border-radius:10px">
      <b>Store: ${storeEmail}</b> — Products R${group.total.toFixed(2)} + Delivery R${deliveryCalc.total.toFixed(2)} (Min R8)
      <div style="font-size:11px;color:#666">${group.items.map(i=>`${i.name} x${i.qty||1} R${i.price}`).join('<br>')}</div>
      <div style="font-size:11px;color:#888">Dist ${deliveryCalc.breakdown.distanceKm}km | Base R${deliveryCalc.breakdown.base||6} + Dist R${deliveryCalc.breakdown.distanceFee||0} + ${deliveryCalc.breakdown.weatherLabel||'Clear'} + ${deliveryCalc.breakdown.surgeLabel||''}</div>
    </div>`;
  });

  html+=`<div style="padding:15px;background:#f5f5f5;border-radius:10px;margin-top:10px">
    <b>Grand Product: R${grandProd.toFixed(2)}</b><br>
    <button id="checkoutBtn" style="width:100%;padding:14px;background:#000;color:#fff;border:none;border-radius:10px;margin-top:10px;font-weight:bold" onclick="doCheckout()">Checkout — Pay Product + Delivery (Min R8)</button>
  </div>`;

  el.innerHTML=html;
}

function doCheckout(){
  let sess={};
  try{ sess=JSON.parse(localStorage.getItem('bhv2_session')||'{}'); }catch{}
  let email=sess.email;
  if(!email){ alert('Login first'); location.href='../index.html'; return; }
  
  let cart=getCart(email);
  if(!cart.length){ alert('Cart empty'); return; }

  let profile=JSON.parse(localStorage.getItem('v2_profile_'+email)||'{}');
  // Ask if missing
  if(!profile.phone){
    let ph=prompt('Enter phone number for delivery:');
    if(!ph) return;
    profile.phone=ph;
  }
  if(!profile.storeAddress && !profile.address && !profile.buyerAddress){
    let ad=prompt('Enter delivery address:');
    if(!ad) return;
    profile.storeAddress=ad;
  }
  if(!profile.buyerLat && !profile.lat){
    let useGPS=confirm('Use your current location for delivery? Click OK to allow GPS, or Cancel to type address only (will use 1.5km estimate)');
    if(useGPS && navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        profile.buyerLat=pos.coords.latitude;
        profile.buyerLng=pos.coords.longitude;
        profile.lat=pos.coords.latitude;
        profile.lng=pos.coords.longitude;
        localStorage.setItem('v2_profile_'+email, JSON.stringify(profile));
        doCheckoutReal(email, profile, cart);
      }, ()=>{ doCheckoutReal(email, profile, cart); });
      return;
    }
  }
  localStorage.setItem('v2_profile_'+email, JSON.stringify(profile));
  doCheckoutReal(email, profile, cart);
}

function doCheckoutReal(email, profile, cart){
  let buyerInfo={
    name: profile.storeName||profile.name||email,
    phone: profile.phone,
    addr: profile.storeAddress||profile.address||profile.buyerAddress||'',
    lat: profile.lat||profile.buyerLat||'',
    lng: profile.lng||profile.buyerLng||'',
    buyerLat: profile.buyerLat||profile.lat||'',
    buyerLng: profile.buyerLng||profile.lng||''
  };

  let res=FLOW.createOrders(email, buyerInfo, cart);
  if(res.ok){
    alert(`✅ Order Placed!\nProduct R${res.productTotal}\nDelivery R${res.deliveryTotal} (Min R8, Rider gets 85%, Admin 15% OR R1.50)\nTOTAL R${res.total}\nStore gets 90%, Admin 10% OR R1.50`);
    saveCart(email, []);
    if(window.renderCart) renderCart();
    location.reload();
  } else {
    alert('❌ '+res.msg);
  }
}

window.renderCart=renderCart;
window.doCheckout=doCheckout;

// auto render
setTimeout(()=>{ try{renderCart()}catch{} }, 500);