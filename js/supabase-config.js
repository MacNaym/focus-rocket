/* ============================================
   Focus Rocket - Supabase Config
   Public client config only. Never store DB passwords here.
   ============================================ */

const SUPABASE_URL = 'https://nuxmveburtfcwymtkcrf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ySlm-Akhu-2QdnVpC468cw_y2SJ8SIc';
const APP_URL = 'https://macnaym.github.io/focus-rocket/';

let focusRocketSupabase = null;

function getAppRedirectUrl() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
        return location.href.split('#')[0].split('?')[0];
    }
    return APP_URL;
}

function initSupabaseClient() {
    if (focusRocketSupabase) return focusRocketSupabase;

    if (!window.supabase?.createClient) {
        console.warn('Supabase client library not loaded');
        return null;
    }

    focusRocketSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    return focusRocketSupabase;
}
