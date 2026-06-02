/* Focus Rocket PWA Service Worker */

const CACHE_VERSION = 'focus-rocket-v7-4-1';
const APP_SHELL = [
    './',
    './index.html',
    './css/app.css',
    './js/supabase-config.js',
    './js/db.js',
    './js/app.js',
    './js/metrics.js',
    './js/settings.js',
    './js/music.js',
    './js/leaderboard.js',
    './js/auth.js',
    './js/ai-proxy.js',
    './js/tasks.js',
    './js/timer.js',
    './js/bd-ai.js',
    './js/init.js',
    './assets/focus-rocket-logo.png',
    './assets/favicon-32.png',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

function isLocalAsset(url) {
    return url.origin === self.location.origin;
}

function isNavigationRequest(request) {
    return request.mode === 'navigate';
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (!isLocalAsset(url)) return;

    if (isNavigationRequest(request)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;

            return fetch(request).then((response) => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                }
                return response;
            });
        })
    );
});
