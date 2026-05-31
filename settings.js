/* ============================================
   Focus Rocket — SETTINGS Module
   Refactored from monolithic HTML
   ============================================ */

// ===== SETTINGS TOGGLE =====
        let settingsVisible = false;
        let selectedSoundEffect = 'default';
        let soundVolume = 50;
        let notificationSettings = { endBlock: true, '60s': true, '30s': true, '10s': true };
        
        async function loadSettings() {
            selectedSoundEffect = await DB.getSetting('fr_sound_effect', 'default');
            soundVolume = parseInt(await DB.getSetting('fr_sound_volume', '50'));
            const notif = await DB.getSetting('fr_notifications');
            if (notif) notificationSettings = JSON.parse(notif);
        }

        function toggleSettings() {
            // Chiudi altre sezioni
            if (leaderboardVisible) toggleLeaderboard();
            if (musicVisible) toggleMusic();
            if (metricsVisible) toggleMetrics();

            settingsVisible = !settingsVisible;
            const btn = document.getElementById('settingsToggle');
            const txt = document.getElementById('settingsText');
            const sec = document.getElementById('settingsSection');
            const main = document.getElementById('mainGrid');

            if (settingsVisible) {
                btn.classList.add('active');
                txt.textContent = 'Settings ON';
                sec.classList.add('active');
                main.style.display = 'none';
                await loadSettings();
                renderSettings();
                showToast('⚙️ Sezione Settings aperta', 'success');
            } else {
                btn.classList.remove('active');
                txt.textContent = 'Settings';
                sec.classList.remove('active');
                main.style.display = 'grid';
                showToast('⏱️ Torna al Timer', 'info');
            }
        }

        function renderSettings() {
            // Ripristina selezione effetto sonoro
            document.querySelectorAll('.sound-effect-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.sound-effect-radio').forEach(r => r.checked = false);

            const selectedItem = document.getElementById('sound-' + selectedSoundEffect);
            const selectedRadio = document.getElementById('radio-' + selectedSoundEffect);
            if (selectedItem) selectedItem.classList.add('active');
            if (selectedRadio) selectedRadio.checked = true;

            // Ripristina volume
            document.getElementById('soundVolume').value = soundVolume;
            document.getElementById('volumeValue').textContent = soundVolume + '%';

            // Ripristina notifiche
            document.getElementById('notifEndBlock').checked = notificationSettings.endBlock;
            document.getElementById('notif60s').checked = notificationSettings['60s'];
            document.getElementById('notif30s').checked = notificationSettings['30s'];
            document.getElementById('notif10s').checked = notificationSettings['10s'];
        }

        function selectSoundEffect(effect) {
            selectedSoundEffect = effect;
            DB.setSetting('fr_sound_effect', effect);

            document.querySelectorAll('.sound-effect-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.sound-effect-radio').forEach(r => r.checked = false);

            const item = document.getElementById('sound-' + effect);
            const radio = document.getElementById('radio-' + effect);
            if (item) item.classList.add('active');
            if (radio) radio.checked = true;

            showToast('🎉 Effetto sonoro selezionato: ' + effect, 'success');
        }

        function previewSoundEffect(effect) {
            // Inizializza audio se necessario
            if (!AudioEngine.ctx) {
                AudioEngine.init();
            }
            if (AudioEngine.ctx && AudioEngine.ctx.state === 'suspended') {
                AudioEngine.ctx.resume();
            }

            const vol = soundVolume / 100;

            switch(effect) {
                case 'default':
                    AudioEngine.success();
                    break;
                case 'applause':
                    // Simula applauso con multipli toni sovrapposti
                    for (let i = 0; i < 8; i++) {
                        setTimeout(() => {
                            const freq = 400 + Math.random() * 600;
                            AudioEngine.playTone(freq, 'triangle', 0.3, vol * 0.15);
                        }, i * 80);
                    }
                    break;
                case 'fanfare':
                    // Fanfara: sequenza di toni ascendenti
                    const fanfareNotes = [523, 587, 659, 784, 880, 1047];
                    fanfareNotes.forEach((freq, i) => {
                        setTimeout(() => AudioEngine.playTone(freq, 'sine', 0.4, vol * 0.2), i * 200);
                    });
                    break;
                case 'coins':
                    // Cha-ching: toni alti rapidi
                    AudioEngine.playTone(1200, 'sine', 0.1, vol * 0.15);
                    setTimeout(() => AudioEngine.playTone(1500, 'sine', 0.15, vol * 0.15), 100);
                    setTimeout(() => AudioEngine.playTone(1800, 'sine', 0.2, vol * 0.2), 200);
                    break;
                case 'achievement':
                    // Achievement: arpeggio ascendente + finale
                    const achNotes = [440, 554, 659, 880];
                    achNotes.forEach((freq, i) => {
                        setTimeout(() => AudioEngine.playTone(freq, 'square', 0.15, vol * 0.1), i * 150);
                    });
                    setTimeout(() => AudioEngine.playTone(1100, 'sine', 0.5, vol * 0.2), 700);
                    break;
            }

            showToast('🔊 Anteprima: ' + effect, 'info');
        }

        function updateVolume(value) {
            soundVolume = parseInt(value);
            document.getElementById('volumeValue').textContent = value + '%';
            DB.setSetting('fr_sound_volume', value);
        }

        function toggleNotification(key) {
            notificationSettings[key] = document.getElementById('notif' + key.charAt(0).toUpperCase() + key.slice(1)).checked;
            if (key === 'endBlock') notificationSettings.endBlock = document.getElementById('notifEndBlock').checked;
            DB.setSetting('fr_notifications', JSON.stringify(notificationSettings));
            showToast('🔔 Notifica ' + key + ' ' + (notificationSettings[key] ? 'attivata' : 'disattivata'), 'info');
        }

        function setDefaultMode(minutes) {
            DB.setSetting('fr_default_mode', minutes);
            // Aggiorna UI
            renderSettings();
            showToast('⏱️ Modalità default: ' + minutes + ' minuti', 'success');
        }

        function setBreakMode(minutes) {
            DB.setSetting('fr_break_mode', minutes);
            renderSettings();
            showToast('☕ Break: ' + minutes + ' minuti', 'success');
        }

        function toggleAutoStartBreak() {
            const autoStart = document.getElementById('autoStartBreak').checked;
            DB.setSetting('fr_auto_start_break', autoStart);
            showToast(autoStart ? '✅ Auto-start break attivato' : '❌ Auto-start break disattivato', 'info');
        }

        async function exportAllDataApp() {
            const data = await exportAllData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'focus_rocket_backup_' + new Date().toISOString().split('T')[0] + '.json';
            a.click(); URL.revokeObjectURL(url);
            showToast('📥 Backup completo scaricato!', 'success');
        }

        function importData() {
            document.getElementById('importFileInput').click();
        }

        function handleImportFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.stats) {
                        stats = data.stats;
                        saveStats();
                        updateStats();
                    }
                    if (data.tasks) {
                        tasks = data.tasks;
                        saveTasks();
                        renderTasks();
                    }
                    if (data.dailyData) {
                        saveDailyData(data.dailyData);
                    }
                    if (data.favorites) {
                        favorites = data.favorites;
                        localStorage.setItem('fr_music_favorites', JSON.stringify(favorites));
                        renderFavorites();
                    }
                    if (data.customMusic) {
                        customMusic = data.customMusic;
                        localStorage.setItem('fr_music_custom', JSON.stringify(customMusic));
                        renderCustomMusic();
                    }
                    if (data.settings) {
                        const s = data.settings;
                        if (s.soundEffect) { selectedSoundEffect = s.soundEffect; localStorage.setItem('fr_sound_effect', s.soundEffect); }
                        if (s.soundVolume) { soundVolume = s.soundVolume; localStorage.setItem('fr_sound_volume', s.soundVolume); }
                        if (s.notifications) { notificationSettings = s.notifications; localStorage.setItem('fr_notifications', JSON.stringify(s.notifications)); }
                        if (s.theme) { applyTheme(s.theme); localStorage.setItem('fr_theme', s.theme); }
                        if (s.gentleMode !== undefined) { gentleMode = s.gentleMode; localStorage.setItem('fr_gentle', s.gentleMode); }
                    }
                    showToast('📤 Dati importati con successo!', 'success');
                    renderSettings();
                } catch (err) {
                    showToast('❌ Errore importazione: file non valido', 'warn');
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        function resetAllData() {
            if (confirm('🚨 ATTENZIONE: Questo cancellerà TUTTI i dati (stats, task, preferiti, impostazioni). Sei sicuro?')) {
                if (confirm('Conferma definitiva: tutti i dati andranno persi. Procedere?')) {
                    localStorage.clear();
                    location.reload();
                }
            }
        }

        
// ===== OVERRIDE: play completion sound based on selected effect =====
        function playCompletionSound() {
            if (!AudioEngine.enabled) return;
            const vol = soundVolume / 100;

            switch(selectedSoundEffect) {
                case 'default':
                    AudioEngine.success();
                    break;
                case 'applause':
                    for (let i = 0; i < 12; i++) {
                        setTimeout(() => {
                            const freq = 300 + Math.random() * 700;
                            AudioEngine.playTone(freq, 'triangle', 0.4, vol * 0.15);
                        }, i * 60);
                    }
                    break;
                case 'fanfare':
                    const notes = [523, 587, 659, 784, 880, 1047, 1175];
                    notes.forEach((freq, i) => {
                        setTimeout(() => AudioEngine.playTone(freq, 'sine', 0.5, vol * 0.2), i * 180);
                    });
                    break;
                case 'coins':
                    AudioEngine.playTone(1200, 'sine', 0.1, vol * 0.15);
                    setTimeout(() => AudioEngine.playTone(1500, 'sine', 0.15, vol * 0.15), 100);
                    setTimeout(() => AudioEngine.playTone(1800, 'sine', 0.3, vol * 0.2), 200);
                    setTimeout(() => AudioEngine.playTone(2000, 'sine', 0.4, vol * 0.2), 350);
                    break;
                case 'achievement':
                    const ach = [440, 554, 659, 880, 1100];
                    ach.forEach((freq, i) => {
                        setTimeout(() => AudioEngine.playTone(freq, 'square', 0.2, vol * 0.1), i * 120);
                    });
                    setTimeout(() => AudioEngine.playTone(1320, 'sine', 0.8, vol * 0.25), 650);
                    break;
            }
        }
