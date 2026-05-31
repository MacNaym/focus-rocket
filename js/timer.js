/* ============================================
   Focus Rocket — TIMER Module
   Refactored from monolithic HTML
   ============================================ */

// ===== STRICT MODE =====
        let strictMode = false;
        function toggleStrictMode() {
            strictMode = !strictMode;
            const btn = document.getElementById('strictToggle');
            if (strictMode) { btn.classList.add('active'); showToast('🔒 Strict Mode attivato!', 'info'); document.getElementById('strictOverlay').classList.add('active'); updateStrictDisplay(); }
            else { btn.classList.remove('active'); document.getElementById('strictOverlay').classList.remove('active'); }
        }
        function disableStrictMode() {
            if (confirm('Sei sicuro? Il tuo focus ne risentirà.')) {
                strictMode = false; document.getElementById('strictToggle').classList.remove('active');
                document.getElementById('strictOverlay').classList.remove('active'); showToast('Strict Mode disattivata', 'warn');
            }
        }
        function updateStrictDisplay() {
            document.getElementById('strictTimerDisplay').textContent = fmt(timeLeft);
            const currentTask = document.querySelector('.micro-task:not(.completed) .task-text');
            document.getElementById('strictTaskText').textContent = currentTask ? currentTask.textContent : 'Nessun task selezionato — concentrati sul respiro';
        }

        
// ===== REWARD VIDEOS =====
        const REWARD_VIDEOS = ['5dsGWM5XGdg','AcL0MeVZIxM','gVfO0nqBVuQ','0fQ7Z_4w1zE','XyNlqQId-nk','59Zt6IDwnAA','8F5jL4v1y0o','p336IIjZCl8'];
        const APPLAUSE = ["👏👏👏 Grandioso!","🎉🎉🎉 Missione compiuta!","🏆🏆🏆 Sei una macchina!","🔥🔥🔥 Fuoco alle polveri!","⭐⭐⭐ Stellar performance!","🚀🚀🚀 Prossimo livello!","💪💪💪 Potenza pura!","✨✨✨ Magico!"];

        
