/* ============================================
   Focus Rocket - AI Proxy Client
   Calls Supabase Edge Function. No OpenAI keys in the browser.
   ============================================ */

const AI_PROXY_FUNCTION = 'openai-proxy';

const AI_MODEL_FALLBACKS = {
    'gpt-5.4-nano': 'gpt-4.1-nano'
};

function getSelectedAiModel() {
    const saved = localStorage.getItem('openaiModel') || 'gpt-4.1-nano';
    return AI_MODEL_FALLBACKS[saved] || saved;
}

async function getCurrentAuthSession(client) {
    if (!client) return null;

    const { data, error } = await client.auth.getSession();
    if (error) {
        console.error('AI auth session error:', error);
        return null;
    }

    return data?.session || null;
}

async function callAiProxy({ messages, model, maxTokens = 250, temperature = 0.7, feature = 'focus_rocket' }) {
    const client = initSupabaseClient();
    if (!client) {
        throw new Error('Supabase non disponibile');
    }

    const session = await getCurrentAuthSession(client);
    if (!session?.user) {
        throw new Error('Accedi per usare le funzioni AI');
    }

    const { data, error } = await client.functions.invoke(AI_PROXY_FUNCTION, {
        body: {
            feature,
            model: model || getSelectedAiModel(),
            messages,
            max_tokens: maxTokens,
            temperature
        }
    });

    if (error) {
        throw new Error(error.message || 'Edge Function non raggiungibile');
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    if (!data?.text) {
        throw new Error('Risposta AI vuota');
    }

    return data;
}

function trackAiCost(estimatedCost = 0) {
    const cost = Number(estimatedCost) || 0;
    if (cost <= 0) return 0;

    bdTotalCost += cost;
    localStorage.setItem('bdTotalCost', bdTotalCost.toString());
    if (typeof DB !== 'undefined' && DB.updateBdCost) {
        DB.updateBdCost(bdSessionCost || 0, bdTotalCost);
    }
    if (typeof updateCostDisplays === 'function') {
        updateCostDisplays();
    }

    return cost;
}
