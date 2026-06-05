/* ============================================
   Focus Rocket - Pricing
   Stripe Checkout entrypoints.
   ============================================ */

let pricingVisible = false;
let pricingInterval = 'monthly';

function togglePricing() {
    if (leaderboardVisible) toggleLeaderboard();
    if (settingsVisible) toggleSettings();
    if (musicVisible) toggleMusic();
    if (metricsVisible) toggleMetrics();

    pricingVisible = !pricingVisible;
    const btn = document.getElementById('pricingToggle');
    const text = document.getElementById('pricingText');
    const section = document.getElementById('pricingSection');
    const main = document.getElementById('mainGrid');

    if (pricingVisible) {
        btn?.classList.add('active');
        if (text) text.textContent = 'Pricing ON';
        section?.classList.add('active');
        if (main) main.style.display = 'none';
        renderPricingState();
    } else {
        btn?.classList.remove('active');
        if (text) text.textContent = 'Pricing';
        section?.classList.remove('active');
        if (main) main.style.display = 'grid';
    }
}

function closePricingSection() {
    pricingVisible = false;
    document.getElementById('pricingToggle')?.classList.remove('active');
    const text = document.getElementById('pricingText');
    if (text) text.textContent = 'Pricing';
    document.getElementById('pricingSection')?.classList.remove('active');
}

function setPricingInterval(interval) {
    pricingInterval = interval === 'yearly' ? 'yearly' : 'monthly';
    document.querySelectorAll('.pricing-segment').forEach((btn) => btn.classList.remove('active'));
    document.getElementById('pricingSegment-' + pricingInterval)?.classList.add('active');
    renderPricingState();
}

function renderPricingState() {
    const price = pricingInterval === 'yearly' ? '49 EUR' : '4,99 EUR';
    const cadence = pricingInterval === 'yearly' ? 'anno' : 'mese';
    const note = pricingInterval === 'yearly' ? 'Risparmi circa due mesi rispetto al mensile.' : 'Cancelli quando vuoi.';

    const amount = document.getElementById('proPriceAmount');
    const period = document.getElementById('proPricePeriod');
    const pricingNote = document.getElementById('proPriceNote');
    if (amount) amount.textContent = price;
    if (period) period.textContent = '/' + cadence;
    if (pricingNote) pricingNote.textContent = note;
    if (typeof renderBillingState === 'function') renderBillingState();
}

async function startProCheckout(interval = pricingInterval) {
    const client = initSupabaseClient();
    if (!client) {
        showToast('Supabase non disponibile', 'warn');
        return;
    }

    const { data } = await client.auth.getSession();
    if (!data?.session?.user) {
        showToast('Accedi per passare a Pro', 'warn');
        return;
    }

    if (typeof isProUser === 'function' && isProUser()) {
        showToast('Il piano Pro e gia attivo', 'info');
        renderPricingState();
        return;
    }

    try {
        const { data: checkout, error } = await client.functions.invoke('create-checkout-session', {
            body: { interval }
        });

        if (error) throw error;
        if (!checkout?.url) throw new Error('Checkout URL mancante');

        location.href = checkout.url;
    } catch (err) {
        console.error('Checkout error:', err);
        showToast('Checkout non disponibile: ' + err.message, 'warn');
    }
}

function handleCheckoutReturn() {
    const params = new URLSearchParams(location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;

    if (checkout === 'success') {
        showToast('Pagamento completato. Il piano Pro sara attivo tra poco.', 'success');
        if (typeof refreshBillingProfile === 'function') {
            setTimeout(() => refreshBillingProfile({ silent: true }), 1500);
        }
    }
    if (checkout === 'cancel') showToast('Checkout annullato', 'info');

    params.delete('checkout');
    const cleanUrl = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
    history.replaceState({}, '', cleanUrl);
}

document.addEventListener('DOMContentLoaded', () => {
    renderPricingState();
    handleCheckoutReturn();
});
