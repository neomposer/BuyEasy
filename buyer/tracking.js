// buyer/tracking.js - V6 FIXED - No blink, History works, reads BOTH storages
window.BuyerTracking = {
  activeTab: 'active',
  map: null,
  riderMarker: null,
  interval: null,

  getAllOrders(){
    let email = '';
    try{ email = JSON.parse(localStorage.getItem('bhv2_session')||'{}').email || localStorage.getItem('v2_email') || localStorage.getItem('bhv2_email') || ''; }catch{}
    if(!email) email = 'buyer@test.com';
    let all = [];
    for(let i=0;i<localStorage.length;i++){
      let k=localStorage.key(i);
      if(k && k.startsWith('v2_orders_')){
        try{ let arr=JSON.parse(localStorage.getItem(k)||'[]'); arr.forEach(o=> all.push(o)); }catch{}
      }
    }
    for(let i=0;i<localStorage.length;i++){
      let k=localStorage.key(i);
      if(k && k.startsWith('v2_buyer_orders_')){
        try{ 
          let arr=JSON.parse(localStorage.getItem(k)||'[]'); 
          arr.forEach(o=>{
            if(!o.id) o.id='ord_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
            if(!o.status) o.status='active';
            if(!o.storeName) o.storeName=o.store||'Store';
            all.push(o);
          });
        }catch{}
      }
    }
    let seen={}; all=all.filter(o=>{ if(!o.id) return true; if(seen[o.id]) return false; seen[o.id]=1; return true; });
    return all.sort((a,b)=> new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0));
  },

  initTabs(){
    let pills = [...document.querySelectorAll('.order-tab'), ...[...document.querySelectorAll('button')].filter(b=>['active','history'].includes(b.innerText.trim().toLowerCase()))];
    pills.forEach(b=>{
      let t=b.innerText.trim().toLowerCase();
      if(t==='active'){ b.id='activeTabBtn'; b.onclick=()=>{ this.activeTab='active'; curTab='active'; this.updateTabUI(); this.render(true); }; }
      if(t==='history'){ b.id='historyTabBtn'; b.onclick=()=>{ this.activeTab='history'; curTab='history'; this.updateTabUI(); this.render(true); }; }
    });
    this.updateTabUI();
  },

  updateTabUI(){
    document.querySelectorAll('.order-tab').forEach(x=>{
      let t=x.innerText.trim().toLowerCase();
      if(t===this.activeTab) x.classList.add('active'); else x.classList.remove('active');
    });
  },

  getContainer(){ return document.getElementById('ordersList'); },

  render(force=false){
    // Supabase is the source of truth for current orders. The legacy localStorage
    // renderer below is kept only for older standalone pages and must never
    // replace the live buyer order list in the Supabase dashboard.
    if(window.BuyerSupabase && typeof window.BuyerSupabase.renderOrders==='function'){
      window.BuyerSupabase.renderOrders();
      return;
    }
    if(document.getElementById('riderMapPopup')?.style.display==='block' && !force) return;
    let container=this.getContainer(); if(!container) return;
    let all=this.getAllOrders();
    let norm=s=>(s||'').toLowerCase().trim();
    let activeOrders=all.filter(o=>!['delivered','completed','history','rejected','cancelled','canceled'].includes(norm(o.status)));
    let historyOrders=all.filter(o=>['delivered','completed','history','rejected','cancelled','canceled'].includes(norm(o.status)));
    let orders=this.activeTab==='active'?activeOrders:historyOrders;
    if(orders.length===0){ container.innerHTML='<div style="text-align:center;padding:30px;color:#666">No '+this.activeTab+' orders<br>Total: '+all.length+'</div>'; return; }
    container.innerHTML=orders.map(o=>{
      let st=norm(o.status)||'incoming';
      let step={'incoming':1,'active':1,'accepted_by_store':2,'picked_by_rider':3,'on_the_way':4,'delivered':5,'completed':5,'history':5}[st]||1;
      let isHistory=this.activeTab==='history';
      let total=o.total||0;
      let store=o.storeName||o.store||'THEMBI';
      return `<div style="background:#1a1a1a;border-radius:16px;padding:14px;margin-bottom:10px;border:1px solid #2a2a2a">
        <div style="display:flex;justify-content:space-between"><b>${store} • R${Number(total).toFixed(2)}</b><span style="background:${isHistory?'#333':'#f59e0b'};color:${isHistory?'#888':'#000'};padding:4px 10px;border-radius:20px;font-size:10px;font-weight:900">${o.status}</span></div>
        <div style="font-size:11px;color:#aaa;margin:6px 0">${o.items||'BREAD x1'} • ${String(o.id||'').slice(0,8)} • ${o.date||o.createdAt||''}</div>
        <div style="display:flex;gap:4px;margin:10px 0"><div style="flex:1;height:6px;border-radius:10px;background:${step>=1?'#22c55e':'#333'}"></div><div style="flex:1;height:6px;border-radius:10px;background:${step>=2?'#22c55e':'#333'}"></div><div style="flex:1;height:6px;border-radius:10px;background:${step>=3?'#22c55e':'#333'}"></div><div style="flex:1;height:6px;border-radius:10px;background:${step>=4?'#22c55e':'#333'}"></div><div style="flex:1;height:6px;border-radius:10px;background:${step>=5?'#22c55e':'#333'}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#666;margin-bottom:8px"><span>Ordered</span><span>Accepted</span><span>Picked</span><span>On Way</span><span>Delivered</span></div>
        ${!isHistory?`<button onclick="BuyerTracking.openMap('${o.id}')" style="width:100%;background:#fff;color:#000;border:none;padding:12px;border-radius:12px;font-weight:900">🗺️ Track Rider Live</button>`:`<div style="color:#22c55e;font-size:11px;background:rgba(34,197,94,.1);padding:6px 10px;border-radius:8px">✓ Delivered — in History</div>`}
      </div>`;
    }).join('');
  },

  openMap(orderId){
    if(!document.getElementById('riderMapPopup')){
      let div=document.createElement('div'); div.id='riderMapPopup';
      div.innerHTML=`<div style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85)"><div style="position:absolute;bottom:0;left:0;right:0;background:#111;border-radius:20px 20px 0 0;padding:16px"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><b style="color:#fff">🏍️ Rider Live</b><button onclick="BuyerTracking.closeMap()" style="background:#333;color:#fff;border:none;width:32px;height:32px;border-radius:50%">✕</button></div><div id="liveMap" style="height:380px;border-radius:16px;background:#222"></div><div id="liveMapStatus" style="margin-top:12px;padding:10px;background:rgba(34,197,94,.15);border-radius:10px;color:#22c55e;font-size:12px;font-weight:700">Rider is on the way!</div></div></div>`;
      document.body.appendChild(div);
    }
    document.getElementById('riderMapPopup').style.display='block';
    setTimeout(()=>this.initLiveMap(orderId),200);
  },
  closeMap(){ let p=document.getElementById('riderMapPopup'); if(p) p.style.display='none'; if(this.map){ this.map.remove(); this.map=null; } if(this.interval) clearInterval(this.interval); },
  initLiveMap(){
    if(this.map){ this.map.remove(); this.map=null; }
    let m=document.getElementById('liveMap'); if(!m) return;
    let blat=-29.8587, blng=31.0218;
    this.map=L.map('liveMap').setView([blat,blng],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    L.marker([blat,blng]).addTo(this.map).bindPopup('You 📍').openPopup();
    let rlat=blat+0.018, rlng=blng+0.018;
    this.riderMarker=L.marker([rlat,rlng]).addTo(this.map).bindPopup('Rider 🏍️');
    let cur=0;
    this.interval=setInterval(()=>{
      if(document.getElementById('riderMapPopup')?.style.display==='none'){ clearInterval(this.interval); return; }
      cur+=0.04; if(cur>=1){ clearInterval(this.interval); document.getElementById('liveMapStatus').innerText='Rider arrived! 🎉'; return; }
      let lat=rlat+(blat-rlat)*cur, lng=rlng+(blng-rlng)*cur;
      this.riderMarker.setLatLng([lat,lng]); this.map.panTo([lat,lng]);
      document.getElementById('liveMapStatus').innerText='Rider is '+(Math.round((1-cur)*2.3*10)/10)+'km away — on the way!';
    },1200);
  }
};
setTimeout(()=>{ BuyerTracking.initTabs(); BuyerTracking.render(true); }, 800);
