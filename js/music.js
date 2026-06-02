/* ============================================
   Focus Rocket - MUSIC Module
   Playlist-aware YouTube player
   ============================================ */

// ===== MUSIC TOGGLE & PLAYER =====
let musicVisible = false;
let currentMusicId = null;
let currentMusicTitle = '';
let favorites = [];
let customMusic = [];
let currentTab = 'focus';
let miniPlayerPaused = false;

const MUSIC_CATALOG = {
    'focus-1': { title: 'Lofi Focus Mix', type: 'playlist', playlistId: 'PLEk6Wbhjz3Kj7REM0LxhH-zwWomD_pIoC' },
    'focus-2': { title: 'Deep Focus Piano', type: 'playlist', playlistId: 'PLiBMkrt8YJuyBmRpEllTbzCald-m2jkze' },
    'focus-3': { title: 'Deep Zone Flow', type: 'playlist', playlistId: 'PLUrnxvhuvpSU0b2YvM4Gf1V3bHnLAcvBj' },
    'relax-1': { title: 'Ocean Waves Meditation', type: 'playlist', playlistId: 'PL9Om53KBCx3gtPk0xOoXexPHoFRCOxSYr' },
    'relax-2': { title: 'Forest Ambience', type: 'playlist', playlistId: 'PLlScwXI2tz6XMJxox0uk9fDGlkumUswxG' },
    'energy-1': { title: 'Epic Motivation', type: 'playlist', playlistId: 'PLeOp6aqjiqlYn25jLz2rhXbwcASBGv8eS' },
    'energy-2': { title: 'Upbeat Work Mix', type: 'playlist', playlistId: 'PLYYxwRKblWawcpEsVWNvfGB22NbxeyUc2' }
};

function getYouTubeOrigin() {
    return location.origin && location.origin !== 'null' && !location.origin.startsWith('file:')
        ? location.origin
        : 'https://focusrocket.app';
}

function buildYouTubeSrc(item, autoplay = false) {
    const params = new URLSearchParams({
        enablejsapi: '1',
        origin: getYouTubeOrigin(),
        rel: '0',
        playsinline: '1'
    });
    if (autoplay) params.set('autoplay', '1');

    if (item.type === 'playlist') {
        params.set('list', item.playlistId);
        return 'https://www.youtube.com/embed/videoseries?' + params.toString();
    }

    if (item.type === 'search') {
        params.set('listType', 'search');
        params.set('list', item.query);
        return 'https://www.youtube.com/embed?' + params.toString();
    }

    return 'https://www.youtube.com/embed/' + item.videoId + '?' + params.toString();
}

function sendYouTubeCommand(iframe, command) {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: command,
        args: []
    }), '*');
}

function getMusicItem(id) {
    if (MUSIC_CATALOG[id]) return MUSIC_CATALOG[id];
    return customMusic.find(m => m.id === id) || favorites.find(f => f.id === id) || null;
}

function getCurrentMusicIframe() {
    if (!currentMusicId) return null;
    return document.getElementById('iframe-' + currentMusicId);
}

function normalizeMusicItem(item) {
    if (item.playlistId) return { ...item, type: 'playlist' };
    if (item.query) return { ...item, type: 'search' };
    return { ...item, type: 'video' };
}

async function loadMusicData() {
    favorites = (await DB.getMusicFavorites()).map(normalizeMusicItem);
    customMusic = (await DB.getMusicCustom()).map(normalizeMusicItem);
}

function applyBuiltInMusicCatalog() {
    Object.entries(MUSIC_CATALOG).forEach(([id, item]) => {
        const iframe = document.getElementById('iframe-' + id);
        if (iframe) {
            iframe.dataset.src = buildYouTubeSrc(item, false);
            iframe.loading = 'lazy';
            if (!iframe.getAttribute('src')) iframe.src = 'about:blank';
        }
    });
}

async function toggleMusic() {
    if (leaderboardVisible) toggleLeaderboard();
    if (settingsVisible) toggleSettings();
    if (metricsVisible) toggleMetrics();

    musicVisible = !musicVisible;
    const btn = document.getElementById('musicToggle');
    const txt = document.getElementById('musicText');
    const sec = document.getElementById('musicSection');
    const main = document.getElementById('mainGrid');

    if (musicVisible) {
        btn.classList.add('active');
        txt.textContent = 'Music ON';
        sec.classList.add('active');
        main.style.display = 'none';
        await loadMusicData();
        applyBuiltInMusicCatalog();
        renderFavorites();
        renderCustomMusic();
        showToast('Musica aperta', 'success');
    } else {
        btn.classList.remove('active');
        txt.textContent = 'Music';
        sec.classList.remove('active');
        main.style.display = 'grid';
        showToast('Torna al Timer', 'info');
    }
}

function switchMusicTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.music-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.music-tab-content').forEach(c => c.style.display = 'none');
    event.target.closest('.music-tab').classList.add('active');
    document.getElementById('tab-' + tab).style.display = 'block';
}

function playMusic(id, title) {
    const item = normalizeMusicItem(getMusicItem(id) || { id, title, videoId: id });
    const iframe = document.getElementById('iframe-' + id);

    document.querySelectorAll('.music-card iframe').forEach(frame => {
        if (frame !== iframe) sendYouTubeCommand(frame, 'pauseVideo');
    });
    document.querySelectorAll('.music-card').forEach(c => c.classList.remove('playing'));

    const card = document.getElementById('music-' + id);
    if (card) card.classList.add('playing');

    if (iframe) {
        const targetSrc = buildYouTubeSrc(item, true);
        if (iframe.src !== targetSrc) iframe.src = targetSrc;
        setTimeout(() => sendYouTubeCommand(iframe, 'playVideo'), 400);
    }

    currentMusicId = id;
    currentMusicTitle = title || item.title || 'Playlist';
    miniPlayerPaused = false;

    document.getElementById('miniPlayer').classList.add('active');
    document.getElementById('miniPlayerTitle').textContent = currentMusicTitle;
    const pauseBtn = document.getElementById('miniPlayerPauseBtn');
    if (pauseBtn) pauseBtn.textContent = '⏸️';

    showToast(currentMusicTitle + ' in riproduzione', 'success');
}

function pauseActiveMusic(silent = false) {
    const iframe = getCurrentMusicIframe();
    if (!iframe) return;

    sendYouTubeCommand(iframe, 'pauseVideo');
    miniPlayerPaused = true;
    const pauseBtn = document.getElementById('miniPlayerPauseBtn');
    if (pauseBtn) pauseBtn.textContent = '▶️';

    if (!silent) showToast('Musica in pausa', 'info');
}

function resumeActiveMusic() {
    const iframe = getCurrentMusicIframe();
    if (!iframe) return;

    sendYouTubeCommand(iframe, 'playVideo');
    miniPlayerPaused = false;
    const pauseBtn = document.getElementById('miniPlayerPauseBtn');
    if (pauseBtn) pauseBtn.textContent = '⏸️';
    showToast('Musica ripresa', 'info');
}

function previousTrack() {
    const iframe = getCurrentMusicIframe();
    const item = getMusicItem(currentMusicId);
    if (!iframe || !item) return;

    if (item.type === 'video' && !item.playlistId) {
        showToast('Questo elemento non ha una playlist da scorrere', 'warn');
        return;
    }
    sendYouTubeCommand(iframe, 'previousVideo');
}

function nextTrack() {
    const iframe = getCurrentMusicIframe();
    const item = getMusicItem(currentMusicId);
    if (!iframe || !item) return;

    if (item.type === 'video' && !item.playlistId) {
        showToast('Questo elemento non ha una playlist da scorrere', 'warn');
        return;
    }
    sendYouTubeCommand(iframe, 'nextVideo');
}

function toggleFavorite(id, title, videoId) {
    const catalogItem = normalizeMusicItem(getMusicItem(id) || { id, title, videoId });
    const idx = favorites.findIndex(f => f.id === id);
    const btn = document.getElementById('fav-' + id);

    if (idx >= 0) {
        favorites.splice(idx, 1);
        if (btn) { btn.textContent = '🤍 Preferito'; btn.classList.remove('favorited'); }
        showToast('Rimosso dai preferiti', 'info');
    } else {
        favorites.push({ ...catalogItem, id, title, added: new Date().toISOString() });
        if (btn) { btn.textContent = '❤️ Preferito'; btn.classList.add('favorited'); }
        showToast('Aggiunto ai preferiti', 'success');
    }

    DB.saveMusicFavorites(favorites);
    renderFavorites();
}

function renderFavorites() {
    const grid = document.getElementById('favoritesGrid');
    if (!grid) return;

    if (favorites.length === 0) {
        grid.innerHTML = '<div class="music-empty">Nessun preferito ancora. Clicca 🤍 su una playlist per salvarla.</div>';
        return;
    }

    grid.innerHTML = favorites.map(f => `
        <div class="music-fav-item" onclick="playMusic('${f.id}', '${f.title.replace(/'/g, "\\'")}')">
            <span>🎵</span>
            <span class="fav-title">${f.title}</span>
            <button class="fav-remove" onclick="event.stopPropagation(); removeFavorite('${f.id}')">🗑️</button>
        </div>
    `).join('');

    favorites.forEach(f => {
        const btn = document.getElementById('fav-' + f.id);
        if (btn) { btn.textContent = '❤️ Preferito'; btn.classList.add('favorited'); }
    });
}

