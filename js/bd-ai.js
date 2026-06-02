/* ============================================
   Focus Rocket - Body Doubling AI
   AI calls go through the Supabase Edge Function.
   ============================================ */

const BD_PRICING = {
    'gpt-4.1-nano': { input: 0.10, output: 0.40 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 },
    'gpt-5.4-mini': { input: 0.75, output: 4.50 }
};

let bdConversation = [];
let bdSessionCost = 0;
let bdTotalCost = 0;
let bdCheckInTimer = null;
let bdCheckInCount = 0;
let bdPreSessionTimer = null;
let bdInitialized = false;
let bdEventUnsubscribers = [];

async function loadBdCosts() {
    const costs = await DB.getBdCost();
    bdTotalCost = costs.totalCost || 0;
}

async function initBodyDoubling() {
    if (bdInitialized) return;
    bdInitialized = true;

    await loadBdCosts();
    const enabled = document.getElementById('bodyDoublingEnabled')?.checked ?? true;
    if (!enabled) {
        document.getElementById('bdNavToggle').style.display = 'none';
        return;
    }

    const modelSelect = document.getElementById('openaiModel');
    if (modelSelect) modelSelect.value = getSelectedAiModel();

    const bdAiSound = localStorage.getItem('fr_bd_ai_sound');
    if (bdAiSound !== null && document.getElementById('bodyDoublingAiSound')) {
        document.getElementById('bodyDoublingAiSound').checked = bdAiSound === 'true';
    }

    updateCostDisplays();

    modelSelect?.addEventListener('change', (e) => {
        DB.setSetting('openaiModel', e.target.value);
    });
    document.getElementById('bodyDoublingAiSound')?.addEventListener('change', (e) => {
        DB.setSetting('fr_bd_ai_sound', e.target.checked);
    });

    bindBodyDoublingEvents();
    document.getElementById('bdNavToggle').style.display = 'flex';
}

function bindBodyDoublingEvents() {
    if (bdEventUnsubscribers.length > 0) return;
    if (typeof FocusRocketEvents === 'undefined') return;

    bdEventUnsubscribers = [
        FocusRocketEvents.on('timer:started', startBodyDoublingSession),
        FocusRocketEvents.on('timer:paused', stopBodyDoublingSession),
        FocusRocketEvents.on('timer:reset', stopBodyDoublingSession),
        FocusRocketEvents.on('timer:block-completed', () => {
            if (document.getElementById('bodyDoublingEnabled')?.checked && bdConversation.length > 0) {
                setTimeout(() => {
                    callOpenAI('Ho appena completato un blocco di focus!', 'mid');
                }, 1000);
            }
        })
    ];
}

function toggleBodyDoublingFromNav() {
    const btn = document.getElementById('bdNavToggle');
    const txt = document.getElementById('bdNavText');
    const widget = document.getElementById('bodyDoublingWidget');

    if (widget.style.display === 'none' || widget.style.display === '') {
        showBodyDoublingWidget();
        btn.classList.add('active');
        txt.textContent = 'BD ON';
        showToast('Body Double attivato', 'success');
    } else {
        hideBodyDoublingWidget();
        btn.classList.remove('active');
        txt.textContent = 'Body Double';
        showToast('Body Double nascosto', 'info');
    }
}

function showBodyDoublingWidget() {
    document.getElementById('bodyDoublingWidget').style.display = 'flex';
    document.getElementById('bodyDoublingToggleBtn').style.display = 'none';
    document.getElementById('bdStatus').textContent = 'Online';
    document.getElementById('bdStatus').classList.add('online');
}

function hideBodyDoublingWidget() {
    document.getElementById('bodyDoublingWidget').style.display = 'none';
    document.getElementById('bodyDoublingToggleBtn').style.display = 'flex';
    document.getElementById('bdStatus').textContent = 'Offline';
    document.getElementById('bdStatus').classList.remove('online');
}

function toggleBodyDoublingWidget() {
    const widget = document.getElementById('bodyDoublingWidget');
    if (widget.style.display === 'none') showBodyDoublingWidget();
    else hideBodyDoublingWidget();
}

function addBdMessage(text, sender = 'ai') {
    const chat = document.getElementById('bdChat');
    const msgDiv = document.createElement('div');
    msgDiv.className = `bd-message bd-message-${sender}`;
    const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    msgDiv.innerHTML = `<div class="bd-message-text">${text}</div><div class="bd-message-time">${time}</div>`;
    chat.appendChild(msgDiv);
    chat.scrollTop = chat.scrollHeight;

    if (sender === 'ai' && document.getElementById('bodyDoublingAiSound')?.checked !== false) {
        playBdNotificationSound();
    }
}

function showBdTyping() {
    const chat = document.getElementById('bdChat');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'bdTyping';
    typingDiv.className = 'bd-message bd-message-ai bd-typing';
    typingDiv.innerHTML = '<div class="bd-typing-dot"></div><div class="bd-typing-dot"></div><div class="bd-typing-dot"></div>';
    chat.appendChild(typingDiv);
    chat.scrollTop = chat.scrollHeight;
}

function hideBdTyping() {
    const typing = document.getElementById('bdTyping');
    if (typing) typing.remove();
}

