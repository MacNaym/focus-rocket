/* ============================================
   Focus Rocket — BD-AI Module
   Refactored from monolithic HTML
   ============================================ */

// ===== BODY DOUBLING AI (OpenAI API) =====
const BD_PRICING = {
    'gpt-4.1-nano': { input: 0.10, output: 0.40 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-5.4-nano': { input: 0.20, output: 1.25 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 },
    'gpt-5.4-mini': { input: 0.75, output: 4.50 }
};

let bdConversation = [];
let bdSessionCost = 0;
let bdTotalCost = 0;
        
        async function loadBdCosts() {
            const costs = await DB.getBdCost();
            bdTotalCost = costs.totalCost || 0;
        }
let bdCheckInTimer = null;
let bdCheckInCount = 0;

async function initBodyDoubling() {
            await loadBdCosts();
            const enabled = document.getElementById('bodyDoublingEnabled')?.checked ?? true;
            if (!enabled) {
                document.getElementById('bdNavToggle').style.display = 'none';
                return;
            }

            // Load API key from localStorage
            const apiKey = localStorage.getItem('openaiApiKey');
            if (apiKey) document.getElementById('openaiApiKey').value = apiKey;

            // Load model preference
            const model = localStorage.getItem('openaiModel') || 'gpt-4.1-nano';
            document.getElementById('openaiModel').value = model;

            // Load BD AI sound preference
            const bdAiSound = localStorage.getItem('fr_bd_ai_sound');
            if (bdAiSound !== null && document.getElementById('bodyDoublingAiSound')) {
                document.getElementById('bodyDoublingAiSound').checked = bdAiSound === 'true';
            }

            // Update cost displays
            updateCostDisplays();

            // Event listeners
            document.getElementById('openaiApiKey')?.addEventListener('change', (e) => {
                DB.setSetting('openaiApiKey', e.target.value);
            });
            document.getElementById('openaiModel')?.addEventListener('change', (e) => {
                DB.setSetting('openaiModel', e.target.value);
            });
            document.getElementById('bodyDoublingAiSound')?.addEventListener('change', (e) => {
                DB.setSetting('fr_bd_ai_sound', e.target.checked);
            });

            // Ensure nav button is visible
            document.getElementById('bdNavToggle').style.display = 'flex';
        }

function toggleBodyDoublingFromNav() {
            const btn = document.getElementById('bdNavToggle');
            const txt = document.getElementById('bdNavText');
            const widget = document.getElementById('bodyDoublingWidget');
            const toggleBtn = document.getElementById('bodyDoublingToggleBtn');

            if (widget.style.display === 'none' || widget.style.display === '') {
                // Show widget
                showBodyDoublingWidget();
                btn.classList.add('active');
                txt.textContent = 'BD ON';
                showToast('🤖 Body Double attivato!', 'success');
            } else {
                // Hide widget
                hideBodyDoublingWidget();
                btn.classList.remove('active');
                txt.textContent = 'Body Double';
                showToast('🤖 Body Double nascosto', 'info');
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

    // Play notification sound when AI responds (if enabled)
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

    const apiKey = localStorage.getItem('openaiApiKey');
    if (!apiKey) {
        addBdMessage('⚠️ Inserisci la tua OpenAI API Key nelle Settings per usare il Body Doubling.', 'system');
        return;
    }

    await callOpenAI(text, 'user');
}

async function callOpenAI(userMessage, role = 'checkin') {
    const apiKey = localStorage.getItem('openaiApiKey');
    const model = localStorage.getItem('openaiModel') || 'gpt-5.4-nano';

    if (!apiKey) return;

    showBdTyping();

    // Build system prompt based on role
    let systemPrompt = `Sei un Body Double AI per un'app di produttività chiamata Focus Rocket. `;
    systemPrompt += `Il tuo compito è accompagnare l'utente durante le sessioni di focus (Pomodoro, 52/17, etc.). `;
    systemPrompt += `Sei gentile, incoraggiante, conciso (max 2-3 frasi). `;
    systemPrompt += `Usa emoji occasionalmente. Rispondi in italiano. `;

    if (role === 'pre') {
        systemPrompt += `Ora fai il check-in PRE-SESSIONE: chiedi cosa vuole fare, aiuta a spezzare il task in micro-passi, dà un incoraggiamento iniziale.`;
    } else if (role === 'mid') {
        systemPrompt += `Ora fai un CHECK-IN a metà sessione: chiedi come sta andando, se è bloccato offri un suggerimento breve, celebra se sta andando bene.`;
    } else if (role === 'post') {
        systemPrompt += `Ora fai il DEBRIEF post-sessione: riassumi cosa ha fatto, celebra i risultati, suggerisci una pausa o la prossima sessione.`;
    } else {
        systemPrompt += `Rispondi al messaggio dell'utente in modo utile e conciso.`;
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...bdConversation.slice(-6), // Keep last 6 messages for context
        { role: 'user', content: userMessage }
    ];

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: 150,
                temperature: 0.8
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API Error');
        }

        const data = await response.json();
        const aiText = data.choices[0].message.content;

        // Track cost
        const pricing = BD_PRICING[model] || BD_PRICING['gpt-5.4-nano'];
        const inputTokens = data.usage?.prompt_tokens || 250;
        const outputTokens = data.usage?.completion_tokens || 100;
        const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000000;

        bdSessionCost += cost;
        bdTotalCost += cost;
        DB.updateBdCost(bdSessionCost, bdTotalCost);
        updateCostDisplays();

        // Add to conversation history
        bdConversation.push({ role: 'user', content: userMessage });
        bdConversation.push({ role: 'assistant', content: aiText });

        hideBdTyping();
        addBdMessage(aiText, 'ai');

        // Play sound if enabled
        if (document.getElementById('bodyDoublingSound')?.checked) {
            playNotificationSound();
        }

    } catch (err) {
        hideBdTyping();
        addBdMessage(`⚠️ Errore API: ${err.message}`, 'system');
        console.error('OpenAI API Error:', err);
    }
}

