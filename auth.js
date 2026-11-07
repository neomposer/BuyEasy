
// ======================================================
// BUYEasy AUTH.JS
// Supabase Authentication
// ======================================================


// ------------------------------------------------------
// 1. GENERAL MESSAGE HANDLER
// ------------------------------------------------------

function authMessage(message, type = 'err') {
    if (typeof window.showMsg === 'function') {
        window.showMsg(message, type);
        return;
    }

    if (typeof showMsg === 'function') {
        showMsg(message, type);
        return;
    }

    alert(message);
}


// ------------------------------------------------------
// 2. LEGACY USER HELPERS
// Kept temporarily for older dashboard compatibility.
// These do NOT authenticate users.
// ------------------------------------------------------

function getUsers() {
    try {
        const raw = localStorage.getItem('bhv2_users');

        if (!raw) return [];

        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        return Object.values(parsed);

    } catch (error) {
        console.error('Could not read legacy users:', error);
        return [];
    }
}


function getUsersObj() {
    try {
        const raw = localStorage.getItem('bhv2_users');

        if (!raw) return {};

        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            const users = {};

            parsed.forEach(user => {
                if (user.email) {
                    users[user.email.toLowerCase()] = user;
                }
            });

            return users;
        }

        return parsed;

    } catch (error) {
        console.error('Could not read legacy user object:', error);
        return {};
    }
}


// ------------------------------------------------------
// 3. REGISTER WITH SUPABASE
// ------------------------------------------------------

async function register() {

    const emailEl =
        document.getElementById('email') ||
        document.getElementById('r_email');

    const passwordEl =
        document.getElementById('password') ||
        document.getElementById('r_pass');

    const roleEl = document.getElementById('role');

    const email = emailEl
        ? emailEl.value.trim().toLowerCase()
        : '';

    const password = passwordEl
        ? passwordEl.value
        : '';

    const role = roleEl
        ? roleEl.value
        : (
            window.curRole ||
            document.querySelector('.role-box.active')
                ?.id?.replace('role-', '') ||
            'buyer'
        );

    if (!email || !password) {
        return authMessage('Enter your email and password.');
    }

    if (password.length < 6) {
        return authMessage('Password must contain at least 6 characters.');
    }

    if (!window.supabaseClient) {
        return authMessage('Database connection unavailable.');
    }

    // Store access is granted by admin approval of a buyer's store application.
    const allowedRoles = ['buyer'];

    if (!allowedRoles.includes(role)) {
        return authMessage('Invalid account type.');
    }

    const fullName =
        document.getElementById('full_name')?.value.trim() ||
        document.getElementById('name')?.value.trim() ||
        '';

    const phone =
        document.getElementById('phone')?.value.trim() || '';

    const storeName =
        document.getElementById('store_name')?.value.trim() || '';

    const address =
        document.getElementById('address')?.value.trim() || '';

    authMessage('Creating your account...', 'ok');

    try {

        const { data, error } =
            await window.supabaseClient.auth.signUp({

                email,
                password,

                options: {
                    data: {
                        full_name: fullName,
                        phone: phone,
                        account_type: role,
                        store_name: storeName,
                        address: address
                    }
                }

            });

        if (error) {
            console.error('Registration error:', error);

            return authMessage(
                'Registration failed: ' + error.message
            );
        }

        // Supabase may require email confirmation.
        if (!data.session) {

            return authMessage(
                'Account created. Please check your email to confirm your account.',
                'ok'
            );
        }

        // A session exists, so load the actual database profile.
        const { data: profile, error: profileError } =
            await window.supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

        if (profileError || !profile) {

            console.error('Profile loading error:', profileError);

            await window.supabaseClient.auth.signOut();

            return authMessage(
                'Account created, but your profile could not be loaded. Contact support.'
            );
        }

        localStorage.setItem('bhv2_email', data.user.email);
        localStorage.setItem('bhv2_role', profile.role);

        localStorage.setItem('v2_email', data.user.email);
        localStorage.setItem('v2_role', profile.role);

        authMessage('Account created successfully!', 'ok');

        setTimeout(() => {
            location.href = 'router.html';
        }, 800);

    } catch (error) {

        console.error('Registration exception:', error);

        authMessage('Registration failed. Please try again.');
    }
}


