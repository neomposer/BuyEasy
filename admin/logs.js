window.AdminLogs = {
  render(){
    let logs=JSON.parse(localStorage.getItem('bhv2_admin_audit')||'[]');
    let el=document.getElementById('adminLogsList'); if(!el) return;
    el.innerHTML=logs.length?logs.map(l=>`<div style="padding:8px;background:#111;border-radius:10px;margin-top:6px;border:1px solid #222;font-size:11px"><b>${l.action}</b> • ${l.actor}<br><span style="color:#666">${l.details||''}</span><br><span style="color:#555;font-size:10px">${l.date}</span></div>`).join(''):'No logs';
  }
};