async function sendBodyDoubleMessage() {
    const input = document.getElementById('bdInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    addBdMessage(text, 'user');
    await callOpenAI(text, 'user');
}

async function callOpenAI(userMessage, role = 'checkin') {
    const model = getSelectedAiModel();
    showBdTyping();

    let systemPrompt = `Sei un Body Double AI per un'app di produttivita chiamata Focus Rocket. `;
    systemPrompt += `Accompagni l'utente durante sessioni di focus Pomodoro. `;
    systemPrompt += `Sei gentile, incoraggiante, conciso: massimo 2-3 frasi. `;
    systemPrompt += `Rispondi in italiano. `;

    if (role === 'pre') {
        systemPrompt += `Fai un check-in pre-sessione: aiuta a chiarire il task e dai un incoraggiamento iniziale.`;
    } else if (role === 'mid') {
        systemPrompt += `Fai un check-in a meta sessione: chiedi come sta andando e offri un suggerimento breve se serve.`;
    } else if (role === 'post') {
        systemPrompt += `Fai un debrief post-sessione: celebra il risultato e suggerisci una pausa o il prossimo passo.`;
    } else {
        systemPrompt += `Rispondi al messaggio dell'utente in modo utile e pratico.`;
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...bdConversation.slice(-6),
        { role: 'user', content: userMessage }
    ];

    try {
        const data = await callAiProxy({
            feature: 'body_double',
            model,
            messages,
            maxTokens: 150,
            temperature: 0.8
        });

        const aiText = data.text;
        const cost = Number(data.estimatedCost) || 0;
        bdSessionCost += cost;
        trackAiCost(cost);
        DB.updateBdCost(bdSessionCost, bdTotalCost);
        updateCostDisplays();

        bdConversation.push({ role: 'user', content: userMessage });
        bdConversation.push({ role: 'assistant', content: aiText });

        hideBdTyping();
        addBdMessage(aiText, 'ai');

        if (document.getElementById('bodyDoublingSound')?.checked) {
            playNotificationSound();
        }
    } catch (err) {
        hideBdTyping();
        addBdMessage(`AI non disponibile: ${err.message}`, 'system');
        console.error('OpenAI proxy error:', err);
    }
}

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
}

function playBdNotificationSound() {
    try {
        if (AudioEngine && AudioEngine.ctx && AudioEngine.enabled) {
            AudioEngine.playTone(660, 'sine', 0.15, 0.08);
            setTimeout(() => AudioEngine.playTone(880, 'sine', 0.2, 0.06), 120);
        } else {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = 660;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.08;
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);

            setTimeout(() => {
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.frequency.value = 880;
                osc2.type = 'sine';
                gain2.gain.value = 0.06;
                gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
                osc2.start();
                osc2.stop(audioCtx.currentTime + 0.25);
            }, 120);
        }
    } catch (e) {
        console.log('BD notification sound failed:', e);
    }
}

function updateCostDisplays() {
    const sessionDisplay = document.getElementById('sessionCostDisplay');
    const totalDisplay = document.getElementById('totalCostDisplay');
    if (sessionDisplay) sessionDisplay.textContent = '$' + bdSessionCost.toFixed(4);
    if (totalDisplay) totalDisplay.textContent = '$' + bdTotalCost.toFixed(4);
}

function startBodyDoublingSession() {
    const enabled = document.getElementById('bodyDoublingEnabled')?.checked ?? true;
    if (!enabled) return;
    if (!authUser) {
        showToast('Accedi per usare il Body Double AI', 'info');
        return;
    }

    bdConversation = [];
    bdSessionCost = 0;
    bdCheckInCount = 0;
    if (bdPreSessionTimer) clearTimeout(bdPreSessionTimer);
    if (bdCheckInTimer) clearInterval(bdCheckInTimer);
    updateCostDisplays();

    showBodyDoublingWidget();
    document.getElementById('bdNavToggle')?.classList.add('active');
    document.getElementById('bdNavText').textContent = 'BD ON';

    const chat = document.getElementById('bdChat');
    chat.innerHTML = '';
    addBdMessage('Ciao! Sono il tuo Body Double AI. Ti accompagno durante questa sessione di focus.', 'ai');

    bdPreSessionTimer = setTimeout(() => {
        const task = document.getElementById('taskInput')?.value || 'focus';
        callOpenAI(`Sto per iniziare una sessione di focus. Il mio task e: "${task}". Dammi un incoraggiamento e aiutami a spezzarlo in piccoli passi.`, 'pre');
    }, 5000);

    bdCheckInTimer = setInterval(() => {
        bdCheckInCount++;
        const minutes = bdCheckInCount * 10;
        callOpenAI(`Sono a ${minutes} minuti di sessione. Come sto andando?`, 'mid');
    }, 10 * 60 * 1000);
}

function stopBodyDoublingSession() {
    if (bdPreSessionTimer) {
        clearTimeout(bdPreSessionTimer);
        bdPreSessionTimer = null;
    }
    if (bdCheckInTimer) {
        clearInterval(bdCheckInTimer);
        bdCheckInTimer = null;
    }

    const enabled = document.getElementById('bodyDoublingEnabled')?.checked ?? true;
    if (enabled && bdConversation.length > 0) {
        const completed = stats?.blocks || 0;
        const total = tasks?.length || currentMode || 1;
        callOpenAI(`Sessione completata! Ho finito ${completed} blocchi su ${total}. Fammi un debrief breve.`, 'post');
    }

    setTimeout(() => {
        hideBodyDoublingWidget();
        document.getElementById('bdNavToggle')?.classList.remove('active');
        document.getElementById('bdNavText').textContent = 'Body Double';
    }, 30000);
}
