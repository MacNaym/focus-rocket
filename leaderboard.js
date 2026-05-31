/* ============================================
   Focus Rocket — LEADERBOARD Module
   Refactored from monolithic HTML
   ============================================ */

// ===== LEADERBOARD =====
        let leaderboardVisible = false;
        let lbCurrentTab = 'global';
        let friends = [];
        let achievementsData = null;
        
        async function loadLeaderboardData() {
            friends = await DB.getFriends();
            achievementsData = await DB.getAchievements();
            if (!achievementsData || achievementsData.length === 0) {
                achievementsData = JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS));
                await DB.saveAchievements(achievementsData);
            }
        }

        const DEFAULT_ACHIEVEMENTS = [
            { id: 'first_block', icon: '🍅', title: 'Primo Pomodoro', desc: 'Completa il tuo primo blocco', unlocked: false, progress: 0, target: 1 },
            { id: 'five_blocks', icon: '🔥', title: 'Focus Streak', desc: 'Completa 5 blocchi in un giorno', unlocked: false, progress: 0, target: 5 },
            { id: 'ten_blocks', icon: '⚡', title: 'Power Hour', desc: 'Completa 10 blocchi in un giorno', unlocked: false, progress: 0, target: 10 },
            { id: 'three_day_streak', icon: '📅', title: 'Consistenza', desc: '3 giorni consecutivi di focus', unlocked: false, progress: 0, target: 3 },
            { id: 'seven_day_streak', icon: '🏆', title: 'Leggenda', desc: '7 giorni consecutivi di focus', unlocked: false, progress: 0, target: 7 },
            { id: 'thirty_minutes', icon: '⏱️', title: 'Mezz\'ora', desc: '30 minuti totali di focus', unlocked: false, progress: 0, target: 30 },
            { id: 'hundred_minutes', icon: '🎯', title: 'Centurione', desc: '100 minuti totali di focus', unlocked: false, progress: 0, target: 100 },
            { id: 'strict_master', icon: '🔒', title: 'Strict Master', desc: 'Completa 5 blocchi in Strict Mode', unlocked: false, progress: 0, target: 5 },
            { id: 'task_master', icon: '✅', title: 'Task Master', desc: 'Completa 10 micro-task', unlocked: false, progress: 0, target: 10 },
            { id: 'music_lover', icon: '🎵', title: 'Music Lover', desc: 'Ascolta musica durante 5 blocchi', unlocked: false, progress: 0, target: 5 },
            { id: 'night_owl', icon: '🦉', title: 'Night Owl', desc: 'Focus dopo le 22:00', unlocked: false, progress: 0, target: 1 },
            { id: 'early_bird', icon: '🐦', title: 'Early Bird', desc: 'Focus prima delle 8:00', unlocked: false, progress: 0, target: 1 },
        ];

        if (!achievementsData) {
            achievementsData = JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS));
            DB.saveAchievements(achievementsData);
        }

        const LEVELS = [
            { name: 'Rocket Novice', icon: '🚀', min: 0 },
            { name: 'Focus Padawan', icon: '⭐', min: 100 },
            { name: 'Pomodoro Warrior', icon: '⚔️', min: 300 },
            { name: 'Deep Work Knight', icon: '🛡️', min: 600 },
            { name: 'Flow State Master', icon: '🔥', min: 1000 },
            { name: 'Productivity Legend', icon: '👑', min: 2000 },
            { name: 'Focus Rocket God', icon: '🚀', min: 5000 },
        ];

        function getLevel(xp) {
            for (let i = LEVELS.length - 1; i >= 0; i--) {
                if (xp >= LEVELS[i].min) return LEVELS[i];
            }
            return LEVELS[0];
        }

        function getNextLevel(xp) {
            for (let i = 0; i < LEVELS.length; i++) {
                if (xp < LEVELS[i].min) return LEVELS[i];
            }
            return null;
        }

        function calculateXP() {
            return stats.blocks * 10 + stats.minutes * 2 + stats.streak * 5;
        }

        function toggleLeaderboard() {
            if (settingsVisible) toggleSettings();
            if (musicVisible) toggleMusic();
            if (metricsVisible) toggleMetrics();

            leaderboardVisible = !leaderboardVisible;
            const btn = document.getElementById('leaderboardToggle');
            const txt = document.getElementById('leaderboardText');
            const sec = document.getElementById('leaderboardSection');
            const main = document.getElementById('mainGrid');

            if (leaderboardVisible) {
                btn.classList.add('active');
                txt.textContent = 'Leaderboard ON';
                sec.classList.add('active');
                main.style.display = 'none';
                await loadLeaderboardData();
                renderLeaderboard();
                showToast('🏆 Leaderboard aperta!', 'success');
            } else {
                btn.classList.remove('active');
                txt.textContent = 'Leaderboard';
                sec.classList.remove('active');
                main.style.display = 'grid';
                showToast('⏱️ Torna al Timer', 'info');
            }
        }

        function switchLbTab(tab) {
            lbCurrentTab = tab;
            document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.lb-tab-content').forEach(c => c.style.display = 'none');
            event.target.closest('.lb-tab').classList.add('active');
            document.getElementById('lb-tab-' + tab).style.display = 'block';

            if (tab === 'achievements') renderAchievements();
            else if (tab === 'friends') renderFriends();
            else renderLeaderboardTable(tab);
        }

        function renderLeaderboard() {
            const xp = calculateXP();
            const level = getLevel(xp);
            const nextLevel = getNextLevel(xp);

            document.getElementById('levelAvatar').textContent = level.icon;
            document.getElementById('levelName').textContent = level.name;

            if (nextLevel) {
                const prevMin = LEVELS[LEVELS.indexOf(nextLevel) - 1]?.min || 0;
                const progress = ((xp - prevMin) / (nextLevel.min - prevMin)) * 100;
                document.getElementById('levelProgressFill').style.width = Math.min(progress, 100) + '%';
                document.getElementById('levelXp').textContent = xp + ' / ' + nextLevel.min + ' XP · Prossimo: ' + nextLevel.name;
                document.getElementById('levelSub').textContent = 'Completa blocchi per salire di livello';
            } else {
                document.getElementById('levelProgressFill').style.width = '100%';
                document.getElementById('levelXp').textContent = xp + ' XP · Livello Massimo!';
                document.getElementById('levelSub').textContent = 'Sei una leggenda del focus!';
            }

            document.getElementById('yourRankDisplay').textContent = level.icon + ' Tu: ' + level.name + ' · ' + xp + ' XP';
            renderLeaderboardTable('global');
        }

        function generateFakePlayers(count) {
            const names = ['Alex', 'Sam', 'Jordan', 'Casey', 'Taylor', 'Morgan', 'Riley', 'Quinn', 'Avery', 'Peyton'];
            const avatars = ['🦊', '🐼', '🦁', '🐯', '🐨', '🐸', '🐙', '🦄', '🐲', '🤖'];
            return Array.from({ length: count }, (_, i) => ({
                id: 'fake-' + i,
                name: names[i % names.length] + (i >= names.length ? i : ''),
                avatar: avatars[i % avatars.length],
                score: Math.floor(Math.random() * 2000) + 50,
                streak: Math.floor(Math.random() * 30),
                blocks: Math.floor(Math.random() * 100) + 5,
                badge: i < 3 ? ['gold', 'silver', 'bronze'][i] : (Math.random() > 0.7 ? 'rocket' : 'newbie')
            }));
        }

        function renderLeaderboardTable(type) {
            const tbody = document.getElementById(type === 'global' ? 'lbBodyGlobal' : 'lbBodyWeekly');
            const players = generateFakePlayers(10);
            const userXP = calculateXP();
            players.push({
                id: 'you', name: 'Tu (Rocket Pilot)', avatar: '🚀',
                score: userXP, streak: stats.streak, blocks: stats.blocks,
                badge: 'rocket', isYou: true
            });
            players.sort((a, b) => b.score - a.score);

            tbody.innerHTML = players.map((p, i) => {
                const rankClass = i === 0 ? 'gold' : (i === 1 ? 'silver' : (i === 2 ? 'bronze' : 'other'));
                const badgeText = p.badge === 'gold' ? '🥇 Oro' : (p.badge === 'silver' ? '🥈 Argento' : (p.badge === 'bronze' ? '🥉 Bronzo' : (p.badge === 'rocket' ? '🚀 Rocket' : '🌱 Novizio')));
                return `<tr class="${p.isYou ? 'you' : ''}">
                    <td><div class="lb-rank ${rankClass}">${i + 1}</div></td>
                    <td><div style="display:flex;align-items:center;gap:10px;"><div class="lb-avatar">${p.avatar}</div><div><div class="lb-name">${p.name}</div></div></div></td>
                    <td style="text-align:center;"><div class="lb-score">${p.score}</div></td>
                    <td style="text-align:center;"><div class="lb-streak ${p.streak >= 7 ? 'active' : ''}">${p.streak >= 3 ? '🔥' : ''} ${p.streak} gg</div></td>
                    <td style="text-align:center;"><span class="lb-badge ${p.badge}">${badgeText}</span></td>
                </tr>`;
            }).join('');
        }

        function addFriend() {
            const input = document.getElementById('friendName');
            const name = input.value.trim();
            if (!name) { showToast('Inserisci un nome!', 'warn'); return; }
            const avatars = ['🦊', '🐼', '🦁', '🐯', '🐨', '🐸', '🐙', '🦄', '🐲', '🤖'];
            friends.push({
                id: 'friend-' + Date.now(), name: name,
                avatar: avatars[Math.floor(Math.random() * avatars.length)],
                score: Math.floor(Math.random() * 500) + 20,
                streak: Math.floor(Math.random() * 10),
                status: Math.random() > 0.5 ? '🟢 Online' : '⚪ Offline'
            });
            DB.saveFriends(friends);
            input.value = '';
            renderFriends();
            showToast('👥 ' + name + ' aggiunto!', 'success');
        }

        function renderFriends() {
            const tbody = document.getElementById('lbBodyFriends');
            const empty = document.getElementById('friendsEmpty');
            if (friends.length === 0) {
                tbody.innerHTML = '';
                empty.style.display = 'block';
                return;
            }
            empty.style.display = 'none';
            const all = [...friends].sort((a, b) => b.score - a.score);
            tbody.innerHTML = all.map((f, i) => `
                <tr>
                    <td><div class="lb-rank other">${i + 1}</div></td>
                    <td><div style="display:flex;align-items:center;gap:10px;"><div class="lb-avatar">${f.avatar}</div><div><div class="lb-name">${f.name}</div></div></div></td>
                    <td style="text-align:center;"><div class="lb-score">${f.score}</div></td>
                    <td style="text-align:center;"><div class="lb-streak">${f.streak} gg</div></td>
                    <td style="text-align:center;"><span style="font-size:0.8rem;">${f.status}</span></td>
                </tr>
            `).join('');
        }

        function renderAchievements() {
            const grid = document.getElementById('achievementsGrid');
            achievementsData.forEach(a => {
                switch(a.id) {
                    case 'first_block': a.progress = Math.min(stats.blocks, a.target); break;
                    case 'five_blocks': a.progress = Math.min(stats.blocks, a.target); break;
                    case 'ten_blocks': a.progress = Math.min(stats.blocks, a.target); break;
                    case 'three_day_streak': a.progress = Math.min(stats.streak, a.target); break;
                    case 'seven_day_streak': a.progress = Math.min(stats.streak, a.target); break;
                    case 'thirty_minutes': a.progress = Math.min(stats.minutes, a.target); break;
                    case 'hundred_minutes': a.progress = Math.min(stats.minutes, a.target); break;
                    case 'strict_master': a.progress = Math.min(parseInt(localStorage.getItem('fr_strict_blocks') || '0'), a.target); break;
                    case 'task_master': a.progress = Math.min(tasks.filter(t => t.completed).length, a.target); break;
                    case 'music_lover': a.progress = Math.min(parseInt(localStorage.getItem('fr_music_blocks') || '0'), a.target); break;
                    case 'night_owl': a.progress = parseInt(localStorage.getItem('fr_night_owl') || '0'); break;
                    case 'early_bird': a.progress = parseInt(localStorage.getItem('fr_early_bird') || '0'); break;
                }
                a.unlocked = a.progress >= a.target;
            });
            DB.saveAchievements(achievementsData);

            grid.innerHTML = achievementsData.map(a => `
                <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}" onclick="showToast('${a.desc}', 'info')">
                    <div class="achievement-icon">${a.unlocked ? a.icon : '🔒'}</div>
                    <div class="achievement-title">${a.title}</div>
                    <div class="achievement-desc">${a.desc}</div>
                    <div class="achievement-progress">
                        <div class="achievement-progress-fill" style="width:${Math.min((a.progress / a.target) * 100, 100)}%"></div>
                    </div>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">${a.progress} / ${a.target}</div>
                </div>
            `).join('');
        }

        function checkAchievements() {
            const hour = new Date().getHours();
            if (hour >= 22) DB.setSetting('fr_night_owl', '1');
            if (hour < 8) DB.setSetting('fr_early_bird', '1');
            if (strictMode) DB.setSetting('fr_strict_blocks', (parseInt(await DB.getSetting('fr_strict_blocks', '0')) + 1).toString());
            if (currentMusicId) DB.setSetting('fr_music_blocks', (parseInt(await DB.getSetting('fr_music_blocks', '0')) + 1).toString());

            achievementsData.forEach(a => {
                const wasUnlocked = a.unlocked;
                if (a.id === 'first_block' || a.id === 'five_blocks' || a.id === 'ten_blocks') {
                    a.progress = Math.min(stats.blocks, a.target);
                }
                if (!wasUnlocked && a.progress >= a.target) {
                    a.unlocked = true;
                    showToast('🏅 Obiettivo sbloccato: ' + a.title + '!', 'success');
                    createConfetti({left: window.innerWidth/2, top: window.innerHeight/2}, 30);
                }
            });
            DB.saveAchievements(achievementsData);
        }
