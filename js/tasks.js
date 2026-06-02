/* ============================================
   Focus Rocket - TASKS Module
   Task breakdown via Supabase Edge Function.
   ============================================ */

const TASK_FALLBACK = [
    'Analizzare il task e definire il risultato atteso',
    'Raccogliere materiali, link e informazioni utili',
    'Eseguire la prima parte operativa',
    'Completare la seconda parte operativa',
    'Rivedere, rifinire e chiudere il task'
];

// ===== TASK BREAKDOWN =====
async function breakDownTask() {
    const input = document.getElementById('bigTask');
    const task = input.value.trim();
    if (!task) {
        showToast('Inserisci prima un task!', 'warn');
        return;
    }

    const generated = await generateMicroTasks(task);
    tasks = generated.map((t, i) => ({ id: Date.now() + i, text: t, completed: false, time: 25 }));
    currentTaskIndex = 0;
    saveTasks();
    renderTasks();
    input.value = '';
    showToast('Task scomposto in ' + tasks.length + ' micro-task!', 'success');
}

async function generateMicroTasks(bigTask) {
    const input = document.getElementById('bigTask');
    const originalPlaceholder = input.placeholder;
    input.placeholder = 'AI al lavoro sul task...';
    input.disabled = true;

    try {
        const data = await callAiProxy({
            feature: 'task_breakdown',
            model: getSelectedAiModel(),
            maxTokens: 300,
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content: `Sei un esperto di produttivita e project management per l'app Focus Rocket.
Il tuo compito e scomporre un task complesso in 4-6 micro-task molto specifici e azionabili,
della durata di circa 25 minuti ciascuno, in stile Pomodoro.

Regole:
- Ogni micro-task deve iniziare con un verbo all'imperativo o infinito
- Deve essere specifico e misurabile
- Durata implicita: circa 25 minuti ciascuno
- Formato: "Azione - oggetto - dettaglio"
- Rispondi solo con la lista, uno per riga
- Non usare numeri, introduzioni o conclusioni
- Massimo 6 micro-task, minimo 4`
                },
                {
                    role: 'user',
                    content: `Scomponi questo task in micro-task da 25 minuti: "${bigTask}"`
                }
            ]
        });

        const lines = data.text.split('\n').map((line) => line.trim()).filter(Boolean);
        const generatedTasks = lines
            .map((line) => line.replace(/^[-*0-9.)\s]+/, '').trim())
            .filter((line) => line.length > 5);

        const cost = trackAiCost(data.estimatedCost);

        if (generatedTasks.length >= 3) {
            showToast(`AI ha generato ${generatedTasks.length} micro-task. Costo: $${cost.toFixed(4)}`, 'success');
            return generatedTasks.slice(0, 6);
        }

        showToast('Risposta AI non valida, uso fallback', 'warn');
        return TASK_FALLBACK;
    } catch (err) {
        console.error('AI task breakdown error:', err);
        showToast('AI non disponibile: ' + err.message, 'warn');
        return TASK_FALLBACK;
    } finally {
        input.placeholder = originalPlaceholder;
        input.disabled = false;
    }
}

function addManualTask() {
    const text = prompt('Descrivi il micro-task:');
    if (text) {
        tasks.push({ id: Date.now(), text: text + ' (25 min)', completed: false, time: 25 });
        saveTasks();
        renderTasks();
    }
}

function clearTasks() {
    if (confirm('Cancellare tutti i task?')) {
        tasks = [];
        currentTaskIndex = 0;
        saveTasks();
        renderTasks();
        showToast('Task puliti', 'info');
    }
}

function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
        task.completed = !task.completed;
        if (task.completed && !tasks.every((t) => t.completed)) {
            const next = tasks.find((t) => !t.completed);
            if (next) currentTaskIndex = tasks.indexOf(next);
        }
        saveTasks();
        renderTasks();
        if (task.completed) {
            createConfetti({ left: window.innerWidth / 2, top: window.innerHeight / 2 }, 15);
            AudioEngine.success();
        }
    }
}

function renderTasks() {
    const container = document.getElementById('microTasks');
    if (tasks.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">Nessun task ancora. Scrivi un task grande sopra!</div>';
        return;
    }

    container.innerHTML = tasks.map((t, i) => `
        <div class="micro-task ${t.completed ? 'completed' : ''}" onclick="toggleTask(${t.id})" style="${i === currentTaskIndex && !t.completed ? 'border-color:var(--accent-orange);background:var(--accent-orange-bg);' : ''}">
            <div class="task-checkbox"></div>
            <div class="task-text">${t.text}</div>
            <div class="task-time-badge">${t.time}m</div>
        </div>
    `).join('');
}
