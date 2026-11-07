// main.js — GLOBAL guards — Enforces NO mixing
(function(){
  // Public dashboards must have bhv2_session, Admin must have bhv2_admin_session ONLY
  let path = location.pathname;
  
  // If opening /admin/*, don't allow public session alone
  if(path.includes('/admin/') && path.includes('dashboard.html')){
    let adm = JSON.parse(localStorage.getItem('bhv2_admin_session')||'null');
    if(!adm || Date.now() > adm.expiresAt){
      location.href='login.html';
    }
  }
  
  window.publicLogout = function(){
    localStorage.removeItem('bhv2_session');
    location.href='index.html';
  };
  
  window.getActiveRole = function(){
    let pub = JSON.parse(localStorage.getItem('bhv2_session')||'null');
    let adm = JSON.parse(localStorage.getItem('bhv2_admin_session')||'null');
    if(adm && Date.now() <= adm.expiresAt) return 'admin';
    if(pub) return pub.role;
    return null;
  };
})();