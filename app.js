(() => {
  'use strict';

  const TOTAL_SETS = 10;
  const WORK_SECONDS = 60;
  const REST_SECONDS = 120;
  const TOTAL_PLANNED = TOTAL_SETS * WORK_SECONDS + (TOTAL_SETS - 1) * REST_SECONDS;
  const HISTORY_KEY = 'workoutSetsHistory';
  const RING_CIRC = 2 * Math.PI * 90;

  const EXERCISES = [
    { key: 'abs', name: 'בטן', reps: 10 },
    { key: 'pushup', name: 'שכיבות סמיכה', reps: 10 },
    { key: 'squat', name: 'סקוואטים', reps: 10 },
    { key: 'calf', name: 'שוקיים', reps: 10 }
  ];

  const el = {
    home: document.getElementById('screen-home'),
    workout: document.getElementById('screen-workout'),
    done: document.getElementById('screen-done'),
    btnStart: document.getElementById('btn-start'),
    btnStop: document.getElementById('btn-stop'),
    btnPause: document.getElementById('btn-pause'),
    btnSkip: document.getElementById('btn-skip'),
    btnDoneHome: document.getElementById('btn-done-home'),
    workoutWrap: document.querySelector('.workout-wrap'),
    setCurrent: document.getElementById('set-current'),
    setTotal: document.getElementById('set-total'),
    setsProgressFill: document.getElementById('sets-progress-fill'),
    phaseLabel: document.getElementById('phase-label'),
    timerRingFg: document.getElementById('timer-ring-fg'),
    timerNum: document.getElementById('timer-num'),
    currentExIcon: document.getElementById('current-ex-icon'),
    currentExName: document.getElementById('current-ex-name'),
    checklistCells: Array.from(document.querySelectorAll('.ex-cell')),
    statTotal: document.getElementById('stat-total'),
    statStreak: document.getElementById('stat-streak'),
    historyList: document.getElementById('history-list'),
    doneDuration: document.getElementById('done-duration'),
    modal: document.getElementById('confirm-modal'),
    btnConfirmStop: document.getElementById('btn-confirm-stop'),
    btnCancelStop: document.getElementById('btn-cancel-stop')
  };

  el.setTotal.textContent = TOTAL_SETS;

  const w = {
    running: false,
    paused: false,
    set: 1,
    phase: 'work',
    phaseDuration: WORK_SECONDS,
    phaseElapsedBeforePause: 0,
    phaseSegStart: 0,
    totalElapsedBeforePause: 0,
    totalSegStart: 0,
    lastExIdx: -1,
    lastTickSecond: -1,
    wakeLock: null,
    audioCtx: null,
    timerId: null
  };

  const now = () => performance.now() / 1000;

  // ---------------- audio + haptics ----------------
  function ensureAudio() {
    if (!w.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      w.audioCtx = new Ctx();
    }
    if (w.audioCtx.state === 'suspended') w.audioCtx.resume();
    return w.audioCtx;
  }
  function beep(freq, dur, type, vol, delay) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol == null ? 0.22 : vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  const playWorkStart = () => { beep(880, 0.12, 'square', 0.22, 0); beep(1180, 0.14, 'square', 0.22, 0.14); };
  const playRestStart = () => beep(440, 0.35, 'sine', 0.2, 0);
  const playExerciseTick = () => beep(1000, 0.08, 'square', 0.14, 0);
  const playCountdownBeep = () => beep(700, 0.1, 'square', 0.2, 0);
  const playFanfare = () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.18, 'triangle', 0.25, i * 0.15));
  function vib(pattern) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {} }

  // ---------------- wake lock ----------------
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) w.wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* not available, silently ignore */ }
  }
  function releaseWakeLock() {
    try { w.wakeLock && w.wakeLock.release(); } catch (e) {}
    w.wakeLock = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && w.running && !w.wakeLock) acquireWakeLock();
  });

  // ---------------- timing helpers ----------------
  function getPhaseElapsed() {
    return w.phaseElapsedBeforePause + (w.paused ? 0 : (now() - w.phaseSegStart));
  }
  function getTotalElapsed() {
    return w.totalElapsedBeforePause + (w.paused ? 0 : (now() - w.totalSegStart));
  }

  // ---------------- rendering ----------------
  function formatMMSS(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function renderTimer(remaining, duration) {
    el.timerNum.textContent = Math.ceil(remaining);
    const frac = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
    el.timerRingFg.style.strokeDashoffset = String(RING_CIRC * (1 - frac));
  }

  function renderTotalProgress() {
    const pct = Math.max(0, Math.min(100, (getTotalElapsed() / TOTAL_PLANNED) * 100));
    el.setsProgressFill.style.width = pct + '%';
  }

  function updateExerciseDisplay(idx) {
    const ex = EXERCISES[idx];
    el.currentExIcon.innerHTML = EXERCISE_ICONS[ex.key];
    el.currentExName.textContent = ex.name;
    el.checklistCells.forEach(cell => {
      const cellIdx = EXERCISES.findIndex(e => e.key === cell.dataset.ex);
      cell.classList.toggle('is-active', cellIdx === idx);
      cell.classList.toggle('is-done', cellIdx < idx);
    });
  }

  function resetChecklist() {
    el.checklistCells.forEach(cell => { cell.classList.remove('is-active', 'is-done'); });
  }

  // ---------------- phase / set flow ----------------
  function switchToPhase(phase) {
    w.phase = phase;
    w.phaseDuration = phase === 'work' ? WORK_SECONDS : REST_SECONDS;
    w.phaseElapsedBeforePause = 0;
    w.phaseSegStart = now();
    w.lastExIdx = -1;
    w.lastTickSecond = -1;

    el.workoutWrap.dataset.phase = phase;
    el.setCurrent.textContent = w.set;

    if (phase === 'work') {
      el.phaseLabel.textContent = 'בצע את כל התרגילים';
      resetChecklist();
      updateExerciseDisplay(0);
      w.lastExIdx = 0;
      playWorkStart();
      vib([80, 40, 80]);
    } else {
      el.phaseLabel.textContent = 'מנוחה בין סטים';
      playRestStart();
      vib(150);
    }
    renderTimer(w.phaseDuration, w.phaseDuration);
  }

  function advancePhase() {
    if (w.phase === 'work') {
      if (w.set < TOTAL_SETS) {
        switchToPhase('rest');
      } else {
        finishWorkout();
      }
    } else {
      w.set += 1;
      switchToPhase('work');
    }
  }

  function tick() {
    if (!w.running || w.paused) return;
    const elapsed = getPhaseElapsed();
    const remaining = Math.max(0, w.phaseDuration - elapsed);
    renderTimer(remaining, w.phaseDuration);
    renderTotalProgress();

    const intSec = Math.ceil(remaining);
    if (intSec <= 3 && intSec >= 1 && intSec !== w.lastTickSecond) {
      playCountdownBeep();
      w.lastTickSecond = intSec;
    }

    if (w.phase === 'work') {
      const idx = Math.min(EXERCISES.length - 1, Math.floor(elapsed / (w.phaseDuration / EXERCISES.length)));
      if (idx !== w.lastExIdx) {
        w.lastExIdx = idx;
        updateExerciseDisplay(idx);
        playExerciseTick();
        vib(40);
      }
    }

    if (remaining <= 0) advancePhase();
  }

  function startTicking() {
    stopTicking();
    w.timerId = setInterval(tick, 200);
  }
  function stopTicking() {
    if (w.timerId) { clearInterval(w.timerId); w.timerId = null; }
  }

  // ---------------- history ----------------
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }
  function saveHistoryEntry(durationSec) {
    const history = loadHistory();
    history.push({ date: new Date().toISOString(), durationSec });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
  function localDayKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function dayKey(iso) { return localDayKey(new Date(iso)); }
  function computeStreak(history) {
    if (!history.length) return 0;
    const days = Array.from(new Set(history.map(h => dayKey(h.date)))).sort().reverse();
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    let streak = 0;
    const todayKey = localDayKey(cursor);
    if (days[0] !== todayKey) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (const d of days) {
      const cursorKey = localDayKey(cursor);
      if (d === cursorKey) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else if (d < cursorKey) break;
    }
    return streak;
  }
  function renderHomeStats() {
    const history = loadHistory();
    el.statTotal.textContent = history.length;
    el.statStreak.textContent = computeStreak(history);
    el.historyList.innerHTML = '';
    history.slice(-5).reverse().forEach(h => {
      const row = document.createElement('div');
      row.className = 'history-row';
      const date = new Date(h.date);
      const dateStr = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
      const timeStr = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      row.innerHTML = '<span class="hr-date">' + dateStr + ' · ' + timeStr + '</span>' +
        '<span class="hr-dur">' + formatMMSS(h.durationSec) + '</span>';
      el.historyList.appendChild(row);
    });
  }

  // ---------------- screen switching ----------------
  function showScreen(name) {
    [el.home, el.workout, el.done].forEach(s => s.classList.remove('active'));
    ({ home: el.home, workout: el.workout, done: el.done })[name].classList.add('active');
  }

  // ---------------- workout lifecycle ----------------
  function startWorkout() {
    ensureAudio();
    w.set = 1;
    w.running = true;
    w.paused = false;
    w.totalElapsedBeforePause = 0;
    w.totalSegStart = now();
    el.setsProgressFill.style.width = '0%';
    el.btnPause.textContent = 'השהה';
    showScreen('workout');
    switchToPhase('work');
    startTicking();
    acquireWakeLock();
  }

  function togglePause() {
    if (!w.running) return;
    if (!w.paused) {
      w.phaseElapsedBeforePause = getPhaseElapsed();
      w.totalElapsedBeforePause = getTotalElapsed();
      w.paused = true;
      el.btnPause.textContent = 'המשך';
    } else {
      w.phaseSegStart = now();
      w.totalSegStart = now();
      w.paused = false;
      el.btnPause.textContent = 'השהה';
    }
  }

  function finishWorkout() {
    w.running = false;
    stopTicking();
    releaseWakeLock();
    playFanfare();
    vib([100, 60, 100, 60, 200]);
    const durationSec = getTotalElapsed();
    saveHistoryEntry(durationSec);
    el.doneDuration.textContent = formatMMSS(durationSec);
    showScreen('done');
  }

  function stopWorkout() {
    w.running = false;
    stopTicking();
    releaseWakeLock();
    closeModal();
    renderHomeStats();
    showScreen('home');
  }

  function openModal() { el.modal.classList.add('active'); }
  function closeModal() { el.modal.classList.remove('active'); }

  // ---------------- events ----------------
  el.btnStart.addEventListener('click', startWorkout);
  el.btnPause.addEventListener('click', togglePause);
  el.btnSkip.addEventListener('click', () => { if (w.running && !w.paused) advancePhase(); });
  el.btnStop.addEventListener('click', openModal);
  el.btnConfirmStop.addEventListener('click', stopWorkout);
  el.btnCancelStop.addEventListener('click', closeModal);
  el.btnDoneHome.addEventListener('click', () => { renderHomeStats(); showScreen('home'); });

  renderExerciseIcons();
  renderHomeStats();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
