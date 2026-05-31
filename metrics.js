/* ============================================
   Focus Rocket — METRICS Module
   Refactored from monolithic HTML
   ============================================ */

// ===== METRICS DATA STRUCTURE =====
        async function getDailyData() {
            const today = new Date().toISOString().split('T')[0];
            const data = {};
            const stats = await DB.getDailyStats(today);
            data[today] = stats;
            // Carica ultimi 30 giorni
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const range = await DB.getDailyStatsRange(
                thirtyDaysAgo.toISOString().split('T')[0],
                today
            );
            range.forEach(s => { data[s.date] = s; });
            return data;
        }
        async function saveDailyData(data) {
            for (const [date, stats] of Object.entries(data)) {
                await DB.updateDailyStats(date, stats);
            }
        }

        
// ===== METRICS TOGGLE =====
        let metricsVisible = false;
        function toggleMetrics() {
            // Chiudi Leaderboard, Settings e Music se aperte
            if (leaderboardVisible) toggleLeaderboard();
            if (settingsVisible) toggleSettings();
            if (musicVisible) toggleMusic();

            metricsVisible = !metricsVisible;
            const btn = document.getElementById('metricsToggle');
            const txt = document.getElementById('metricsText');
            const sec = document.getElementById('metricsSection');
            const main = document.getElementById('mainGrid');

            if (metricsVisible) {
                btn.classList.add('active');
                txt.textContent = 'Metrics ON';
                sec.classList.add('active');
                main.style.display = 'none';
                updateMetrics();
                showToast('📊 Sezione Metrics aperta', 'success');
            } else {
                btn.classList.remove('active');
                txt.textContent = 'Metrics';
                sec.classList.remove('active');
                main.style.display = 'grid';
                showToast('⏱️ Torna al Timer', 'info');
            }
        }

        
