// admin/utils.js — ADMIN ONLY helpers
window.ADMIN = {
  guard(){
    let sess = JSON.parse(localStorage.getItem('bhv2_admin_session')||'null');
    if(!sess || Date.now() > sess.expiresAt){
      localStorage.removeItem('bhv2_admin_session');
      location.href='login.html'; return false;
    }
    return true;
  },
  log(action, actor, details){
    let logs = JSON.parse(localStorage.getItem('bhv2_admin_audit')||'[]');
    logs.unshift({action, actor, details, date:new Date().toLocaleString(), ts:Date.now()});
    localStorage.setItem('bhv2_admin_audit', JSON.stringify(logs.slice(0,300)));
  },
  done(msg){
    if(window.showDone) showDone(msg); else alert(msg);
  }
};
window.adminLogout = function(){
  let sess = JSON.parse(localStorage.getItem('bhv2_admin_session')||'{}');
  if(sess.email) ADMIN.log('admin_logout', sess.email, 'Logged out');
  localStorage.removeItem('bhv2_admin_session');
  location.href='login.html';
};