// ------------------------------------------------------
// 4. LOGIN WITH SUPABASE
// ------------------------------------------------------

async function login() {

    const emailEl = document.getElementById('l_email');
    const passwordEl = document.getElementById('l_pass');

    const email = emailEl
        ? emailEl.value.trim().toLowerCase()
        : '';

    const password = passwordEl
        ? passwordEl.value
        : '';

    if (!email || !password) {
        return authMessage('Enter email and password.');
    }

    if (!window.supabaseClient) {
        return authMessage('Database connection unavailable.');
    }

    authMessage('Signing in...', 'ok');

    try {

        const { data, error } =
            await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {

            console.error('Supabase login error:', error);

            return authMessage(
                'Login failed: ' + error.message
            );
        }

        if (!data.user) {
            return authMessage('Could not verify your account.');
        }

        // Retrieve the user's actual role from Supabase.
        const { data: profile, error: profileError } =
            await window.supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

        if (profileError || !profile) {

            console.error('Profile error:', profileError);

            await window.supabaseClient.auth.signOut();

            return authMessage(
                'Your account exists, but its profile could not be loaded.'
            );
        }

        const validRoles = ['buyer', 'store', 'rider', 'admin'];

        if (!validRoles.includes(profile.role)) {

            await window.supabaseClient.auth.signOut();

            return authMessage('Your account has an invalid role.');
        }

        // Keep these keys temporarily for dashboard compatibility.
        localStorage.setItem('bhv2_email', data.user.email);
        localStorage.setItem('bhv2_role', profile.role);

        localStorage.setItem('v2_email', data.user.email);
        localStorage.setItem('v2_role', profile.role);

        authMessage('Welcome! Redirecting...', 'ok');

        setTimeout(() => {
            location.href = 'router.html';
        }, 700);

    } catch (error) {

        console.error('Login exception:', error);

        authMessage('Login failed. Please try again.');
    }
}


// ------------------------------------------------------
// 5. ROUTE USER
// ------------------------------------------------------

function routeUser() {

    const role =
        localStorage.getItem('bhv2_role');

    switch (role) {

        case 'buyer':
            location.href = 'buyer-dashboard.html';
            break;

        case 'store':
            location.href = 'store-dashboard.html';
            break;

        case 'rider':
            location.href = 'rider-dashboard.html';
            break;

        case 'admin':
            location.href = 'admin/dashboard.html';
            break;

        default:
            location.href = 'index.html';
    }
}


// ------------------------------------------------------
// 6. LOGOUT WITH SUPABASE
// ------------------------------------------------------

async function logout() {

    try {

        if (window.supabaseClient) {

            const { error } =
                await window.supabaseClient.auth.signOut();

            if (error) {
                console.error('Logout error:', error);
            }
        }

    } catch (error) {

        console.error('Logout exception:', error);

    } finally {

        localStorage.removeItem('bhv2_email');
        localStorage.removeItem('bhv2_role');

        localStorage.removeItem('v2_email');
        localStorage.removeItem('v2_role');

        location.href = 'index.html';
    }
}


// ------------------------------------------------------
// 7. PUBLIC AUTH HELPERS
// Temporary compatibility checks for existing dashboards.
// These are NOT a replacement for Supabase RLS.
// ------------------------------------------------------

window.PublicAuth = window.PublicAuth || {

    checkRole(required) {

        const role =
            localStorage.getItem('bhv2_role');

        const email =
            localStorage.getItem('bhv2_email');

        if (!email || !role) {
            return false;
        }

        if (required && role !== required) {
            return false;
        }

        return true;
    }

};


window.checkPublicSession = function() {

    return !!localStorage.getItem('bhv2_email');

};


// ------------------------------------------------------
// 8. EXPOSE AUTH FUNCTIONS
// ------------------------------------------------------

window.getUsers = getUsers;
window.getUsersObj = getUsersObj;

window.register = register;
window.login = login;

window.routeUser = routeUser;
window.logout = logout;

console.log('BUYEasy Supabase authentication loaded.');
