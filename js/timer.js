/* ============================================
   Focus Rocket - TIMER Module
   Pomodoro timer, strict mode, reward.
   ============================================ */

// ===== STRICT MODE =====
let strictMode = false;

function toggleStrictMode() {
    strictMode = !strictMode;
    const btn = document.getElementById('strictToggle');

    if (strictMode) {
        btn.classList.add('active');
        showToast('Strict Mode attivato', 'info');
        document.getElementById('strictOverlay').classList.add('active');
        updateStrictDisplay();
    } else {
        btn.classList.remove('active');
        document.getElementById('strictOverlay').classList.remove('active');
    }
}

function disableStrictMode() {
    if (confirm('Sei sicuro? Il tuo focus ne risentira.')) {
        strictMode = false;
        document.getElementById('strictToggle').classList.remove('active');
        document.getElementById('strictOverlay').classList.remove('active');
        showToast('Strict Mode disattivata', 'warn');
    }
}

function updateStrictDisplay() {
    document.getElementById('strictTimerDisplay').textContent = fmt(timeLeft);
    const currentTask = document.querySelector('.micro-task:not(.completed) .task-text');
    document.getElementById('strictTaskText').textContent = currentTask
        ? currentTask.textContent
        : 'Nessun task selezionato - concentrati sul respiro';
}

// ===== REWARD VIDEOS =====
const REWARD_VIDEOS = ['5dsGWM5XGdg', 'AcL0MeVZIxM', 'gVfO0nqBVuQ', '0fQ7Z_4w1zE', 'XyNlqQId-nk', '59Zt6IDwnAA', '8F5jL4v1y0o', 'p336IIjZCl8'];
const APPLAUSE = [
    'Grandioso!',
    'Missione compiuta!',
    'Sei una macchina!',
    'Fuoco alle polveri!',
    'Stellar performance!',
    'Prossimo livello!',
    'Potenza pura!',
    'Magico!'
];

// ===== TIMER =====
function setMode(m) {
    if (isRunning) toggleTimer();
    currentMode = m;
    totalTime = Math.round(m * 60);
    timeLeft = totalTime;
    updateDisplay();

    document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.classList.remove('active');
        if (btn.textContent.includes(m === 1.5 ? '90s' : m + 'm')) btn.classList.add('active');
    });

    document.getElementById('timerLabel').textContent = m === 1.5
        ? 'TEST MODE - 90 secondi!'
        : (m === 5 ? 'Time to recharge!' : 'Pronto al decollo?');

    FocusRocketEvents.emit('timer:mode-changed', { mode: m, totalTime });
}

function setTimerButtonState(running) {
    const icon = document.getElementById('startIcon');
    const text = document.getElementById('startText');
    const strictIcon = document.getElementById('strictStartIcon');
    const strictBtn = document.getElementById('strictStartBtn');

    icon.textContent = running ? '||' : '>';
    text.textContent = running ? 'Pausa' : 'Start';
    if (strictIcon) strictIcon.textContent = running ? '||' : '>';
    if (strictBtn) strictBtn.innerHTML = `<span id="strictStartIcon">${running ? '||' : '>'}</span> ${running ? 'Pausa' : 'Start'}`;
}

function toggleTimer() {
    AudioEngine.init();

    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        setTimerButtonState(false);
        document.getElementById('timerLabel').textContent = 'Pausa...';
        FocusRocketEvents.emit('timer:paused', { timeLeft, totalTime, currentMode });
        return;
    }

    isRunning = true;
    setTimerButtonState(true);
    document.getElementById('timerLabel').textContent = 'Focus attivo!';
    FocusRocketEvents.emit('timer:started', { timeLeft, totalTime, currentMode });

    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        if (strictMode) updateStrictDisplay();
        checkWarnings();
        if (timeLeft <= 0) completeBlock();
    }, 1000);
}

