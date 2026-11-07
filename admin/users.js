window.AdminUsers = {
  render(){
    let users=JSON.parse(localStorage.getItem('bhv2_users')||'{}');
    let el=document.getElementById('adminUsersList'); if(!el) return;
    let arr=Object.values(users);
    el.innerHTML=arr.length?arr.map(u=>`<div style="padding:10px;background:#111;border-radius:10px;margin-top:8px;border:1px solid #222;display:flex;justify-content:space-between"><div><b>${u.email}</b> • <span style="font-size:10px;background:#222;padding:3px 6px;border-radius:10px">${u.role}</span><div style="font-size:10px;color:#666">${u.created}</div></div></div>`).join(''):'No users';
  }
};