
/* ==========================================
   BUYEasy ADMIN AUTHENTICATION
   Supabase-based authentication
   ========================================== */

const ADMIN_LOGIN_PAGE = 'login.html';
const ADMIN_DASHBOARD_PAGE = 'dashboard.html';

let adminLoginInProgress = false;

/* ------------------------------------------
   DISPLAY MESSAGES
------------------------------------------ */

function showAdminMessage(message, type = 'err') {
    const element = document.getElementById(type);

    if (!element) return;

    element.textContent = message;
    element.style.display = 'block';
}

/* ------------------------------------------
   ADMIN LOGIN
------------------------------------------ */

async function adminLogin() {

    if (adminLoginInProgress) return;

    const email = document.getElementById('email')?.value
        .trim().toLowerCase();

    const password = document.getElementById('pass')?.value;

    const button = document.getElementById('loginBtn');

    const err = document.getElementById('err');
    const ok = document.getElementById('ok');

    if (err) err.style.display = 'none';
    if (ok) ok.style.display = 'none';

    if (!email || !password) {
        showAdminMessage('Enter email and password.');
        return;
    }

    if (!window.supabaseClient) {
        showAdminMessage('Supabase connection unavailable.');
        return;
    }

    adminLoginInProgress = true;

    if (button) {
        button.disabled = true;
        button.textContent = 'Verifying...';
    }

    try {

        // Authenticate with Supabase.
        const { data, error } =
            await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        if (!data.user) {
            throw new Error('Authentication failed.');
        }

        // Verify the actual database role.
        const { data: profile, error: profileError } =
            await window.supabaseClient
                .from('profiles')
                .select('id, email, role')
                .eq('id', data.user.id)
                .single();

        if (profileError) {
            await window.supabaseClient.auth.signOut();
            throw new Error('Unable to verify administrator permissions.');
        }

        if (!profile || profile.role !== 'admin') {
            await window.supabaseClient.auth.signOut();

            throw new Error(
                'Access denied. Administrator account required.'
            );
        }

        showAdminMessage(
            'Administrator verified. Redirecting...',
            'ok'
        );

        window.location.replace(ADMIN_DASHBOARD_PAGE);

    } catch (error) {

        console.error('Admin login error:', error);

        showAdminMessage(
            error.message || 'Administrator login failed.'
        );

        adminLoginInProgress = false;

        if (button) {
            button.disabled = false;
            button.textContent = 'Log In';
        }
    }
}


/* ------------------------------------------
   VERIFY ADMIN SESSION
------------------------------------------ */

async function checkAdminSession() {

    try {

        if (!window.supabaseClient) {
            window.location.replace(ADMIN_LOGIN_PAGE);
            return false;
        }

        const { data, error } =
            await window.supabaseClient.auth.getSession();

        if (error || !data.session) {
            window.location.replace(ADMIN_LOGIN_PAGE);
            return false;
        }

        // Verify administrator role from database.
        const { data: profile, error: profileError } =
            await window.supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', data.session.user.id)
                .single();

        if (profileError || !profile || profile.role !== 'admin') {

            await window.supabaseClient.auth.signOut();

            window.location.replace(ADMIN_LOGIN_PAGE);

            return false;
        }

        return true;

    } catch (error) {

        console.error('Admin session verification:', error);

        window.location.replace(ADMIN_LOGIN_PAGE);

        return false;
    }
}


/* ------------------------------------------
   ADMIN LOGOUT
------------------------------------------ */

async function adminLogout() {

    try {

        if (window.supabaseClient) {

            const { error } =
                await window.supabaseClient.auth.signOut();

            if (error) {
                console.error('Admin logout error:', error);
                showAdminMessage('Logout failed. Please try again.');
                return;
            }
        }

        window.location.replace(ADMIN_LOGIN_PAGE);

    } catch (error) {

        console.error('Admin logout error:', error);

        showAdminMessage('Unable to log out. Please try again.');
    }
}


/* ------------------------------------------
   FORGOT PASSWORD
------------------------------------------ */

async function forgot() {

    const email = document.getElementById('email')?.value
        .trim().toLowerCase();

    if (!email) {
        showAdminMessage('Enter your admin email first.');
        return;
    }

    if (!window.supabaseClient) {
        showAdminMessage('Supabase connection unavailable.');
        return;
    }

    try {

        const { error } =
            await window.supabaseClient.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo: window.location.origin +
                        '/admin/reset-password.html'
                }
            );

        if (error) throw error;

        showAdminMessage(
            'Password reset instructions have been sent if the account is eligible.',
            'ok'
        );

    } catch (error) {

        console.error('Password reset error:', error);

        showAdminMessage(
            'Unable to request password reset.'
        );
    }
}


/* ------------------------------------------
   COMPATIBILITY
------------------------------------------ */

window.adminLogin = adminLogin;
window.checkAdminSession = checkAdminSession;
window.adminLogout = adminLogout;
window.forgot = forgot;

window.AdminAuth = {

    checkSession: checkAdminSession,

    logout: adminLogout

};
