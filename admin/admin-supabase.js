/* BUYEasy Admin read-only Supabase dashboard.
 * Sensitive account, wallet, payout and order mutations stay server-side and
 * are disabled until dedicated audited RPC/Edge Function workflows exist.
 */
(function () {
  'use strict';
  const db = window.supabaseClient;
  const state = { profiles: [], stores: [], orders: [], products: [], wallets: [], transactions: [], platformFees: [], errors: {}, loadedAt: 0, loading: false };
  const $ = id => document.getElementById(id);
  const money = n => 'R' + Number(n || 0).toFixed(2);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const show = message => typeof window.proAlert === 'function' ? window.proAlert('Not available yet', message) : alert(message);

  async function loadAdminData(force = false) {
    if (!db) throw new Error('Supabase connection was not found.');
    if (state.loading) return;
    if (!force && Date.now() - state.loadedAt < 15000) return;
    state.loading = true;
    try {
      const { data: authData, error: authError } = await db.auth.getUser();
      if (authError || !authData.user) throw new Error('Please sign in again.');
      const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', authData.user.id).single();
      if (profileError || profile?.role !== 'admin') throw new Error('Administrator access is required.');
      const requests = {
        profiles: db.from('profiles').select('id,email,role,full_name,created_at').order('created_at',{ascending:false}).limit(1000),
        stores: db.from('stores').select('id,owner_id,store_name,is_approved,is_online,created_at').order('created_at',{ascending:false}).limit(1000),
        orders: db.from('orders').select('id,order_number,buyer_id,store_id,assigned_rider_id,status,payment_method,payment_status,product_total,delivery_fee,total,store_admin_fee,rider_admin_fee,store_net,rider_net,created_at,stores(store_name)').order('created_at',{ascending:false}).limit(1000),
        products: db.from('products').select('id,store_id,name,price,quantity,is_available,created_at,stores(store_name)').order('created_at',{ascending:false}).limit(1000),
        wallets: db.from('wallets').select('user_id,balance,currency,updated_at').limit(1000),
        transactions: db.from('transactions').select('id,user_id,type,amount,description,order_id,created_at').order('created_at',{ascending:false}).limit(1000),
        platformFees: db.from('platform_fees').select('id,order_id,fee_type,amount,created_at,orders(order_number,payment_method,payment_status,status)').order('created_at',{ascending:false}).limit(1000)
      };
      const entries = await Promise.all(Object.entries(requests).map(async ([key, query]) => {
        const {data,error} = await query;
        return [key, data || [], error || null];
      }));
      entries.forEach(([key, rows, error]) => { state[key] = rows; state.errors[key] = error; });
      state.loadedAt = Date.now();
    } finally { state.loading = false; }
  }
  function panelError(key) { return state.errors[key] ? `<p style="color:#ef4444;font-size:12px">Could not load Supabase ${esc(key)}: ${esc(state.errors[key].message)}</p>` : ''; }
  function put(id, value) { const el = $(id); if (el) el.textContent = value; }

  async function getStats() {
    try {
      await loadAdminData();
      put('sUsers', state.errors.profiles ? '—' : state.profiles.length);
      put('sStores', state.errors.stores ? '—' : state.stores.filter(s=>s.is_approved).length);
      put('sRiders', state.errors.profiles ? '—' : state.profiles.filter(p=>p.role==='rider').length);
      put('sOrders', state.errors.orders ? '—' : state.orders.length);
    } catch (e) { console.error(e); }
  }

  async function renderUsers() {
    const body = $('usersTbl'); if (!body) return;
    try {
      await loadAdminData();
      const q = ($('uSearch')?.value || '').trim().toLowerCase();
      const wallets = new Map(state.wallets.map(w=>[w.user_id,w]));
      const storeMap = new Map(state.stores.map(s=>[s.owner_id,s]));
      const rows = state.profiles.filter(p=>`${p.email||''} ${p.full_name||''} ${p.role||''}`.toLowerCase().includes(q));
      put('usersCount', rows.length);
      body.innerHTML = panelError('profiles') || (rows.length ? rows.map(p=>{
        const store = storeMap.get(p.id), wallet = wallets.get(p.id);
        const kind = p.role==='admin'?'Administrator':p.role==='rider'?'Rider':'Buyer';
        const access = state.errors.stores ? 'Unavailable' : store?.is_approved ? `Approved Store${store.is_online?' • Online':''}` : store ? 'Store not approved' : '—';
        const walletText = state.errors.wallets ? 'Unavailable' : `${money(wallet?.balance||0)} ${esc(wallet?.currency||'ZAR')}`;
        return `<tr><td style="font-weight:600">${esc(p.email||p.full_name||'Account')}</td><td><span class="badge ${p.role==='admin'?'b-red':p.role==='rider'?'b-green':'b-blue'}">${kind}</span></td><td>${esc(access)}</td><td>${walletText}</td><td><button class="pill" onclick="godViewUserEarnings('${esc(p.id)}')">View</button></td></tr>`;
      }).join('') : '<tr><td colspan="5" style="color:var(--muted)">No accounts found.</td></tr>');
    } catch(e) { body.innerHTML=`<tr><td colspan="5" style="color:#ef4444">${esc(e.message)}</td></tr>`; }
  }

  async function godRecalculate() {
    try {
      await loadAdminData();
      if(state.errors.orders||state.errors.platformFees||state.errors.transactions){
        put('godTotalCash','Unavailable');put('godAdminProfit','Unavailable');put('godToUsers','Unavailable');
        put('godStoresEarn','Unavailable');put('godRidersEarn','Unavailable');put('godCompleted','—');put('godRejected','—');put('godPending','—');
        return;
      }
      const orders=state.orders, fees=state.platformFees, tx=state.transactions;
      const value=orders.reduce((s,o)=>s+Number(o.total||0),0);
      const feeSum=fees.reduce((s,f)=>s+Number(f.amount||0),0);
      const storeEarn=tx.filter(t=>t.type==='store_earning').reduce((s,t)=>s+Number(t.amount||0),0);
      const riderEarn=tx.filter(t=>t.type==='rider_earning').reduce((s,t)=>s+Number(t.amount||0),0);
      const done=orders.filter(o=>o.status==='delivered').length;
      const rejected=orders.filter(o=>['cancelled','rejected'].includes(o.status)).length;
      const pending=orders.filter(o=>!['delivered','cancelled','rejected'].includes(o.status)).length;
      put('godTotalCash',money(value)); put('godOrdersCount',`${orders.length} orders`); put('godOrdersCount2',orders.length);
      put('godAdminProfit',money(feeSum)); put('adminBal',money(feeSum));
      put('godAdminBreak','Recorded fees; cash collection may be pending');
      put('godStoresEarn',money(storeEarn)); put('godRidersEarn',money(riderEarn));
      put('godToUsers',money(storeEarn+riderEarn)); put('godToUsersBreak','Recorded wallet earnings');
      put('godWithdrawn','Not tracked'); put('godCompleted',done); put('godRejected',rejected); put('godPending',pending);
      window._god={totalOrderValue:value,platformFees:feeSum,storeEarn,riderEarn,orders};
    } catch(e) { console.error('Admin figures refresh failed:',e); }
  }

  async function renderAdminFees() {
    const el=$('feesList');
    try {
      await loadAdminData();
      const fees=state.platformFees;
      if(state.errors.platformFees){
        ['adminBal','adminToday','adminTodayCount','fromRiders','fromStores'].forEach(id=>put(id,'Unavailable'));
        if(el)el.innerHTML=panelError('platformFees');
        return;
      }
      const total=fees.reduce((s,f)=>s+Number(f.amount||0),0);
      const todayRows=fees.filter(f=>new Date(f.created_at).toDateString()===new Date().toDateString());
      put('adminBal',money(total)); put('adminToday',money(todayRows.reduce((s,f)=>s+Number(f.amount||0),0)));
      put('adminTodayCount',`${todayRows.length} recorded fee entries today`);
      put('fromRiders',money(fees.filter(f=>f.fee_type==='rider').reduce((s,f)=>s+Number(f.amount||0),0)));
      put('fromStores',money(fees.filter(f=>f.fee_type==='store').reduce((s,f)=>s+Number(f.amount||0),0)));
      if(el) el.innerHTML=panelError('platformFees') || (fees.length ? fees.slice(0,150).map(f=>`<div class="hist-item"><div><b>${esc(f.fee_type)} fee • ${esc(f.orders?.order_number||f.order_id)}</b><div class="status">${new Date(f.created_at).toLocaleString()} • ${esc(f.orders?.payment_method||'')} • ${esc(f.orders?.payment_status||'')}</div></div><b>${money(f.amount)}</b></div>`).join('') : '<p class="status">No platform fee records yet. Fees are recorded after delivery.</p>');
    } catch(e) { if(el)el.innerHTML=`<p class="status">${esc(e.message)}</p>`; }
  }

  async function godRenderOrders() {
    const el=$('godOrdersList'); if(!el)return;
    try {
      await loadAdminData();
      const filter=$('godOrderFilter')?.value||'all';
      const rows=state.orders.filter(o=>filter==='all'||(filter==='completed'&&o.status==='delivered')||(filter==='rejected'&&['rejected','cancelled'].includes(o.status))||(filter==='pending'&&o.status==='pending')||(filter==='active'&&!['delivered','rejected','cancelled'].includes(o.status)));
      put('godOrdersCount2',rows.length);
      el.innerHTML=panelError('orders') || (rows.length?rows.slice(0,150).map(o=>`<div class="hist-item"><div style="flex:1"><b>${esc(o.order_number||o.id)} • ${esc(o.stores?.store_name||'Store')}</b><div class="status">${esc(o.status)} • ${esc(o.payment_method)} / ${esc(o.payment_status)} • ${new Date(o.created_at).toLocaleString()}</div><div class="status">Products ${money(o.product_total)} • Delivery ${money(o.delivery_fee)} • Total ${money(o.total)}</div></div></div>`).join(''):'<p class="status">No database orders match this filter.</p>');
    } catch(e) {el.innerHTML=`<p class="status">${esc(e.message)}</p>`;}
  }

  async function godRenderProducts() {
    const el=$('godProductsList');if(!el)return;
    try {
      await loadAdminData();put('godProductsCount',state.products.length);
      el.innerHTML=panelError('products') || (state.products.length?state.products.map(p=>`<div class="hist-item"><div style="flex:1"><b>${esc(p.name)}</b><div class="status">${esc(p.stores?.store_name||'Store')} • ${money(p.price)} • Stock ${Number(p.quantity||0)}</div></div><span class="badge ${p.is_available?'b-green':'b-red'}">${p.is_available?'AVAILABLE':'HIDDEN'}</span></div>`).join(''):'<p class="status">No database products found.</p>');
    }catch(e){el.innerHTML=`<p class="status">${esc(e.message)}</p>`;}
  }

  async function godRenderProfits() {
    const el=$('godProfitsList');if(!el)return;
    try {
      await loadAdminData();
      const rows=state.platformFees;
      el.innerHTML=panelError('platformFees') || (rows.length?rows.slice(0,150).map(f=>`<div class="hist-item"><div><b>${esc(f.orders?.order_number||f.order_id)}</b><div class="status">${esc(f.fee_type)} fee • ${esc(f.orders?.status||'')} • ${esc(f.orders?.payment_method||'')} ${esc(f.orders?.payment_status||'')}</div></div><b>${money(f.amount)}</b></div>`).join(''):'<p class="status">No platform fee entries recorded yet.</p>');
    }catch(e){el.innerHTML=`<p class="status">${esc(e.message)}</p>`;}
  }

  async function godRenderLive() {
    const el=$('godLiveList');if(!el)return;
    try {
      await loadAdminData();
      const map=new Map(state.profiles.map(p=>[p.id,p]));
      const rows=state.stores.map(s=>({store:s,profile:map.get(s.owner_id)}));
      el.innerHTML=panelError('profiles') || panelError('stores') || (rows.length?rows.map(({store,profile})=>`<div class="hist-item"><div><b>${esc(store.store_name||'Store')}</b><div class="status">${esc(profile?.email||'')} • ${store.is_approved?'Approved':'Not approved'}</div></div><span class="badge ${store.is_online?'b-green':'b-yellow'}">${store.is_online?'ONLINE':'OFFLINE'}</span></div>`).join(''):'<p class="status">No stores found. Rider live-presence tracking is not connected.</p>');
    }catch(e){el.innerHTML=`<p class="status">${esc(e.message)}</p>`;}
  }

  async function godRenderEarnings() {
    const el=$('godEarningsList');if(!el)return;
    try {
      await loadAdminData();
      const wallet=new Map(state.wallets.map(w=>[w.user_id,w]));
      const storeTotals=new Map(), riderTotals=new Map();
      state.transactions.forEach(t=>{const m=t.type==='store_earning'?storeTotals:t.type==='rider_earning'?riderTotals:null;if(m)m.set(t.user_id,(m.get(t.user_id)||0)+Number(t.amount||0));});
      el.innerHTML=panelError('profiles') || panelError('wallets') || panelError('transactions') || (state.profiles.length?'<table class="tbl"><thead><tr><th>Account</th><th>Role</th><th>Recorded earnings</th><th>Wallet</th></tr></thead><tbody>'+state.profiles.map(p=>`<tr><td>${esc(p.email||p.full_name||'Account')}</td><td>${esc(p.role)}</td><td>${money((storeTotals.get(p.id)||0)+(riderTotals.get(p.id)||0))}</td><td>${money(wallet.get(p.id)?.balance||0)}</td></tr>`).join('')+'</tbody></table>':'<p class="status">No account records.</p>');
    }catch(e){el.innerHTML=`<p class="status">${esc(e.message)}</p>`;}
  }

  async function godViewUserEarnings(userId) {
    try {
      await loadAdminData();
      const profile=state.profiles.find(p=>p.id===userId||p.email===userId);
      if(!profile)return show('Account not found.');
      const wallet=state.wallets.find(w=>w.user_id===profile.id);
      const tx=state.transactions.filter(t=>t.user_id===profile.id).slice(0,40);
      const body=`<p><b>${esc(profile.email||profile.full_name)}</b> • ${esc(profile.role)}</p><p>Wallet balance: <b>${money(wallet?.balance)}</b></p><h4>Recent database transactions</h4>${tx.length?tx.map(t=>`<div class="hist-item"><div>${esc(t.description||t.type)}<div class="status">${new Date(t.created_at).toLocaleString()}</div></div><b>${money(t.amount)}</b></div>`).join(''):'<p class="status">No transactions recorded.</p>'}`;
      if(typeof window.openGodModal==='function')window.openGodModal('Account activity',body);else show(body);
    }catch(e){show(e.message);}
  }

  async function renderAdminHist(){ await renderAdminFees(); }
  async function renderAdmin30d(){
    const el=$('admin30dList');if(!el)return;
    try{await loadAdminData();const grouped=new Map();state.platformFees.forEach(f=>{const d=new Date(f.created_at);const k=d.toLocaleDateString();grouped.set(k,(grouped.get(k)||0)+Number(f.amount||0));});el.innerHTML=panelError('platformFees')||([...grouped.entries()].slice(0,30).map(([day,amount])=>`<div class="hist-item"><b>${esc(day)}</b><b>${money(amount)}</b></div>`).join('')||'<p class="status">No platform fee records yet.</p>');}catch(e){el.innerHTML=`<p class="status">${esc(e.message)}</p>`;}
  }

  function unavailablePayouts(){put('withCount','—');const el=$('withList');if(el)el.innerHTML='<div class="notice">Secure withdrawal requests and payout approval are not installed. No payouts can be approved from this dashboard.</div>';}
  function unavailableLogs(){const el=$('logsList');if(el)el.innerHTML='<div class="notice">A server-side admin audit log has not been installed. Old browser-only logs are not reliable and are not shown here.</div>';}
  function disableUnsafeButtons(){
    document.querySelectorAll('[onclick="simulateWeather()"],[onclick="clearAdminFees()"],[onclick="clearLogs()"]').forEach(b=>{b.disabled=true;});
    const feeText=document.querySelector('#feesList');
    if(feeText && !feeText.dataset.adminManaged) feeText.dataset.adminManaged='true';
  }
  function unavailable(action){return function(){show(`${action} is not connected to a secure Supabase operation yet.`);};}

  window.getStats=getStats;window.renderUsers=renderUsers;window.godRecalculate=godRecalculate;
  window.renderAdminFees=renderAdminFees;window.godRenderOrders=godRenderOrders;window.godRenderProducts=godRenderProducts;
  window.godRenderLive=godRenderLive;window.godRenderEarnings=godRenderEarnings;window.godRenderProfits=godRenderProfits;window.godViewUserEarnings=godViewUserEarnings;
  window.renderAdminHist=renderAdminHist;window.renderAdmin30d=renderAdmin30d;
  window.renderWithdrawals=unavailablePayouts;window.renderLogs=unavailableLogs;
  window.godGetAllOrders=()=>state.orders.slice();window.godGetProducts=()=>state.products.slice();
  window.godGetBalance=()=>0;window.godGetEarnings=()=>0;window.addAudit=()=>{};
  window.godViewOrder=async id=>{await loadAdminData();const o=state.orders.find(x=>x.id===id);if(!o)return show('Order not found.');if(typeof window.openGodModal==='function')window.openGodModal('Order details',`<b>${esc(o.order_number)}</b><p>${esc(o.status)} • ${esc(o.payment_method)} / ${esc(o.payment_status)}</p><p>Total ${money(o.total)}</p>`);};
  window.godEditWallet=unavailable('Wallet changes');window.godDoSetBalance=unavailable('Wallet changes');window.godAddMoney=unavailable('Adding wallet funds');
  window.deleteUser=unavailable('Deleting an account');window.godDeleteOrder=unavailable('Deleting an order');
  window.approveWithdrawal=unavailable('Approving a withdrawal');window.rejectWithdrawal=unavailable('Rejecting a withdrawal');
  window.godViewBankDetails=unavailable('Viewing payout details');window.godViewAsUser=unavailable('Impersonating a user');
  window.clearLogs=unavailable('Clearing audit logs');window.clearAdminFees=unavailable('Resetting platform fees');window.simulateWeather=unavailable('Changing weather fees');
  window.openCashFlowHistory=unavailable('Cash flow history');
  window.getAllWithdrawsForBell=()=>[];

  async function refreshAll(force=false){
    try{await loadAdminData(force);await Promise.all([getStats(),renderUsers(),renderAdminFees(),godRecalculate(),godRenderOrders(),godRenderProducts(),godRenderLive(),godRenderEarnings(),godRenderProfits()]);unavailablePayouts();unavailableLogs();}
    catch(e){console.error('Admin Supabase dashboard could not load:',e);const msg=esc(e.message);['usersTbl','godOrdersList','godProductsList','godLiveList','godEarningsList','feesList','withList','logsList'].forEach(id=>{const el=$(id);if(el)el.innerHTML=`<p style="color:#ef4444">${msg}</p>`;});}
  }
  window.refreshAdminData=()=>refreshAll(true);
  function start(){disableUnsafeButtons();refreshAll(true);setInterval(()=>refreshAll(true),30000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