function removeFavorite(id) {
    favorites = favorites.filter(f => f.id !== id);
    DB.saveMusicFavorites(favorites);
    const btn = document.getElementById('fav-' + id);
    if (btn) { btn.textContent = '🤍 Preferito'; btn.classList.remove('favorited'); }
    renderFavorites();
    showToast('Rimosso dai preferiti', 'info');
}

function parseYouTubeInput(value) {
    let parsedUrl = null;
    try { parsedUrl = new URL(value); } catch { parsedUrl = null; }

    if (parsedUrl) {
        const playlistId = parsedUrl.searchParams.get('list');
        if (playlistId) return { type: 'playlist', playlistId };

        const videoId = parsedUrl.searchParams.get('v')
            || parsedUrl.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/)?.[1]
            || parsedUrl.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)?.[1]
            || (parsedUrl.hostname.includes('youtu.be') ? parsedUrl.pathname.replace('/', '') : '');

        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return { type: 'video', videoId };
    }

    if (/^PL|^RD|^OLAK5uy_|^UU/.test(value)) return { type: 'playlist', playlistId: value };
    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return { type: 'video', videoId: value };

    return null;
}

function addCustomMusic() {
    const urlInput = document.getElementById('customMusicUrl');
    const nameInput = document.getElementById('customMusicName');
    const url = urlInput.value.trim();
    const name = nameInput.value.trim() || 'Custom Playlist';

    if (!url) { showToast('Inserisci un URL YouTube o un ID playlist/video', 'warn'); return; }

    const media = parseYouTubeInput(url);
    if (!media) { showToast('URL YouTube non valido', 'warn'); return; }

    const id = 'custom-' + Date.now();
    customMusic.push({ id, title: name, ...media, added: new Date().toISOString() });
    DB.saveMusicCustom(customMusic);

    urlInput.value = '';
    nameInput.value = '';
    renderCustomMusic();
    showToast('Playlist custom aggiunta', 'success');
}

function renderCustomMusic() {
    const grid = document.getElementById('customMusicGrid');
    if (!grid) return;

    if (customMusic.length === 0) {
        grid.innerHTML = '<div class="music-empty">Nessuna playlist custom ancora. Aggiungi un link YouTube.</div>';
        return;
    }

    grid.innerHTML = customMusic.map(m => {
        const item = normalizeMusicItem(m);
        return `
            <div class="music-card" id="music-${m.id}" data-id="${m.id}">
                <div class="music-card-header">
                    <div class="music-card-icon custom">🎧</div>
                    <div>
                        <div class="music-card-title">${m.title}</div>
                        <div class="music-card-subtitle">${item.type === 'playlist' ? 'Playlist personalizzata' : 'Video personalizzato'}</div>
                    </div>
                </div>
                <div class="music-embed">
                    <iframe id="iframe-${m.id}" src="about:blank" data-src="${buildYouTubeSrc(item, false)}" loading="lazy" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
                </div>
                <div class="music-card-actions">
                    <button class="music-action-btn" onclick="playMusic('${m.id}', '${m.title.replace(/'/g, "\\'")}')">▶️ Play</button>
                    <button class="music-action-btn" onclick="previousTrack()">⏮️</button>
                    <button class="music-action-btn" onclick="nextTrack()">⏭️</button>
                    <button class="music-action-btn" onclick="removeCustomMusic('${m.id}')">🗑️ Rimuovi</button>
                </div>
            </div>
        `;
    }).join('');
}

function removeCustomMusic(id) {
    customMusic = customMusic.filter(m => m.id !== id);
    DB.saveMusicCustom(customMusic);
    if (currentMusicId === id) toggleMiniPlayer();
    renderCustomMusic();
    showToast('Playlist custom rimossa', 'info');
}

function toggleMiniPlayer() {
    pauseActiveMusic(true);
    document.getElementById('miniPlayer').classList.remove('active');
    document.querySelectorAll('.music-card').forEach(c => c.classList.remove('playing'));
    currentMusicId = null;
    miniPlayerPaused = false;
}

function pauseMiniPlayer() {
    if (miniPlayerPaused) resumeActiveMusic();
    else pauseActiveMusic();
}
