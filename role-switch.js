/* Dashboard role switches are approved and applied by Supabase. */
window.switchDashboardRole = async function(role, target) {
  const db=window.supabaseClient;
  if(!db) return alert('Supabase is not connected.');
  try { const {error}=await db.rpc('switch_dashboard_role',{p_role:role}); if(error) throw error; location.href=target; }
  catch(error) { alert(error.message||'This dashboard is not approved for your account yet.'); }
};