// ===== TIMER =====
        function setMode(m){
            if(isRunning)toggleTimer();
            currentMode=m;totalTime=Math.round(m*60);timeLeft=totalTime;updateDisplay();
            document.querySelectorAll('.mode-btn').forEach(b=>{b.classList.remove('active');if(b.textContent.includes(m===1.5?'90s':m+'m'))b.classList.add('active');});
            document.getElementById('timerLabel').textContent=m===1.5?'🧪 TEST MODE — 90 secondi!':(m===5?'Time to recharge! ☕':'Pronto al decollo? 🚀');
        }
        function toggleTimer(){AudioEngine.init();const icon=document.getElementById('startIcon'),txt=document.getElementById('startText'),sIcon=document.getElementById('strictStartIcon'),sBtn=document.getElementById('strictStartBtn');if(isRunning){clearInterval(timerInterval);isRunning=false;icon.textContent='▶️';txt.textContent='Start';if(sIcon)sIcon.textContent='▶️';if(sBtn)sBtn.innerHTML='<span id="strictStartIcon">▶️</span> Start';document.getElementById('timerLabel').textContent='Pausa... ⏸️';}else{isRunning=true;icon.textContent='⏸️';txt.textContent='Pausa';if(sIcon)sIcon.textContent='⏸️';if(sBtn)sBtn.innerHTML='<span id="strictStartIcon">⏸️</span> Pausa';document.getElementById('timerLabel').textContent='Focus attivo! 🔥';timerInterval=setInterval(()=>{timeLeft--;updateDisplay();if(strictMode)updateStrictDisplay();checkWarnings();if(timeLeft<=0)completeBlock();},1000);}}
        function checkWarnings(){const mc=document.getElementById('timerMessages');if(timeLeft===60){mc.innerHTML='<span class="timer-message save">💾 1 minuto! Salva il tuo lavoro!</span>';AudioEngine.warning();showToast('⏰ 1 minuto rimasto! Salva il tuo lavoro!','warn');}else if(timeLeft===30){mc.innerHTML='<span class="timer-message warn">⚡ 30 secondi! Finisci il pensiero!</span>';AudioEngine.urgent();}else if(timeLeft===10){mc.innerHTML='<span class="timer-message final">🔥 10 secondi! Preparati!</span>';AudioEngine.urgent();}else if(timeLeft>60)mc.innerHTML='';}
        function resetTimer(){clearInterval(timerInterval);isRunning=false;timeLeft=totalTime;updateDisplay();document.getElementById('startIcon').textContent='▶️';document.getElementById('startText').textContent='Start';document.getElementById('timerLabel').textContent='Pronto al decollo? 🚀';document.getElementById('timerMessages').innerHTML='';}
        function completeEarly(){if(timeLeft<totalTime-60||totalTime<=120)completeBlock();else showToast('Aspetta almeno un minuto prima di completare! 😤','warn');}
        function completeBlock(){clearInterval(timerInterval);isRunning=false;const wm=Math.floor((totalTime-timeLeft)/60)||1;stats.blocks++;stats.minutes+=wm;stats.streak++;stats.lastDate=new Date().toDateString();saveStats();updateStats();
            const today = new Date().toISOString().split('T')[0];
            const todayStats = await DB.getDailyStats(today);
            todayStats.blocks++; todayStats.minutes += wm; todayStats.completed++;
            await DB.updateDailyStats(today, todayStats);
            if(metricsVisible) await updateMetrics();
            createBurst();createConfetti({left:window.innerWidth/2,top:window.innerHeight/2},60);playCompletionSound();setTimeout(()=>showReward(),700);
            setTimeout(()=>checkAchievements(),1500);
            if('Notification' in window && Notification.permission==='granted')new Notification('🚀 Focus Rocket',{body:'Blocco completato! '+wm+' minuti di focus puro!'});}
        function updateDisplay(){document.getElementById('timerDisplay').textContent=fmt(timeLeft);const c=document.getElementById('progressCircle');const circ=2*Math.PI*120;c.style.strokeDashoffset=circ*(1-timeLeft/totalTime);}
        function fmt(s){const m=Math.floor(s/60);const sec=s%60;return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');}

        
// ===== REWARD =====
        function showReward(){const ov=document.getElementById('rewardOverlay'),vid=document.getElementById('rewardVideo'),tm=document.getElementById('rewardTimer'),ttl=document.getElementById('rewardTitle'),ap=document.getElementById('applauseEmoji');ttl.textContent=APPLAUSE[Math.floor(Math.random()*APPLAUSE.length)];ap.textContent=['👏','🎉','🏆','🔥','⭐','🚀','💪','✨'][Math.floor(Math.random()*8)];const vidId=REWARD_VIDEOS[Math.floor(Math.random()*REWARD_VIDEOS.length)];vid.src='https://www.youtube.com/embed/'+vidId+'?autoplay=1&mute=1&enablejsapi=1&origin=https://focusrocket.app';ov.classList.add('active');let rt=5*60;rewardInterval=setInterval(()=>{rt--;tm.textContent=fmt(rt);if(rt<=0)closeReward();},1000);const ci=setInterval(()=>{if(!ov.classList.contains('active')){clearInterval(ci);return;}createConfetti({left:Math.random()*window.innerWidth,top:-50,width:0,height:0},4);},600);}

        function manualPlayRewardVideo() {
            const overlay = document.getElementById('rewardVideoOverlay');
            const iframe = document.getElementById('rewardVideo');
            const currentSrc = iframe.src;
            // Reload with autoplay and unmute (user clicked = gesture allowed)
            iframe.src = currentSrc.replace('&mute=1', '') + '&autoplay=1';
            overlay.style.display = 'none';
        }

        // Detect autoplay blocking and show manual play button
        function checkAutoplayBlocked() {
            setTimeout(() => {
                const overlay = document.getElementById('rewardVideoOverlay');
                const iframe = document.getElementById('rewardVideo');
                // If video hasn't started playing after 2 seconds, show overlay
                // This is a heuristic - browsers block autoplay without user gesture
                if (overlay && iframe && iframe.src && !iframe.src.includes('autoplay=1')) {
                    overlay.style.display = 'flex';
                }
            }, 2000);
        }
        function nextVideo(){const vidId=REWARD_VIDEOS[Math.floor(Math.random()*REWARD_VIDEOS.length)];document.getElementById('rewardVideo').src='https://www.youtube.com/embed/'+vidId+'?autoplay=1&mute=1&enablejsapi=1&origin=https://focusrocket.app';}
        function skipReward(){closeReward();}
        function closeReward(){clearInterval(rewardInterval);document.getElementById('rewardOverlay').classList.remove('active');document.getElementById('rewardVideo').src='';resetTimer();showToast('🚀 Break finito! Torna al focus!','success');}
