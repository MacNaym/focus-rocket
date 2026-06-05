/* ============================================
   Focus Rocket - Billing State
   Reads Supabase billing profile and exposes Free/Pro gates.
   ============================================ */

const BILLING_DEFAULT_PROFILE = {
    plan: 'free',
    subscription_status: null,
    current_period_end: null,
    cancel_at_period_end: false
};

let billingProfile = { ...BILLING_DEFAULT_PROFILE };
let billingLoaded = false;

function resetBillingProfile() {
    billingProfile = { ...BILLING_DEFAULT_PROFILE };
    billingLoaded = false;
    renderBillingState();
}

function isProUser() {
    if (!billingProfile || billingProfile.plan !== 'pro') return false;
    const status = billingProfile.subscription_status;
    return !status || ['active', 'trialing'].includes(status);
}

function getBillingPlanLabel() {
    return isProUser() ? 'Pro' : 'Free';
}

async function refreshBillingProfile(options = {}) {
    const { silent = false } = options;
    const client = initSupabaseClient();
    if (!client) {
        resetBillingProfile();
        return billingProfile;
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
        console.error('Billing session error:', sessionError);
        if (!silent) showToast('Errore sessione billing', 'warn');
        resetBillingProfile();
        return billingProfile;
    }

    const user = sessionData?.session?.user;
    if (!user) {
        resetBillingProfile();
        return billingProfile;
    }

    const { data, error } = await client
        .from('fr_billing_profiles')
        .select('plan, subscription_status, current_period_end, cancel_at_period_end, stripe_price_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('Billing profile error:', error);
        if (!silent) showToast('Impossibile leggere il piano account', 'warn');
        billingProfile = { ...BILLING_DEFAULT_PROFILE };
    } else {
        billingProfile = { ...BILLING_DEFAULT_PROFILE, ...(data || {}) };
    }

    billingLoaded = true;
    renderBillingState();
    return billingProfile;
}

async function ensureProFeature(featureLabel = 'Questa funzione') {
    if (!authUser) {
        showToast('Accedi per usare ' + featureLabel, 'warn');
        return false;
    }

    if (!billingLoaded) {
        await refreshBillingProfile({ silent: true });
    }

    if (isProUser()) return true;

    showToast(featureLabel + ' richiede Focus Rocket Pro', 'warn');
    return false;
}

function renderBillingState() {
    const status = document.getElementById('pricingAccountStatus');
    const freeButton = document.getElementById('freePlanButton');
    const proButton = document.getElementById('proCheckoutButton');
    const authPlan = document.getElementById('authPlanLabel');
    const plan = getBillingPlanLabel();

    if (authPlan) authPlan.textContent = plan;

    if (status) {
        if (!authUser) {
            status.textContent = 'Accedi per vedere il tuo piano e passare a Pro.';
        } else if (isProUser()) {
            status.textContent = 'Piano attuale: Pro';
        } else {
            status.textContent = 'Piano attuale: Free';
        }
    }

    if (freeButton) {
        freeButton.textContent = isProUser() ? 'Piano Free' : 'Piano attuale';
        freeButton.disabled = !authUser || !isProUser();
    }

    if (proButton) {
        if (!authUser) {
            proButton.textContent = 'Accedi per passare a Pro';
            proButton.disabled = false;
        } else if (isProUser()) {
            proButton.textContent = 'Piano Pro attivo';
            proButton.disabled = true;
        } else {
            proButton.textContent = 'Passa a Pro';
            proButton.disabled = false;
        }
    }
}
