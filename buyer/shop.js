window.BuyerShop = {
  render(){
    let all=[]; for(let i=0;i<localStorage.length;i++){ let k=localStorage.key(i); if(k.startsWith('v2_products_')){ let email=k.replace('v2_products_',''); let prods=JSON.parse(localStorage.getItem(k)||'[]'); prods.forEach(p=>all.push({...p, storeEmail:email})); } }
    let list=document.getElementById('shopList'); if(!list) return;
    if(!all.length){ list.innerHTML='<p style="color:#888">No products yet</p>'; return; }
    list.innerHTML=all.map(p=>`<div class="prod-card"><img src="${p.img||''}"><div class="prod-info"><div class="prod-name">${p.name}</div><div class="prod-meta">R${p.price} • Store ${p.storeEmail}</div></div><button onclick="BuyerCart.add('${p.storeEmail}',${p.id})" style="padding:8px 12px;border-radius:10px;border:none;background:#fff;color:#111;font-weight:900;font-size:11px;cursor:pointer">Add</button></div>`).join('');
  }
};