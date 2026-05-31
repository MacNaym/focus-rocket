/* ============================================
   Focus Rocket — APP Module (Core)
   AudioEngine, State, FX, Utilities, DB Init
   ============================================ */

// ===== AUDIO ENGINE =====
const AudioEngine = {
    ctx: null, enabled: false,
    init() { if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } if (this.ctx.state === 'suspended') { this.ctx.resume(); } this.enabled = true; },
    playTone(freq, type, duration, vol = 0.12) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
    },
    success() { this.playTone(523.25, 'sine', 0.15, 0.1); setTimeout(() => this.playTone(659.25, 'sine', 0.15, 0.1), 120); setTimeout(() => this.playTone(783.99, 'sine', 0.3, 0.12), 240); },
    warning() { this.playTone(440, 'triangle', 0.2, 0.08); setTimeout(() => this.playTone(440, 'triangle', 0.2, 0.08), 250); },
    urgent() { this.playTone(880, 'square', 0.1, 0.06); setTimeout(() => this.playTone(880, 'square', 0.1, 0.06), 150); setTimeout(() => this.playTone(880, 'square', 0.1, 0.06), 300); },
    click() { this.playTone(800, 'sine', 0.05, 0.04); }
};

function toggleSound() {
    if (!AudioEngine.ctx) AudioEngine.init();
    if (AudioEngine.ctx && AudioEngine.ctx.state === 'suspended') AudioEngine.ctx.resume();

    const btn = document.getElementById('soundToggle');
    const icon = document.getElementById('soundIcon');
    const txt = document.getElementById('soundText');

    AudioEngine.enabled = !AudioEngine.enabled;

    if (AudioEngine.enabled) {
        btn.classList.add('active');
        icon.textContent = '🔊';
        txt.textContent = 'Suono ON';
        setTimeout(() => AudioEngine.click(), 100);
    } else {
        btn.classList.remove('active');
        icon.textContent = '🔇';
        txt.textContent = 'Suono OFF';
    }

    DB.setSetting('fr_sound_enabled', AudioEngine.enabled);
    showToast(AudioEngine.enabled ? '🔊 Suono attivato!' : '🔇 Suono disattivato', 'info');
}

// ===== GENTLE MODE =====
let gentleMode = false;

async function loadGentleMode() {
    gentleMode = (await DB.getSetting('fr_gentle')) === 'true';
    if (gentleMode) {
        document.getElementById('gentleToggle').classList.add('active');
        document.getElementById('gentleText').textContent = 'Gentle ON';
        document.body.setAttribute('data-gentle', 'true');
    }
}

function toggleGentleMode() {
    gentleMode = !gentleMode;
    const btn = document.getElementById('gentleToggle'), txt = document.getElementById('gentleText');
    if (gentleMode) {
        btn.classList.add('active'); txt.textContent = 'Gentle ON';
        document.body.setAttribute('data-gentle', 'true');
        showToast('🌿 Gentle Mode attivata', 'success');
    } else {
        btn.classList.remove('active'); txt.textContent = 'Gentle';
        document.body.removeAttribute('data-gentle');
        showToast('Gentle Mode disattivata', 'info');
    }
    DB.setSetting('fr_gentle', gentleMode);
}

// ===== STATE (caricato da DB, non localStorage) =====
let timeLeft = 25 * 60, totalTime = 25 * 60, isRunning = false, timerInterval = null;
let rewardInterval = null, currentMode = 25;
let currentTheme = 'light';
let stats = { blocks: 0, minutes: 0, streak: 0, lastDate: null };
let tasks = [];
let currentTaskIndex = 0;

async function loadState() {
    // Theme
    currentTheme = await DB.getSetting('fr_theme', 'light');
    applyTheme(currentTheme);

    // Stats (da dailyStats oggi)
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await DB.getDailyStats(today);
    stats.blocks = todayStats.blocks || 0;
    stats.minutes = todayStats.minutes || 0;
    stats.streak = parseInt(await DB.getSetting('legacy_streak', '0'));
    stats.lastDate = await DB.getSetting('legacy_lastDate', new Date().toDateString());

    // Tasks
    const dbTasks = await DB.getTasks();
    tasks = dbTasks.length > 0 ? dbTasks : [];
    currentTaskIndex = parseInt(await DB.getSetting('fr_currentTask', '0'));

    // Timer mode
    const savedMode = await DB.getSetting('fr_default_mode', '25');
    currentMode = parseInt(savedMode);
    totalTime = currentMode * 60;
    timeLeft = totalTime;

    updateStats();
    renderTasks();
}

// ===== CORE UTILITIES =====
function saveStats() {
    // Ora gestito da DB.updateDailyStats nel completeBlock
    // Questa funzione rimane per compatibilità con timer.js
}