function checkWarnings() {
    const messages = document.getElementById('timerMessages');
    if (timeLeft === 60) {
        messages.innerHTML = '<span class="timer-message save">1 minuto! Salva il tuo lavoro!</span>';
        AudioEngine.warning();
        showToast('1 minuto rimasto! Salva il tuo lavoro!', 'warn');
    } else if (timeLeft === 30) {
        messages.innerHTML = '<span class="timer-message warn">30 secondi! Finisci il pensiero!</span>';
        AudioEngine.urgent();
    } else if (timeLeft === 10) {
        messages.innerHTML = '<span class="timer-message final">10 secondi! Preparati!</span>';
        AudioEngine.urgent();
    } else if (timeLeft > 60) {
        messages.innerHTML = '';
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    timeLeft = totalTime;
    updateDisplay();
    setTimerButtonState(false);
    document.getElementById('timerLabel').textContent = 'Pronto al decollo?';
    document.getElementById('timerMessages').innerHTML = '';
    FocusRocketEvents.emit('timer:reset', { timeLeft, totalTime, currentMode });
}

function completeEarly() {
    if (timeLeft < totalTime - 60 || totalTime <= 120) completeBlock();
    else showToast('Aspetta almeno un minuto prima di completare!', 'warn');
}

async function completeBlock() {
    clearInterval(timerInterval);
    isRunning = false;
    setTimerButtonState(false);

    const workedMinutes = Math.floor((totalTime - timeLeft) / 60) || 1;
    stats.blocks++;
    stats.minutes += workedMinutes;
    stats.streak++;
    stats.lastDate = new Date().toDateString();
    saveStats();
    updateStats();

    const today = new Date().toISOString().split('T')[0];
    const todayStats = await DB.getDailyStats(today);
    todayStats.blocks++;
    todayStats.minutes += workedMinutes;
    todayStats.completed++;
    await DB.updateDailyStats(today, todayStats);
    if (metricsVisible) await updateMetrics();

    if (typeof pauseActiveMusic === 'function') pauseActiveMusic(true);

    FocusRocketEvents.emit('timer:block-completed', {
        workedMinutes,
        stats: { ...stats },
        currentMode,
        totalTime
    });

    createBurst();
    createConfetti({ left: window.innerWidth / 2, top: window.innerHeight / 2 }, 60);
    playCompletionSound();
    setTimeout(() => showReward(), 700);
    setTimeout(() => checkAchievements(), 1500);

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Focus Rocket', { body: 'Blocco completato: ' + workedMinutes + ' minuti di focus.' });
    }
}

function updateDisplay() {
    document.getElementById('timerDisplay').textContent = fmt(timeLeft);
    const circle = document.getElementById('progressCircle');
    const circumference = 2 * Math.PI * 120;
    circle.style.strokeDashoffset = circumference * (1 - timeLeft / totalTime);
}

function fmt(seconds) {
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return String(minutes).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

// ===== REWARD =====
function showReward() {
    const overlay = document.getElementById('rewardOverlay');
    const video = document.getElementById('rewardVideo');
    const timer = document.getElementById('rewardTimer');
    const title = document.getElementById('rewardTitle');
    const applause = document.getElementById('applauseEmoji');

    title.textContent = APPLAUSE[Math.floor(Math.random() * APPLAUSE.length)];
    applause.textContent = 'Nice!';
    const videoId = REWARD_VIDEOS[Math.floor(Math.random() * REWARD_VIDEOS.length)];
    video.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&mute=1&enablejsapi=1&origin=https://focusrocket.app';
    overlay.classList.add('active');

    let rewardTime = 5 * 60;
    rewardInterval = setInterval(() => {
        rewardTime--;
        timer.textContent = fmt(rewardTime);
        if (rewardTime <= 0) closeReward();
    }, 1000);

    const confettiInterval = setInterval(() => {
        if (!overlay.classList.contains('active')) {
            clearInterval(confettiInterval);
            return;
        }
        createConfetti({ left: Math.random() * window.innerWidth, top: -50, width: 0, height: 0 }, 4);
    }, 600);
}

function manualPlayRewardVideo() {
    const overlay = document.getElementById('rewardVideoOverlay');
    const iframe = document.getElementById('rewardVideo');
    iframe.src = iframe.src.replace('&mute=1', '') + '&autoplay=1';
    overlay.style.display = 'none';
}

function checkAutoplayBlocked() {
    setTimeout(() => {
        const overlay = document.getElementById('rewardVideoOverlay');
        const iframe = document.getElementById('rewardVideo');
        if (overlay && iframe && iframe.src && !iframe.src.includes('autoplay=1')) {
            overlay.style.display = 'flex';
        }
    }, 2000);
}

function nextVideo() {
    const videoId = REWARD_VIDEOS[Math.floor(Math.random() * REWARD_VIDEOS.length)];
    document.getElementById('rewardVideo').src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&mute=1&enablejsapi=1&origin=https://focusrocket.app';
}

function skipReward() {
    closeReward();
}

function closeReward() {
    clearInterval(rewardInterval);
    document.getElementById('rewardOverlay').classList.remove('active');
    document.getElementById('rewardVideo').src = '';
    resetTimer();
    showToast('Break finito! Torna al focus!', 'success');
}
