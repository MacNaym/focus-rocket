/* ============================================
   Focus Rocket - Supabase Auth
   Email/password auth. Google OAuth is parked as a nice-to-have.
   ============================================ */

let authInitialized = false;
let authUser = null;
let accountMenuInitialized = false;

async function initAuth() {
    initAccountMenuUI();

    const client = initSupabaseClient();
    if (!client) {
        renderAuthState(null);
        return null;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
        console.error('Auth session error:', error);
        showToast('Errore sessione Supabase', 'warn');
    }

    authUser = data?.session?.user || null;
    if (authUser) {
        initSync(client, authUser);
        if (typeof refreshBillingProfile === 'function') await refreshBillingProfile({ silent: true });
    } else {
        disableSync();
        if (typeof resetBillingProfile === 'function') resetBillingProfile();
    }

    renderAuthState(authUser);

    if (!authInitialized) {
        client.auth.onAuthStateChange(async (_event, session) => {
            authUser = session?.user || null;
            if (authUser) {
                initSync(client, authUser);
                await syncAllData();
                if (typeof refreshBillingProfile === 'function') await refreshBillingProfile({ silent: true });
            } else {
                disableSync();
                if (typeof resetBillingProfile === 'function') resetBillingProfile();
            }
            renderAuthState(authUser);
        });
        authInitialized = true;
    }

    return authUser;
}

function initAccountMenuUI() {
    if (accountMenuInitialized) return;
    document.addEventListener('click', event => {
        const wrapper = document.getElementById('accountMenuWrapper');
        if (wrapper && !wrapper.contains(event.target)) closeAccountMenu();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeAccountMenu();
    });
    accountMenuInitialized = true;
}

function toggleAccountMenu(event) {
    event?.stopPropagation();
    const dropdown = document.getElementById('accountDropdown');
    const toggle = document.getElementById('accountMenuToggle');
    if (!dropdown || !toggle) return;

    const isOpen = dropdown.classList.toggle('active');
    toggle.classList.toggle('active', isOpen);
}

function closeAccountMenu() {
    document.getElementById('accountDropdown')?.classList.remove('active');
    document.getElementById('accountMenuToggle')?.classList.remove('active');
}

function getAccountInitials(user) {
    if (!user) return '👤';

    const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
    if (name.trim()) {
        return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    }

    if (user.email) return user.email.slice(0, 2).toUpperCase();
    return '👤';
}

function updateAccountAvatar(user) {
    const value = getAccountInitials(user);
    const label = user?.email || user?.user_metadata?.full_name || 'Non connesso';
    const avatar = document.getElementById('accountAvatarText');
    const preview = document.getElementById('accountAvatarPreview');
    const subtitle = document.getElementById('accountDropdownSubtitle');

    if (avatar) avatar.textContent = value;
    if (preview) preview.textContent = value;
    if (subtitle) subtitle.textContent = label;
}

function renderAuthState(user) {
    const status = document.getElementById('authStatus');
    const email = document.getElementById('authEmail');
    const password = document.getElementById('authPassword');
    const signedOut = document.getElementById('authSignedOutControls');
    const signedIn = document.getElementById('authSignedInControls');
    const userEmail = document.getElementById('authUserEmail');

    updateAccountAvatar(user);

    if (!status) return;

    if (user) {
        status.textContent = 'Connesso';
        status.classList.add('online');
        if (userEmail) userEmail.textContent = user.email || 'Account';
        if (signedOut) signedOut.style.display = 'none';
        if (signedIn) signedIn.style.display = 'block';
        if (email) email.value = '';
        if (password) password.value = '';
    } else {
        status.textContent = focusRocketSupabase ? 'Non connesso' : 'Supabase non disponibile';
        status.classList.remove('online');
        if (userEmail) userEmail.textContent = '';
        if (signedOut) signedOut.style.display = 'block';
        if (signedIn) signedIn.style.display = 'none';
    }
}

function getAuthCredentials() {
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value;

    if (!email || !password) {
        showToast('Inserisci email e password', 'warn');
        return null;
    }

    if (password.length < 6) {
        showToast('La password deve avere almeno 6 caratteri', 'warn');
        return null;
    }

    return { email, password };
}

async function signUpWithEmail() {
    const client = initSupabaseClient();
    const credentials = getAuthCredentials();
    if (!client || !credentials) return;

    const { data, error } = await client.auth.signUp({
        ...credentials,
        options: { emailRedirectTo: getAppRedirectUrl() }
    });

    if (error) {
        showToast('Registrazione fallita: ' + error.message, 'warn');
        return;
    }

    if (data.user && !data.session) {
        showToast('Controlla la mail per confermare l account', 'info');
    } else {
        showToast('Account creato', 'success');
    }
}

async function signInWithEmail() {
    const client = initSupabaseClient();
    const credentials = getAuthCredentials();
    if (!client || !credentials) return;

    const { error } = await client.auth.signInWithPassword(credentials);
    if (error) {
        showToast('Login fallito: ' + error.message, 'warn');
        return;
    }

    showToast('Login effettuato', 'success');
}

async function signInWithGoogle() {
    showToast('Login Google coming soon', 'info');
}

async function signOut() {
    const client = initSupabaseClient();
    if (!client) return;

    const { error } = await client.auth.signOut();
    if (error) {
        showToast('Logout fallito: ' + error.message, 'warn');
        return;
    }

    disableSync();
    if (typeof resetBillingProfile === 'function') resetBillingProfile();
    renderAuthState(null);
    showToast('Logout effettuato', 'info');
}

async function syncNow() {
    if (!syncEnabled) {
        showToast('Accedi per sincronizzare', 'warn');
        return;
    }

    await syncAllData();
    showToast('Sync completato', 'success');
}