function saveTasks() {
    // Ora gestito da DB.saveTasks
    DB.saveTasks(tasks);
    DB.setSetting('fr_currentTask', currentTaskIndex);
}

function updateStats() {
    document.getElementById('statBlocks').textContent = stats.blocks;
    document.getElementById('statMinutes').textContent = stats.minutes;
    document.getElementById('statStreak').textContent = stats.streak;
}

function showToast(msg, type = 'info') {
    const tc = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const icon = document.getElementById('themeIcon');
    const txt = document.getElementById('themeText');
    if (icon) icon.textContent = t === 'light' ? '🌙' : '☀️';
    if (txt) txt.textContent = t === 'light' ? 'Dark' : 'Light';
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    DB.setSetting('fr_theme', currentTheme);
}

function createParticles() {
    const c = document.getElementById('particles');
    if (!c) return;
    const colors = ['#e17055', '#74b9ff', '#a29bfe', '#00b894', '#fdcb6e'];
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.width = Math.random() * 50 + 20 + 'px';
        p.style.height = p.style.width;
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.animationDelay = Math.random() * 15 + 's';
        p.style.animationDuration = (Math.random() * 10 + 10) + 's';
        c.appendChild(p);
    }
}

function updateOnlineStatus() {
    const banner = document.getElementById('offlineBanner');
    if (!banner) return;
    if (!navigator.onLine) {
        banner.classList.add('active');
        showToast('📡 Connessione persa! I dati vengono salvati localmente.', 'warn');
    } else {
        banner.classList.remove('active');
        if (banner.classList.contains('was-offline')) {
            showToast('🌐 Connessione ripristinata!', 'success');
        }
    }
    banner.classList.toggle('was-offline', !navigator.onLine);
}

// ===== FX =====
function createBurst() {
    const b = document.createElement('div');
    b.className = 'burst-effect';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 800);
}

function createConfetti(rect, count = 20) {
    const colors = ['#e17055', '#74b9ff', '#a29bfe', '#00b894', '#fdcb6e', '#ff7675', '#fab1a0'];
    const container = document.getElementById('celebration');
    if (!container) return;
    for (let i = 0; i < count; i++) {
        const cf = document.createElement('div');
        cf.className = 'confetti';
        cf.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 100) + 'px';
        cf.style.top = (rect.top + rect.height / 2) + 'px';
        cf.style.background = colors[Math.floor(Math.random() * colors.length)];
        cf.style.animationDelay = Math.random() * 0.5 + 's';
        cf.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        container.appendChild(cf);
        setTimeout(() => cf.remove(), 3000);
    }
}

// ===== DB INIT =====
let dbInitialized = false;

async function initDatabase() {
    if (dbInitialized) return;

    if (DB.storageMode === 'localStorage') {
        console.warn('Dexie.js not loaded, using localStorage fallback');
        showToast('⚠️ IndexedDB non disponibile: uso salvataggio locale fallback', 'warn');
    }

    try {
        // Verifica se serve migrazione (prima volta con IndexedDB)
        const hasMigrated = await DB.getSetting('db_migrated', false);
        if (!hasMigrated && localStorage.length > 0) {
            await migrateFromLocalStorage();
            await DB.setSetting('db_migrated', true);
        }

        // Carica stato
        await loadState();
        await loadGentleMode();

        dbInitialized = true;
        console.log('✅ IndexedDB initialized');
    } catch (err) {
        console.error('DB init error:', err);
        showToast('⚠️ Errore database, uso fallback localStorage', 'warn');
        // Fallback a localStorage se IndexedDB fallisce
        loadStateFallback();
    }
}

function loadStateFallback() {
    // Caricamento legacy da localStorage
    currentTheme = localStorage.getItem('fr_theme') || 'light';
    applyTheme(currentTheme);

    stats.blocks = parseInt(localStorage.getItem('fr_blocks') || '0');
    stats.minutes = parseInt(localStorage.getItem('fr_minutes') || '0');
    stats.streak = parseInt(localStorage.getItem('fr_streak') || '0');
    stats.lastDate = localStorage.getItem('fr_lastDate') || new Date().toDateString();

    tasks = JSON.parse(localStorage.getItem('fr_tasks') || '[]');
    currentTaskIndex = parseInt(localStorage.getItem('fr_currentTask') || '0');

    gentleMode = localStorage.getItem('fr_gentle') === 'true';
    if (gentleMode) {
        document.getElementById('gentleToggle').classList.add('active');
        document.getElementById('gentleText').textContent = 'Gentle ON';
        document.body.setAttribute('data-gentle', 'true');
    }

    updateStats();
    renderTasks();
}