function playNotificationSound() {
    // Simple beep using Web Audio API
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
    } catch(e) {}
}

function playBdNotificationSound() {
    // Gentle notification sound for AI messages in Body Doubling widget
    // Uses AudioEngine if available, otherwise Web Audio API fallback
    try {
        if (AudioEngine && AudioEngine.ctx && AudioEngine.enabled) {
            // Soft chime using AudioEngine
            AudioEngine.playTone(660, 'sine', 0.15, 0.08);
            setTimeout(() => AudioEngine.playTone(880, 'sine', 0.2, 0.06), 120);
        } else {
            // Fallback Web Audio API
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

            // Second tone for a pleasant chime
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
    } catch(e) {
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

    bdConversation = [];
    bdSessionCost = 0;
    bdCheckInCount = 0;
    updateCostDisplays();

    // Show widget
    showBodyDoublingWidget();
            document.getElementById('bdNavToggle')?.classList.add('active');
            document.getElementById('bdNavText').textContent = 'BD ON';

    // Clear chat and add welcome
    const chat = document.getElementById('bdChat');
    chat.innerHTML = '';
    addBdMessage('Ciao! Sono il tuo Body Double AI. Ti accompagno durante questa sessione di focus. 💪', 'ai');

    // Pre-session check-in after 5 seconds
    setTimeout(() => {
        const task = document.getElementById('taskInput')?.value || 'focus';
        callOpenAI(`Sto per iniziare una sessione di focus. Il mio task è: "${task}". Dammi un incoraggiamento e aiutami a spezzarlo in piccoli passi.`, 'pre');
    }, 5000);

    // Schedule mid-session check-ins every 10 minutes
    bdCheckInTimer = setInterval(() => {
        bdCheckInCount++;
        const minutes = bdCheckInCount * 10;
        callOpenAI(`Sono a ${minutes} minuti di sessione. Come sto andando?`, 'mid');
    }, 10 * 60 * 1000); // 10 minutes
}

function stopBodyDoublingSession() {
    if (bdCheckInTimer) {
        clearInterval(bdCheckInTimer);
        bdCheckInTimer = null;
    }

    // Post-session debrief
    const enabled = document.getElementById('bodyDoublingEnabled')?.checked ?? true;
    if (enabled) {
        const completed = completedBlocks;
        const total = totalBlocks;
        callOpenAI(`Sessione completata! Ho finito ${completed} blocchi su ${total}. Fammi un debrief breve.`, 'post');
    }

    // Don't hide widget immediately, let user see the debrief
    setTimeout(() => {
        hideBodyDoublingWidget();
            document.getElementById('bdNavToggle')?.classList.remove('active');
            document.getElementById('bdNavText').textContent = 'Body Double';
    }, 30000); // Hide after 30 seconds
}

// Hook into existing timer functions
const originalToggleTimer = toggleTimer;
toggleTimer = function() {
    const wasRunning = isRunning;
    originalToggleTimer();
    if (!wasRunning && isRunning) {
        // Session started
        startBodyDoublingSession();
    } else if (wasRunning && !isRunning) {
        // Session stopped
        stopBodyDoublingSession();
    }
};

const originalCompleteBlock = completeBlock;
completeBlock = function() {
    originalCompleteBlock();
    // Celebrate with AI
    if (document.getElementById('bodyDoublingEnabled')?.checked && bdConversation.length > 0) {
        setTimeout(() => {
            callOpenAI('Ho appena completato un blocco di focus! 🎉', 'mid');
        }, 1000);
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', initBodyDoubling);
