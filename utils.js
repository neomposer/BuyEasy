// utils.js - FINAL Phase 5 - Global Done + Loader + Money Helpers

window.Utils = window.Utils || {};

window.Utils.done = function(msg, ms){
  ms = ms || 2800;
  let old = document.getElementById('bhv2-done-popup');
  if(old) old.remove();
  
  let div = document.createElement('div');
  div.id = 'bhv2-done-popup';
  div.style.cssText = `
    position:fixed; top:20px; left:50%; transform:translateX(-50%);
    background:#111; color:#fff; padding:14px 22px; border-radius:14px;
    font-family:system-ui, sans-serif; font-weight:700; font-size:14px;
    box-shadow:0 10px 30px rgba(0,0,0,.3); z-index:99999;
    display:flex; align-items:center; gap:10px;
    animation: bhv2SlideIn .3s ease;
  `;
  div.innerHTML = `<span style="background:#22c55e;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center">✓</span> ${msg}`;
  
  let style = document.createElement('style');
  style.innerHTML = `@keyframes bhv2SlideIn{from{opacity:0;transform:translate(-50%,-20px)}to{opacity:1;transform:translate(-50%,0)}}`;
  
  document.head.appendChild(style);
  document.body.appendChild(div);
  
  setTimeout(()=>{ 
    div.style.transition='all .3s'; 
    div.style.opacity='0'; 
    div.style.transform='translate(-50%,-10px)'; 
    setTimeout(()=>div.remove(), 300);
  }, ms);
};

window.Utils.loader = function(show, text){
  let id='bhv2-loader';
  let el=document.getElementById(id);
  if(show){
    if(el) el.remove();
    el=document.createElement('div');
    el.id=id;
    el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    el.innerHTML=`<div style="background:#fff;padding:24px 32px;border-radius:16px;font-weight:700;display:flex;gap:12px;align-items:center"><span style="width:20px;height:20px;border:3px solid #ddd;border-top-color:#000;border-radius:50%;display:inline-block;animation:spin 1s linear infinite"></span> ${text||'Processing...'}</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(el);
  } else {
    if(el) el.remove();
  }
};

window.Utils.money = function(n){ return 'R'+ (parseFloat(n)||0).toFixed(2); };

window.Utils.logAudit = function(role, action, data){
  try{
    let arr=JSON.parse(localStorage.getItem('bhv2_admin_audit')||'[]');
    arr.push({role, action, data, time:new Date().toISOString(), email: JSON.parse(localStorage.getItem('bhv2_session')||'{}').email||'system'});
    localStorage.setItem('bhv2_admin_audit', JSON.stringify(arr.slice(-200)));
  }catch{}
};

// Backward compat for old RiderJobs.accept that calls Utils.done
window.Utils.toast = window.Utils.done;

// Make sure FLOW is available everywhere
if(!window.FLOW && typeof FLOW!=='undefined') window.FLOW=FLOW;

console.log('✅ utils.js Phase 5 loaded — Done popup ready');