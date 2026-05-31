/* ============================================
   Focus Rocket — TASKS Module
   Refactored from monolithic HTML
   ============================================ */

// ===== TASK BREAKDOWN =====
        async function breakDownTask() {
            const input = document.getElementById('bigTask');
            const task = input.value.trim();
            if (!task) { showToast('Inserisci prima un task!', 'warn'); return; }

            const generated = await generateMicroTasks(task);
            tasks = generated.map((t,i) => ({ id: Date.now()+i, text: t, completed: false, time: 25 }));
            currentTaskIndex = 0;
            saveTasks(); renderTasks(); input.value = '';
            showToast('🔨 Task scomposto in ' + tasks.length + ' micro-task!', 'success');
        }
        async function generateMicroTasks(bigTask) {
            const apiKey = localStorage.getItem('openaiApiKey');
            const model = localStorage.getItem('openaiModel') || 'gpt-5.4-nano';

            if (!apiKey) {
                showToast('⚠️ Inserisci la OpenAI API Key nelle Settings per usare la scomposizione AI!', 'warn');
                // Fallback to basic template
                return ['Fase 1: Analisi e pianificazione','Fase 2: Raccolta informazioni','Fase 3: Esecuzione parte 1','Fase 4: Esecuzione parte 2','Fase 5: Review e finalizzazione'];
            }

            // Show loading state
            const input = document.getElementById('bigTask');
            const originalPlaceholder = input.placeholder;
            input.placeholder = '⏳ L\'AI sta scomponendo il task...';
            input.disabled = true;

            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            {
                                role: 'system',
                                content: `Sei un esperto di produttività e project management per l'app Focus Rocket. 
Il tuo compito è scomporre un task complesso in 4-6 micro-task molto specifici e actionable, 
della durata di circa 25 minuti ciascuno (stile Pomodoro). 

Regole:
- Ogni micro-task deve iniziare con un verbo all'imperativo o infinito
- Deve essere specifico e misurabile (non vago)
- Durata implicita: ~25 minuti ciascuno
- Formato: "Azione — oggetto — dettaglio"
- Rispondi SOLO con la lista, uno per riga, senza numeri, senza introduzione, senza conclusione
- Massimo 6 micro-task, minimo 4`
                            },
                            {
                                role: 'user',
                                content: `Scomponi questo task in micro-task da 25 minuti: "${bigTask}"`
                            }
                        ],
                        max_tokens: 300,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error?.message || 'Errore API');
                }

                const data = await response.json();
                const aiText = data.choices[0].message.content;

                // Parse the response into individual tasks
                const lines = aiText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                // Remove bullet points, numbers, dashes at start
                const tasks = lines.map(l => l.replace(/^[-•*\d\.\)\s]+/, '').trim()).filter(l => l.length > 5);

                // Track cost
                const pricing = BD_PRICING[model] || BD_PRICING['gpt-5.4-nano'];
                const inputTokens = data.usage?.prompt_tokens || 300;
                const outputTokens = data.usage?.completion_tokens || 150;
                const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000000;

                bdTotalCost += cost;
                localStorage.setItem('bdTotalCost', bdTotalCost.toString());
                if (document.getElementById('totalCostDisplay')) {
                    document.getElementById('totalCostDisplay').textContent = '$' + bdTotalCost.toFixed(4);
                }

                input.placeholder = originalPlaceholder;
                input.disabled = false;

                if (tasks.length >= 3) {
                    showToast(`🤖 AI ha generato ${tasks.length} micro-task! Costo: $${cost.toFixed(4)}`, 'success');
                    return tasks.slice(0, 6); // Max 6 tasks
                } else {
                    showToast('⚠️ Risposta AI non valida, uso fallback', 'warn');
                    return ['Fase 1: Analisi e pianificazione','Fase 2: Raccolta informazioni','Fase 3: Esecuzione parte 1','Fase 4: Esecuzione parte 2','Fase 5: Review e finalizzazione'];
                }

            } catch (err) {
                console.error('GPT Task Breakdown Error:', err);
                input.placeholder = originalPlaceholder;
                input.disabled = false;
                showToast('❌ Errore AI: ' + err.message, 'warn');
                return ['Fase 1: Analisi e pianificazione','Fase 2: Raccolta informazioni','Fase 3: Esecuzione parte 1','Fase 4: Esecuzione parte 2','Fase 5: Review e finalizzazione'];
            }
        }
        function addManualTask() {
            const text = prompt('Descrivi il micro-task:');
            if (text) { tasks.push({ id: Date.now(), text: text + ' (25 min)', completed: false, time: 25 }); saveTasks(); renderTasks(); }
        }
        function clearTasks() {
            if (confirm('Cancellare tutti i task?')) { tasks = []; currentTaskIndex = 0; saveTasks(); renderTasks(); showToast('Task puliti', 'info'); }
        }
        function toggleTask(id) {
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.completed = !task.completed;
                if (task.completed && !tasks.every(t => t.completed)) {
                    const next = tasks.find(t => !t.completed);
                    if (next) currentTaskIndex = tasks.indexOf(next);
                }
                saveTasks(); renderTasks();
                if (task.completed) { createConfetti({left: window.innerWidth/2, top: window.innerHeight/2}, 15); AudioEngine.success(); }
            }
        }
        function renderTasks() {
            const container = document.getElementById('microTasks');
            if (tasks.length === 0) { container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">Nessun task ancora. Scrivi un task grande sopra! 📝</div>'; return; }
            container.innerHTML = tasks.map((t,i) => `<div class="micro-task ${t.completed?'completed':''}" onclick="toggleTask(${t.id})" style="${i===currentTaskIndex && !t.completed?'border-color:var(--accent-orange);background:var(--accent-orange-bg);':''}"><div class="task-checkbox"></div><div class="task-text">${t.text}</div><div class="task-time-badge">⏱️ ${t.time}m</div></div>`).join('');
        }
