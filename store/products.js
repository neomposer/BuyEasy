let emailP = localStorage.getItem('v2_email');
function getProducts(){ return JSON.parse(localStorage.getItem('v2_products_'+emailP)||'[]'); }

function addProduct(){
  let name=document.getElementById('p_name').value.trim();
  let price=parseFloat(document.getElementById('p_price').value);
  let qty=parseInt(document.getElementById('p_qty').value);
  if(!name||!price) return alert('Enter name and price');
  let products=getProducts();
  products.push({id:Date.now(), name, price, qty:qty||0});
  localStorage.setItem('v2_products_'+emailP, JSON.stringify(products));
  showDone('Added: '+name+' • R'+price);
  document.getElementById('p_name').value='';
  document.getElementById('p_price').value='';
  document.getElementById('p_qty').value='';
  renderProducts();
}
function renderProducts(){
  let list=document.getElementById('productList');
  if(!list) return;
  let products=getProducts();
  if(products.length===0){ list.innerHTML='<p style="color:#777;font-size:12px">No products yet</p>'; return; }
  list.innerHTML = products.map(p=>`
    <div style="display:flex;justify-content:space-between;padding:12px;background:#111;border-radius:10px;margin-top:8px;border:1px solid #222">
      <div><div style="font-weight:800;font-size:13px">${p.name}</div><div style="font-size:11px;color:#777">Qty: ${p.qty} • R${p.price}</div></div>
      <button onclick="deleteProduct(${p.id})" style="background:transparent;border:1px solid #333;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">Delete</button>
    </div>
  `).join('');
}
function deleteProduct(id){
  let products=getProducts().filter(p=>p.id!==id);
  localStorage.setItem('v2_products_'+emailP, JSON.stringify(products));
  showDone('Product deleted');
  renderProducts();
}
renderProducts();