/* ============================================
   Focus Rocket — INIT Module
   DOMContentLoaded & global event listeners
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inizializza database (IndexedDB + migrazione)
    await initDatabase();

    // 2. UI init
    createParticles();

    // 3. Sound state
    const savedSound = await DB.getSetting('fr_sound_enabled');
    if (savedSound === 'true' || savedSound === true) {
        AudioEngine.enabled = true;
        document.getElementById('soundToggle').classList.add('active');
        document.getElementById('soundIcon').textContent = '🔊';
        document.getElementById('soundText').textContent = 'Suono ON';
    }

    // 4. Notifications
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // 5. Keyboard shortcuts
    document.addEventListener('keydown', e => {
        const isInput = e.target.matches('input, textarea, select, [contenteditable="true"]');
        if (e.code === 'Space' && !isInput) { e.preventDefault(); toggleTimer(); }
        if (e.code === 'KeyR' && !isInput) resetTimer();
    });

    // 6. Visibility
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isRunning) console.log('Tab nascosto — timer continua');
    });

    // 7. Offline/Online
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // 8. Music init
    renderFavorites();
    renderCustomMusic();

    // 9. Body Doubling init
    initBodyDoubling();

    console.log('🚀 Focus Rocket initialized');
});