// ===== METRICS FUNCTIONS =====
        async function updateMetrics() {
            const data = await getDailyData();
            const today = new Date().toISOString().split('T')[0];
            const todayData = data[today] || { blocks: 0, minutes: 0, planned: 4, completed: 0 };

            const productivity = todayData.planned > 0 ? Math.round((todayData.completed / todayData.planned) * 100) : 0;
            document.getElementById('productivityValue').textContent = productivity + '%';
            document.getElementById('productivityBar').style.width = Math.min(productivity, 100) + '%';

            const hours = Math.floor(todayData.minutes / 60);
            const mins = todayData.minutes % 60;
            document.getElementById('focusTimeValue').textContent = hours + 'h ' + mins + 'm';
            const maxMinutes = 8 * 60;
            document.getElementById('focusTimeBar').style.width = Math.min((todayData.minutes / maxMinutes) * 100, 100) + '%';

            const plannedMinutes = todayData.planned * 25;
            const efficiency = plannedMinutes > 0 ? Math.round((todayData.minutes / plannedMinutes) * 100) : 0;
            document.getElementById('efficiencyValue').textContent = efficiency + '%';
            document.getElementById('efficiencyBar').style.width = Math.min(efficiency, 100) + '%';

            document.getElementById('streakValue').textContent = stats.streak;

            renderWeekGrid(data);
            renderFocusChart(data);
        }

        function renderWeekGrid(data) {
            const grid = document.getElementById('weekGrid');
            const today = new Date();
            // Show 6 previous days + today (7 days total, today is the last one)
            let html = '';
            const dayNames = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

            for (let i = 6; i >= 0; i--) {
                const d = new Date(today); d.setDate(today.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayData = data[dateStr] || { blocks: 0, completed: 0 };
                const isToday = i === 0; // Today is the last day (i=0)
                const dayLabel = dayNames[d.getDay()];

                html += `<div class="week-day ${isToday ? 'today' : ''} ${dayData.completed > 0 ? 'active' : ''}" 
                    style="${isToday ? 'border-width:3px;transform:scale(1.05);box-shadow:var(--shadow-hover);' : ''}"
                    onclick="showDayDetail('${dateStr}')">
                    <div class="week-day-name">${isToday ? 'OGGI' : dayLabel}</div>
                    <div class="week-day-number">${d.getDate()}</div>
                    <div class="week-day-blocks">${dayData.blocks} blocchi</div>
                    <div class="week-day-dots">${Array(dayData.completed).fill('<div class="week-dot completed"></div>').join('')}${Array(Math.max(0, dayData.blocks - dayData.completed)).fill('<div class="week-dot"></div>').join('')}</div>
                </div>`;
            }
            grid.innerHTML = html;
        }

        function showDayDetail(dateStr) {
            const data = await getDailyData();
            const dayData = data[dateStr] || { blocks: 0, minutes: 0, completed: 0 };
            const d = new Date(dateStr);
            const formatted = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
            showToast(`📅 ${formatted}: ${dayData.blocks} blocchi, ${dayData.minutes} minuti`, 'info');
        }

        function renderFocusChart(data) {
            const chart = document.getElementById('focusChart');
            const today = new Date();

            // Check if there's any data
            const hasData = Object.values(data).some(d => d.minutes > 0);

            if (!hasData) {
                chart.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:160px;flex-direction:column;gap:10px;color:var(--text-muted);">
                    <div style="font-size:2rem;">📊</div>
                    <div style="font-size:0.9rem;">Nessun dato ancora</div>
                    <div style="font-size:0.8rem;">Completa il tuo primo blocco per vedere il grafico!</div>
                </div>`;
                return;
            }

            let html = '';
            const maxVal = Math.max(...Object.values(data).map(d => d.minutes), 120);
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today); d.setDate(today.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayData = data[dateStr] || { minutes: 0 };
                const height = maxVal > 0 ? (dayData.minutes / maxVal) * 140 : 0;
                const dayLabel = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][d.getDay()];
                html += `<div class="bar-chart-item">
                    <div class="bar-chart-bar" style="height:${height}px">
                        ${dayData.minutes > 0 ? `<div class="bar-chart-value">${dayData.minutes}m</div>` : ''}
                    </div>
                    <div class="bar-chart-label">${dayLabel}</div>
                </div>`;
            }
            chart.innerHTML = html;
        }
        
// ===== CALENDAR POPUP FUNCTIONS =====
        let calendarPopupDate = new Date();
        let calendarPopupSelectedStart = null;
        let calendarPopupSelectedEnd = null;

        function openCalendarPopup() {
            document.getElementById('calendarPopupOverlay').classList.add('active');
            calendarPopupDate = new Date();
            calendarPopupSelectedStart = null;
            calendarPopupSelectedEnd = null;
            renderCalendarPopup();
        }

        function closeCalendarPopup(event) {
            if (!event || event.target.id === 'calendarPopupOverlay' || event.target.closest('.calendar-popup-close')) {
                document.getElementById('calendarPopupOverlay').classList.remove('active');
            }
        }

        function changeCalendarMonth(delta) {
            calendarPopupDate.setMonth(calendarPopupDate.getMonth() + delta);
            renderCalendarPopup();
        }

        function renderCalendarPopup() {
            const year = calendarPopupDate.getFullYear();
            const month = calendarPopupDate.getMonth();
            const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

            document.getElementById('calendarPopupTitle').textContent = `${monthNames[month]} ${year}`;

            const grid = document.getElementById('calendarPopupGrid');
            const data = await getDailyData();
            const today = new Date().toISOString().split('T')[0];

            // Day headers
            const dayHeaders = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
            let html = dayHeaders.map(d => `<div class="calendar-popup-day-header">${d}</div>`).join('');

            // First day of month
            const firstDay = new Date(year, month, 1);
            // Adjust for Monday start (0=Sunday, so Monday=1)
            let startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

            // Previous month days
            const prevMonth = new Date(year, month, 0);
            for (let i = startOffset - 1; i >= 0; i--) {
                const day = prevMonth.getDate() - i;
                html += `<div class="calendar-popup-day other-month"><div class="day-number">${day}</div></div>`;
            }

            // Current month days
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let monthBlocks = 0;
            let monthMinutes = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayData = data[dateStr] || { blocks: 0, completed: 0 };
                const isToday = dateStr === today;
                const hasData = dayData.blocks > 0;

                monthBlocks += dayData.blocks;
                monthMinutes += dayData.minutes || 0;

                // Check if in selected range
                let isSelected = false;
                if (calendarPopupSelectedStart && calendarPopupSelectedEnd) {
                    const d = new Date(dateStr);
                    const s = new Date(calendarPopupSelectedStart);
                    const e = new Date(calendarPopupSelectedEnd);
                    isSelected = d >= s && d <= e;
                }

                html += `<div class="calendar-popup-day ${isToday ? 'today' : ''} ${hasData ? 'has-data' : ''} ${isSelected ? 'selected' : ''}"
                    onclick="selectCalendarDay('${dateStr}')">
                    <div class="day-number">${day}</div>
                    ${hasData ? `<div class="day-blocks">${dayData.blocks}b</div>` : ''}
                    ${hasData ? `<div class="day-dots">${Array(dayData.completed).fill('<div class="day-dot completed"></div>').join('')}${Array(Math.max(0, dayData.blocks - dayData.completed)).fill('<div class="day-dot"></div>').join('')}</div>` : ''}
                </div>`;
            }

            // Next month days to fill grid
            const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
            const remaining = totalCells - (startOffset + daysInMonth);
            for (let day = 1; day <= remaining; day++) {
                html += `<div class="calendar-popup-day other-month"><div class="day-number">${day}</div></div>`;
            }

            grid.innerHTML = html;

            // Update stats
            const statsDiv = document.getElementById('calendarPopupStats');
            if (monthBlocks > 0) {
                const hours = Math.floor(monthMinutes / 60);
                const mins = monthMinutes % 60;
                statsDiv.innerHTML = `<strong>📊 ${monthNames[month]} ${year}:</strong> ${monthBlocks} blocchi · ${hours}h ${mins}m di focus`;
            } else {
                statsDiv.innerHTML = `<strong>📊 ${monthNames[month]} ${year}:</strong> Nessun dato registrato`;
            }
        }

        function selectCalendarDay(dateStr) {
            if (!calendarPopupSelectedStart || (calendarPopupSelectedStart && calendarPopupSelectedEnd)) {
                // Start new selection
                calendarPopupSelectedStart = dateStr;
                calendarPopupSelectedEnd = null;
            } else {
                // Complete selection
                const start = new Date(calendarPopupSelectedStart);
                const end = new Date(dateStr);
                if (end < start) {
                    calendarPopupSelectedEnd = calendarPopupSelectedStart;
                    calendarPopupSelectedStart = dateStr;
                } else {
                    calendarPopupSelectedEnd = dateStr;
                }

                // Show range stats
                const data = await getDailyData();
                let totalBlocks = 0;
                let totalMinutes = 0;
                const s = new Date(calendarPopupSelectedStart);
                const e = new Date(calendarPopupSelectedEnd);
                for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                    const ds = d.toISOString().split('T')[0];
                    const dd = data[ds] || { blocks: 0, minutes: 0 };
                    totalBlocks += dd.blocks;
                    totalMinutes += dd.minutes || 0;
                }
                const hours = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                showToast(`📅 Range selezionato: ${totalBlocks} blocchi · ${hours}h ${mins}m`, 'success');
            }
            renderCalendarPopup();
        }

        function searchCustomDateRange() {
            const from = document.getElementById('calendarDateFrom').value;
            const to = document.getElementById('calendarDateTo').value;

            if (!from || !to) {
                showToast('Seleziona entrambe le date!', 'warn');
                return;
            }

            if (new Date(from) > new Date(to)) {
                showToast('La data di inizio deve essere prima della fine!', 'warn');
                return;
            }

            calendarPopupSelectedStart = from;
            calendarPopupSelectedEnd = to;

            // Navigate to the month of the start date
            calendarPopupDate = new Date(from);
            renderCalendarPopup();

            // Show stats
            const data = await getDailyData();
            let totalBlocks = 0;
            let totalMinutes = 0;
            const s = new Date(from);
            const e = new Date(to);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                const ds = d.toISOString().split('T')[0];
                const dd = data[ds] || { blocks: 0, minutes: 0 };
                totalBlocks += dd.blocks;
                totalMinutes += dd.minutes || 0;
            }
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            showToast(`🔍 Risultato: ${totalBlocks} blocchi · ${hours}h ${mins}m`, 'success');
        }


        async function resetWeeklyData() {
            if (confirm('Cancellare tutti i dati settimanali? I blocchi totali rimarranno.')) {
                const today = new Date().toISOString().split('T')[0];
                await DB.updateDailyStats(today, { blocks: 0, minutes: 0, planned: 4, completed: 0 });
                await updateMetrics();
                showToast('Dati settimanali resettati', 'success');
            }
        }

        function exportCSV() {
            const data = await getDailyData();
            let csv = 'Data,Blocchi,Minuti,Completati,Pianificati\n';
            Object.entries(data).sort().forEach(([date, d]) => {
                csv += `${date},${d.blocks},${d.minutes},${d.completed},${d.planned}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'focus_rocket_stats.csv';
            a.click(); URL.revokeObjectURL(url);
            showToast('📥 CSV scaricato!', 'success');
        }
