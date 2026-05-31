/* ============================================
   Focus Rocket — MUSIC Module
   Refactored from monolithic HTML
   ============================================ */

// ===== MUSIC TOGGLE & PLAYER =====
        let musicVisible = false;
        let currentMusicId = null;
        let currentMusicTitle = '';
        let favorites = [];
        let customMusic = [];
        
        async function loadMusicData() {
            favorites = await DB.getMusicFavorites();
            customMusic = await DB.getMusicCustom();
        }
        let currentTab = 'focus';

        async function toggleMusic() {
            // Chiudi altre sezioni
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
                renderFavorites();
                renderCustomMusic();
                showToast('🎵 Sezione Musica aperta', 'success');
            } else { 
                btn.classList.remove('active');
                txt.textContent = 'Music';
                sec.classList.remove('active');
                main.style.display = 'grid';
                showToast('⏱️ Torna al Timer', 'info');
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
            // Pause all other iframes
            document.querySelectorAll('.music-card iframe').forEach(iframe => {
                const src = iframe.src;
                iframe.src = '';
                setTimeout(() => iframe.src = src, 100);
            });

            // Remove playing class from all
            document.querySelectorAll('.music-card').forEach(c => c.classList.remove('playing'));

            // Activate current
            const card = document.getElementById('music-' + id);
            if (card) card.classList.add('playing');

            currentMusicId = id;
            currentMusicTitle = title;

            // Show mini player
            document.getElementById('miniPlayer').classList.add('active');
            document.getElementById('miniPlayerTitle').textContent = title;

            showToast('🎵 ' + title + ' — in riproduzione', 'success');
        }

        function toggleFavorite(id, title, videoId) {
            const idx = favorites.findIndex(f => f.id === id);
            const btn = document.getElementById('fav-' + id);

            if (idx >= 0) {
                favorites.splice(idx, 1);
                if (btn) { btn.textContent = '🤍 Preferito'; btn.classList.remove('favorited'); }
                showToast('Rimosso dai preferiti', 'info');
            } else {
                favorites.push({ id, title, videoId, added: new Date().toISOString() });
                if (btn) { btn.textContent = '❤️ Preferito'; btn.classList.add('favorited'); }
                showToast('⭐ Aggiunto ai preferiti!', 'success');
            }

            DB.saveMusicFavorites(favorites);
            renderFavorites();
        }

        function renderFavorites() {
            const grid = document.getElementById('favoritesGrid');
            if (favorites.length === 0) {
                grid.innerHTML = '<div class="music-empty">Nessun preferito ancora. Clicca 🤍 su una playlist per salvarla! 💾</div>';
                return;
            }

            grid.innerHTML = favorites.map(f => `
                <div class="music-fav-item" onclick="playMusic('${f.id}', '${f.title.replace(/'/g, "\\'")}')">
                    <span>🎵</span>
                    <span class="fav-title">${f.title}</span>
                    <button class="fav-remove" onclick="event.stopPropagation(); removeFavorite('${f.id}')">🗑️</button>
                </div>
            `).join('');

            // Update favorite buttons state
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

        function addCustomMusic() {
            const urlInput = document.getElementById('customMusicUrl');
            const nameInput = document.getElementById('customMusicName');
            const url = urlInput.value.trim();
            const name = nameInput.value.trim() || 'Custom Playlist';

            if (!url) { showToast('Inserisci un URL YouTube!', 'warn'); return; }

            // Extract video ID
            let videoId = '';
            const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
            if (match) videoId = match[1];
            else if (url.length === 11) videoId = url;

            if (!videoId) { showToast('URL YouTube non valido!', 'warn'); return; }

            const id = 'custom-' + Date.now();
            customMusic.push({ id, title: name, videoId, added: new Date().toISOString() });
            DB.saveMusicCustom(customMusic);

            urlInput.value = '';
            nameInput.value = '';
            renderCustomMusic();
            showToast('🎧 Playlist custom aggiunta!', 'success');
        }

        function renderCustomMusic() {
            const grid = document.getElementById('customMusicGrid');
            if (customMusic.length === 0) {
                grid.innerHTML = '<div class="music-empty">Nessuna playlist custom ancora. Aggiungi il tuo primo link YouTube! 🎧</div>';
                return;
            }

            grid.innerHTML = customMusic.map(m => `
                <div class="music-card" id="music-${m.id}" data-id="${m.id}">
                    <div class="music-card-header">
                        <div class="music-card-icon custom">🎧</div>
                        <div>
                            <div class="music-card-title">${m.title}</div>
                            <div class="music-card-subtitle">Playlist personalizzata</div>
                        </div>
                    </div>
                    <div class="music-embed">
                        <iframe id="iframe-${m.id}" src="https://www.youtube.com/embed/${m.videoId}?enablejsapi=1&origin=https://focusrocket.app" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
                    </div>
                    <div class="music-card-actions">
                        <button class="music-action-btn" onclick="playMusic('${m.id}', '${m.title.replace(/'/g, "\\'")}')">▶️ Play</button>
                        <button class="music-action-btn" onclick="removeCustomMusic('${m.id}')">🗑️ Rimuovi</button>
                    </div>
                </div>
            `).join('');
        }

        function removeCustomMusic(id) {
            customMusic = customMusic.filter(m => m.id !== id);
            DB.saveMusicCustom(customMusic);
            renderCustomMusic();
            showToast('Playlist custom rimossa', 'info');
        }

        let miniPlayerPaused = false;

        function toggleMiniPlayer() {
            document.getElementById('miniPlayer').classList.remove('active');
            document.querySelectorAll('.music-card').forEach(c => c.classList.remove('playing'));
            currentMusicId = null;
            miniPlayerPaused = false;
        }

        function pauseMiniPlayer() {
            const iframe = document.querySelector('.music-card.playing iframe');
            if (iframe) {
                const src = iframe.src;
                if (miniPlayerPaused) {
                    // Resume: reload with autoplay
                    iframe.src = src + '&autoplay=1';
                    miniPlayerPaused = false;
                    showToast('▶️ Musica ripresa', 'info');
                } else {
                    // Pause: remove autoplay and reload
                    iframe.src = src.replace('&autoplay=1', '').replace('?autoplay=1', '?');
                    miniPlayerPaused = true;
                    showToast('⏸️ Musica in pausa', 'info');
                }
            }
        }
