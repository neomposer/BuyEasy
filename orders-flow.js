// orders-flow.js — FIXED, KEEPING YOUR ADMIN RULES
// Rider: platform share is limited so rider take-home never falls below R10.
// Store: R1.50 if <R10 else 10% | MIN DELIVERY R10
// Buyer pays: product + delivery | Admin: riderAdminFee + storeAdminFee

window.FLOW = window.FLOW || {};

(function(){
  
  function haversine(lat1, lon1, lat2, lon2){
    if(!lat1||!lon1||!lat2||!lon2) return 1.5;
    const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
    const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); return R*c;
  }

  function getWeatherFee(){
    let weather = localStorage.getItem('v2_weather_today')||'clear';
    let setDate = localStorage.getItem('v2_weather_today_set');
    if(setDate && setDate !== new Date().toDateString()){
      localStorage.setItem('v2_weather_today','clear');
      weather='clear';
    }
    if(weather==='rain') return {fee:6, label:'Rain R6'};
    if(weather==='storm') return {fee:10, label:'Storm R10'};
    if(weather==='heat') return {fee:4, label:'Heat R4'};
    return {fee:0, label:'Clear R0'};
  }

  function getSurge(){
    let hour=new Date().getHours();
    if((hour>=11 && hour<=13) || (hour>=17 && hour<=20)) return {fee:3, label:'Peak R3'};
    return {fee:0, label:'Off-peak R0'};
  }

  function getTimeFee(){
    let hour=new Date().getHours();
    if(hour>=22 || hour<=5) return {fee:2, label:'Night R2'};
    return {fee:0, label:''};
  }

  // ===== CORE: Dynamic Rider Delivery Fee Min R10 =====
  window.calculateRiderFee = window.FLOW.calculateRiderFee = function(orderOrTotal){
    let address='', storeEmail='', buyerEmail='', total=0;
    let storeLat=null, storeLng=null, buyerLat=null, buyerLng=null;
    
    if(typeof orderOrTotal==='object' && orderOrTotal!==null){
      address=orderOrTotal.address||orderOrTotal.buyerAddress||'';
      storeEmail=orderOrTotal.storeEmail||'';
      buyerEmail=orderOrTotal.buyerEmail||'';
      total=parseFloat(orderOrTotal.total||orderOrTotal.productTotal||0)||0;
      storeLat=orderOrTotal.storeLat?parseFloat(orderOrTotal.storeLat):null;
      storeLng=orderOrTotal.storeLng?parseFloat(orderOrTotal.storeLng):null;
      // FIXED: buyerLat fallback
      buyerLat=orderOrTotal.buyerLat!=null ? parseFloat(orderOrTotal.buyerLat) : (orderOrTotal.lat?parseFloat(orderOrTotal.lat):null);
      buyerLng=orderOrTotal.buyerLng!=null ? parseFloat(orderOrTotal.buyerLng) : (orderOrTotal.lng?parseFloat(orderOrTotal.lng):null);
    } else {
      total=parseFloat(orderOrTotal)||0;
    }

    let distanceKm=1.5;
    if(storeLat && buyerLat){
      distanceKm=haversine(storeLat, storeLng, buyerLat, buyerLng);
    } else if(storeEmail){
      try{
        let p=JSON.parse(localStorage.getItem('v2_profile_'+storeEmail)||'{}');
        if(p.storeLat && buyerLat){
          distanceKm=haversine(parseFloat(p.storeLat), parseFloat(p.storeLng), buyerLat, buyerLng);
        }
      }catch{}
    }

    let base=10;
    let distanceFee=distanceKm*1.5;
    let weather=getWeatherFee();
    let surge=getSurge();
    let timeFee=getTimeFee();

    let raw=base+distanceFee+weather.fee+surge.fee+timeFee.fee;
    let totalFee=Math.max(10, raw); // Buyer is never charged less than R10 delivery per store.

    let riderAdminFee = Math.min(totalFee * 0.15, Math.max(0, totalFee - 10));
    let riderNet = totalFee - riderAdminFee;

    return {
      total: parseFloat(totalFee.toFixed(2)),
      fee: parseFloat(totalFee.toFixed(2)),
      deliveryFee: parseFloat(totalFee.toFixed(2)),
      admin: parseFloat(riderAdminFee.toFixed(2)),
      adminFee: parseFloat(riderAdminFee.toFixed(2)),
      riderAdminFee: parseFloat(riderAdminFee.toFixed(2)),
      net: parseFloat(riderNet.toFixed(2)),
      riderNet: parseFloat(riderNet.toFixed(2)),
      breakdown: {
        base: base,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        distanceFee: parseFloat(distanceFee.toFixed(2)),
        weatherFee: weather.fee,
        weatherLabel: weather.label,
        surge: surge.fee,
        surgeLabel: surge.label,
        timeFee: timeFee.fee,
        raw: parseFloat(raw.toFixed(2))
      }
    };
  };

  function calculateStoreFee(productTotal){
    let pt=parseFloat(productTotal)||0;
    let adminFee = pt < 10 ? 1.5 : pt*0.10;
    let net = pt - adminFee;
    return {
      gross: parseFloat(pt.toFixed(2)),
      adminFee: parseFloat(adminFee.toFixed(2)),
      storeAdminFee: parseFloat(adminFee.toFixed(2)),
      net: parseFloat(net.toFixed(2)),
      storeNet: parseFloat(net.toFixed(2))
    };
  }

  // ===== CREATE ORDERS =====
  window.FLOW.createOrders = function(buyerEmail, buyerInfo, cartItems){
    try{
      if(!buyerEmail) return {ok:false, msg:'No buyer email'};
      if(!cartItems || !cartItems.length) return {ok:false, msg:'Cart empty'};
      
      let buyerProfile = {
        name: buyerInfo.name||buyerEmail,
        phone: buyerInfo.phone||'',
        addr: buyerInfo.addr||'',
        lat: buyerInfo.lat||buyerInfo.buyerLat||'',
        lng: buyerInfo.lng||buyerInfo.buyerLng||'',
        buyerLat: buyerInfo.buyerLat||buyerInfo.lat||'',
        buyerLng: buyerInfo.buyerLng||buyerInfo.lng||''
      };

      if(!buyerProfile.phone || !buyerProfile.addr) return {ok:false, msg:'Save phone + address + GPS in Settings'};
      if(!buyerProfile.lat) return {ok:false, msg:'Set delivery GPS: Settings → tap map'};

      let byStore={};
      cartItems.forEach(it=>{
        let se=it.storeEmail;
        if(!se) return;
        if(!byStore[se]) byStore[se]=[];
        byStore[se].push(it);
      });

      let productTotal=0, deliveryTotal=0, grandTotal=0;
      let created=[];

      Object.keys(byStore).forEach(storeEmail=>{
        let items=byStore[storeEmail];
        let storeProdTotal=0; items.forEach(i=>storeProdTotal+= (parseFloat(i.price)||0)*(parseInt(i.qty)||1));
        let storeProfile=JSON.parse(localStorage.getItem('v2_profile_'+storeEmail)||'{}');
        
        let deliveryCalc = window.FLOW.calculateRiderFee({
          address: buyerProfile.addr,
          storeEmail: storeEmail,
          buyerEmail: buyerEmail,
          total: storeProdTotal,
          storeLat: storeProfile.storeLat,
          storeLng: storeProfile.storeLng,
          buyerLat: buyerProfile.buyerLat,
          buyerLng: buyerProfile.buyerLng,
          lat: buyerProfile.lat,
          lng: buyerProfile.lng
        });

        let storeCalc = calculateStoreFee(storeProdTotal);

        let order={
          id: Date.now()+Math.floor(Math.random()*9000),
          customer: buyerProfile.name,
          buyerEmail: buyerEmail,
          phone: buyerProfile.phone,
          address: buyerProfile.addr,
          buyerLat: buyerProfile.buyerLat,
          buyerLng: buyerProfile.buyerLng,
          lat: buyerProfile.lat,
          lng: buyerProfile.lng,
          items: items,
          itemsText: items.map(i=>`${i.name} x${i.qty||1}`).join(', '),
          productTotal: storeProdTotal.toFixed(2),
          deliveryFee: deliveryCalc.total.toFixed(2),
          total: (storeProdTotal+deliveryCalc.total).toFixed(2),
          storeAdminFee: storeCalc.adminFee.toFixed(2),
          riderAdminFee: deliveryCalc.riderAdminFee.toFixed(2),
          storeNet: storeCalc.net.toFixed(2),
          riderNet: deliveryCalc.net.toFixed(2),
          storeEmail: storeEmail,
          storeName: storeProfile.storeName||storeEmail,
          storeAddress: storeProfile.storeAddress||'',
          storeLat: storeProfile.storeLat||'',
          storeLng: storeProfile.storeLng||'',
          status: 'incoming',
          date: new Date().toLocaleString(),
          dateDay: new Date().toLocaleDateString(),
          deliveryBreakdown: deliveryCalc.breakdown
        };

        // Save store orders (old key + new DB key)
        let storeOrders=JSON.parse(localStorage.getItem('v2_orders_'+storeEmail)||'[]');
        storeOrders.unshift(order);
        localStorage.setItem('v2_orders_'+storeEmail, JSON.stringify(storeOrders));
        
        // FIXED: Also sync to new DB for Phase 4 compatibility
        if(window.dbCreateOrder){
          try{ dbCreateOrder({...order, status:'pending'}); }catch{}
        }

        productTotal+=storeProdTotal;
        deliveryTotal+=deliveryCalc.total;
        grandTotal+=storeProdTotal+deliveryCalc.total;
        created.push(order);
      });

      let buyerOrders=JSON.parse(localStorage.getItem('v2_buyer_orders_'+buyerEmail)||'[]');
      buyerOrders.unshift({
        id: Date.now(),
        items: cartItems.map(c=>`${c.name} x${c.qty||1}`).join(', '),
        itemsText: cartItems.map(c=>`${c.name} x${c.qty||1}`).join(', '),
        productTotal: productTotal.toFixed(2),
        deliveryTotal: deliveryTotal.toFixed(2),
        total: grandTotal.toFixed(2),
        store: Object.keys(byStore).join(', '),
        status: 'active',
        date: new Date().toLocaleString(),
        dateDay: new Date().toLocaleDateString(),
        buyerLat: buyerProfile.buyerLat,
        buyerLng: buyerProfile.buyerLng
      });
      localStorage.setItem('v2_buyer_orders_'+buyerEmail, JSON.stringify(buyerOrders));

      let audit=JSON.parse(localStorage.getItem('bhv2_admin_audit')||'[]');
      audit.unshift({action:'order_created', actor:buyerEmail, details:`Buyer ${buyerEmail} Prod R${productTotal.toFixed(2)} + Del R${deliveryTotal.toFixed(2)} = R${grandTotal.toFixed(2)}`, date:new Date().toLocaleString(), ts:Date.now()});
      localStorage.setItem('bhv2_admin_audit', JSON.stringify(audit));

      return {ok:true, productTotal: productTotal.toFixed(2), deliveryTotal: deliveryTotal.toFixed(2), total: grandTotal.toFixed(2), orders: created};
    }catch(e){
      console.error(e);
      return {ok:false, msg:'Checkout error: '+e.message};
    }
  };

  // ===== RIDER DELIVERED =====
  window.FLOW.riderDelivered = function(riderEmail, orderId, storeEmail){
    try{
      // FIXED: check both old and new rider jobs keys
      let riderJobs=JSON.parse(localStorage.getItem('v2_rider_jobs_'+riderEmail)|| localStorage.getItem('v2_rider_jobs') || '[]');
      let idx=riderJobs.findIndex(x=>x.id==orderId);
      if(idx===-1){
        // try generic
        let generic=JSON.parse(localStorage.getItem('v2_rider_jobs')||'[]');
        idx=generic.findIndex(x=>x.id==orderId && (x.riderEmail==riderEmail || !x.riderEmail));
        if(idx>-1) riderJobs=generic;
      }
      if(idx===-1) return {ok:false, msg:'Job not found'};

      let job=riderJobs[idx];
      let deliveryCalc = window.FLOW.calculateRiderFee(job);
      let fee=deliveryCalc.total; let riderAdmin=deliveryCalc.riderAdminFee; let riderNet=deliveryCalc.net;
      let storeProdTotal=parseFloat(job.productTotal||0);
      let storeCalc = calculateStoreFee(storeProdTotal);

      riderJobs[idx].status='delivered';
      riderJobs[idx].deliveredAt=new Date().toLocaleString();
      localStorage.setItem('v2_rider_jobs_'+riderEmail, JSON.stringify(riderJobs));
      localStorage.setItem('v2_rider_jobs', JSON.stringify(riderJobs));

      let sKey='v2_orders_'+(storeEmail||job.storeEmail);
      let storeOrders=JSON.parse(localStorage.getItem(sKey)||'[]');
      let sIdx=storeOrders.findIndex(x=>x.id==orderId);
      if(sIdx>-1){
        storeOrders[sIdx].status='picked_by_rider';
        storeOrders[sIdx].rider=riderEmail;
        storeOrders[sIdx].riderNet=riderNet.toFixed(2);
        storeOrders[sIdx].riderAdminFee=riderAdmin.toFixed(2);
        localStorage.setItem(sKey, JSON.stringify(storeOrders));
      }

      if(window.dbUpdateOrderStatus){
        try{ dbUpdateOrderStatus(orderId, 'picked_by_rider', riderEmail, riderEmail); }catch{}
      }

      let rEarn=JSON.parse(localStorage.getItem('v2_rider_earnings_'+riderEmail)||'[]');
      rEarn.unshift({amount:riderNet.toFixed(2), gross:fee.toFixed(2), adminFee:riderAdmin.toFixed(2), customer:job.customer, store:job.storeEmail||storeEmail, order:job.id, date:new Date().toLocaleString(), dateDay:new Date().toLocaleDateString(), breakdown:`Dist ${deliveryCalc.breakdown.distanceKm}km Base R${deliveryCalc.breakdown.base} + Dist R${deliveryCalc.breakdown.distanceFee} + ${deliveryCalc.breakdown.weatherLabel} + ${deliveryCalc.breakdown.surgeLabel} = R${fee} Min R8`});
      localStorage.setItem('v2_rider_earnings_'+riderEmail, JSON.stringify(rEarn));
      let rBal=parseFloat(localStorage.getItem('v2_balance_'+riderEmail)||'0');
      localStorage.setItem('v2_balance_'+riderEmail, (rBal+riderNet).toFixed(2));

      let abal=parseFloat(localStorage.getItem('v2_admin_balance')||'0');
      localStorage.setItem('v2_admin_balance', (abal+riderAdmin).toFixed(2));
      let aEarn=JSON.parse(localStorage.getItem('v2_admin_earnings')||'[]');
      aEarn.unshift({amount:riderAdmin.toFixed(2), totalAdmin:riderAdmin.toFixed(2), riderAdminFee:riderAdmin.toFixed(2), from:`Rider ${riderEmail} (R${riderAdmin.toFixed(2)})`, breakdown:`Rider NET R${riderNet.toFixed(2)} fee R${fee.toFixed(2)} - Admin R${riderAdmin.toFixed(2)}`, date:new Date().toLocaleString(), dateDay:new Date().toLocaleDateString()});
      localStorage.setItem('v2_admin_earnings', JSON.stringify(aEarn));

      let audit=JSON.parse(localStorage.getItem('bhv2_admin_audit')||'[]');
      audit.unshift({action:'rider_delivered', actor:riderEmail, details:`Rider ${riderEmail} delivered ${orderId} Prod R${storeProdTotal} Del R${fee} -> Rider NET R${riderNet.toFixed(2)}`, date:new Date().toLocaleString(), ts:Date.now()});
      localStorage.setItem('bhv2_admin_audit', JSON.stringify(audit));

      return {ok:true, deliveryFee:fee.toFixed(2), riderAdminFee:riderAdmin.toFixed(2), riderNet:riderNet.toFixed(2), storeNet:storeCalc.net.toFixed(2), storeAdminFee:storeCalc.adminFee.toFixed(2)};
    }catch(e){
      return {ok:false, msg:e.message};
    }
  };

  window.FLOW.storeSelfComplete = function(storeEmail, orderId){
    try{
      let key='v2_orders_'+storeEmail;
      let orders=JSON.parse(localStorage.getItem(key)||'[]');
      let order=orders.find(o=>o.id==orderId);
      if(!order) return {ok:false, reason:'not_found'};
      if(order.status!=='picked_by_rider' && order.status!=='active' && order.status!=='incoming') return {ok:false, reason:'rider_not_picked'};

      let productTotal=parseFloat(order.productTotal||0);
      let storeCalc=calculateStoreFee(productTotal);

      order.status='history';
      order.completedAt=new Date().toLocaleString();
      localStorage.setItem(key, JSON.stringify(orders));

      if(window.dbUpdateOrderStatus){
        try{ dbUpdateOrderStatus(orderId, 'completed', storeEmail); }catch{}
      }

      let earnKey='v2_earnings_'+storeEmail;
      let earn=JSON.parse(localStorage.getItem(earnKey)||'[]');
      earn.unshift({amount:storeCalc.net.toFixed(2), gross:productTotal.toFixed(2), adminFee:storeCalc.adminFee.toFixed(2), customer:order.customer||'', order:order.id, date:new Date().toLocaleString(), dateDay:new Date().toLocaleDateString()});
      localStorage.setItem(earnKey, JSON.stringify(earn));
      let bal=parseFloat(localStorage.getItem('v2_balance_'+storeEmail)||'0');
      localStorage.setItem('v2_balance_'+storeEmail, (bal+storeCalc.net).toFixed(2));

      let abal=parseFloat(localStorage.getItem('v2_admin_balance')||'0');
      localStorage.setItem('v2_admin_balance', (abal+storeCalc.adminFee).toFixed(2));
      let aEarn=JSON.parse(localStorage.getItem('v2_admin_earnings')||'[]');
      aEarn.unshift({amount:storeCalc.adminFee.toFixed(2), totalAdmin:storeCalc.adminFee.toFixed(2), storeAdminFee:storeCalc.adminFee.toFixed(2), from:`Store ${storeEmail} (R${storeCalc.adminFee.toFixed(2)})`, breakdown:`Store NET R${storeCalc.net.toFixed(2)} fee R${storeCalc.adminFee.toFixed(2)}`, date:new Date().toLocaleString(), dateDay:new Date().toLocaleDateString()});
      localStorage.setItem('v2_admin_earnings', JSON.stringify(aEarn));

      let audit=JSON.parse(localStorage.getItem('bhv2_admin_audit')||'[]');
      audit.unshift({action:'store_self_complete', actor:storeEmail, details:`Store ${storeEmail} completed ${orderId} NET R${storeCalc.net.toFixed(2)}`, date:new Date().toLocaleString(), ts:Date.now()});
      localStorage.setItem('bhv2_admin_audit', JSON.stringify(audit));

      return {ok:true, storeNet:storeCalc.net.toFixed(2), storeAdminFee:storeCalc.adminFee.toFixed(2), gross:productTotal.toFixed(2)};
    }catch(e){
      return {ok:false, reason:e.message};
    }
  };

})();
