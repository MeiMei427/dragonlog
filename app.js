'use strict';

// =============================================
// DEFAULT DATA
// =============================================
const DEFAULT_EXERCISES = [
  'Bench Press', 'Incline Bench Press', 'Overhead Press',
  'Dumbbell Shoulder Press', 'Tricep Pushdown', 'Dips',
  'Barbell Row', 'Pull-ups', 'Lat Pulldown',
  'Seated Cable Row', 'Face Pull', 'Bicep Curl',
  'Squat', 'Deadlift', 'Romanian Deadlift',
  'Leg Press', 'Leg Curl', 'Leg Extension', 'Calf Raise',
];

// =============================================
// STORE (localStorage)
// =============================================
const Store = {
  _get(key) {
    try { return JSON.parse(localStorage.getItem('dl_' + key)); }
    catch { return null; }
  },
  _set(key, val) {
    localStorage.setItem('dl_' + key, JSON.stringify(val));
  },

  getExercises() { return this._get('exercises') || [...DEFAULT_EXERCISES]; },
  setExercises(list) { this._set('exercises', list.sort()); },

  getWorkouts() { return this._get('workouts') || []; },
  addWorkout(w) {
    const all = this.getWorkouts();
    all.unshift(w);
    this._set('workouts', all);
  },
  updateWorkout(w) {
    const all = this.getWorkouts();
    const i = all.findIndex(x => x.id === w.id);
    if (i !== -1) { all[i] = w; this._set('workouts', all); }
  },
  deleteWorkout(id) {
    this._set('workouts', this.getWorkouts().filter(w => w.id !== id));
  },

  getRuns() { return this._get('runs') || []; },
  addRun(r) {
    const all = this.getRuns();
    all.unshift(r);
    this._set('runs', all);
  },
  deleteRun(id) {
    this._set('runs', this.getRuns().filter(r => r.id !== id));
  },

  getWeights() { return this._get('weights') || []; },
  addWeight(entry) {
    const all = this.getWeights();
    const i = all.findIndex(w => w.date === entry.date);
    if (i !== -1) all[i] = entry;
    else all.push(entry);
    all.sort((a, b) => a.date.localeCompare(b.date));
    this._set('weights', all);
  },
  deleteWeight(date) {
    this._set('weights', this.getWeights().filter(w => w.date !== date));
  },

  getSettings() { return this._get('settings') || { unit: 'lbs' }; },
  setSettings(s) { this._set('settings', s); },

  exportAll() {
    return {
      exercises: this.getExercises(),
      workouts: this.getWorkouts(),
      runs: this.getRuns(),
      weights: this.getWeights(),
      settings: this.getSettings(),
      exportDate: new Date().toISOString(),
      version: 1,
    };
  },
  importAll(data) {
    if (data.exercises) this.setExercises(data.exercises);
    if (data.workouts) this._set('workouts', data.workouts);
    if (data.runs) this._set('runs', data.runs);
    if (data.weights) this._set('weights', data.weights);
    if (data.settings) this.setSettings(data.settings);
  },
};

// =============================================
// APP STATE
// =============================================
let currentView = 'home';
let viewParams = {};
let navHistory = [];
let historyTab = 'workouts';
let runFilter = 'all';

// =============================================
// HELPERS
// =============================================
const $ = id => document.getElementById(id);
const main = () => $('app-main');
const unit = () => Store.getSettings().unit;
const today = () => new Date().toISOString().split('T')[0];

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getLastSession(exerciseName) {
  const workouts = Store.getWorkouts();
  for (const w of workouts) {
    const ex = w.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets.length > 0) return { date: w.date, sets: ex.sets };
  }
  return null;
}

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function showConfirm(msg, onYes) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <p>${msg}</p>
      <div class="actions">
        <button class="btn btn-secondary btn-sm" data-confirm="no">Cancel</button>
        <button class="btn btn-danger btn-sm" data-confirm="yes">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    const btn = e.target.closest('[data-confirm]');
    if (!btn) return;
    overlay.remove();
    if (btn.dataset.confirm === 'yes') onYes();
  });
}

function rirOptions(selected) {
  return [0,1,2,3,4,5].map(v =>
    `<option value="${v}" ${v === selected ? 'selected' : ''}>${v === 0 ? '0 (fail)' : v === 5 ? '5+ (easy)' : v}</option>`
  ).join('');
}

// =============================================
// NAVIGATION
// =============================================
function navigate(view, params = {}) {
  navHistory.push({ view: currentView, params: viewParams });
  if (navHistory.length > 30) navHistory.shift();
  currentView = view;
  viewParams = params;
  render();
}

function goBack() {
  if (navHistory.length > 0) {
    const prev = navHistory.pop();
    currentView = prev.view;
    viewParams = prev.params;
  } else {
    currentView = 'home';
    viewParams = {};
  }
  render();
}

function render() {
  const backBtn = $('back-btn');
  const headerText = $('header-text');
  const topViews = ['home', 'history', 'settings'];

  if (topViews.includes(currentView)) {
    backBtn.classList.add('hidden');
    headerText.textContent = 'DragonLog';
  } else {
    backBtn.classList.remove('hidden');
  }

  // Bottom nav highlight
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const nav = btn.dataset.nav;
    let active = nav === currentView;
    if (nav === 'history' && (currentView.startsWith('workout') || currentView.startsWith('run') || currentView.startsWith('weight') || currentView === 'exercise-history')) {
      if (currentView !== 'workout-select' && currentView !== 'workout-active') active = true;
    }
    btn.classList.toggle('active', active);
  });

  // Render view
  const views = {
    'home': viewHome,
    'history': viewHistory,
    'settings': viewSettings,
    'workout-select': viewWorkoutSelect,
    'workout-active': viewWorkoutActive,
    'workout-detail': viewWorkoutDetail,
    'exercise-history': viewExerciseHistory,
    'exercise-library': viewExerciseLibrary,
    'run-new': viewRunNew,
    'weight-new': viewWeightNew,
  };

  const fn = views[currentView];
  if (fn) fn();

  main().scrollTop = 0;
}

// =============================================
// VIEW: HOME
// =============================================
function viewHome() {
  const workouts = Store.getWorkouts();
  const runs = Store.getRuns();
  const weights = Store.getWeights();

  const lastWorkout = workouts[0];
  const lastRun = runs[0];
  const lastWeight = weights[weights.length - 1];

  main().innerHTML = `
    <div class="dashboard-stats">
      <div class="stat-card">
        <div class="label">Last Workout</div>
        <div class="value">${lastWorkout ? formatDateShort(lastWorkout.date) : '—'}</div>
      </div>
      <div class="stat-card">
        <div class="label">Last Run</div>
        <div class="value">${lastRun ? formatDateShort(lastRun.date) : '—'}</div>
      </div>
      <div class="stat-card">
        <div class="label">Weight</div>
        <div class="value">${lastWeight ? lastWeight.weight + ' ' + unit() : '—'}</div>
      </div>
    </div>

    <div class="action-buttons">
      <button class="action-btn" data-action="go-workout-select">
        <div class="icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M6 4v16M18 4v16M2 8h4M18 8h4M2 16h4M18 16h4M6 12h12"/></svg>
        </div>
        <div>
          Log Workout
          <div class="desc">Track sets, reps, weight & RIR</div>
        </div>
      </button>
      <button class="action-btn" data-action="go-run-new">
        <div class="icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/><path d="M4 17l3-3 2 2 4-4 3 3"/></svg>
        </div>
        <div>
          Log Run
          <div class="desc">Running, sprinting, intervals</div>
        </div>
      </button>
      <button class="action-btn" data-action="go-weight-new">
        <div class="icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 20V4M4 12h16"/></svg>
        </div>
        <div>
          Log Weight
          <div class="desc">Track bodyweight over time</div>
        </div>
      </button>
    </div>`;
}

// =============================================
// VIEW: WORKOUT SELECT
// =============================================
function viewWorkoutSelect() {
  $('header-text').textContent = 'Select Exercises';
  const exercises = Store.getExercises();

  main().innerHTML = `
    <div style="padding-top:12px">
      <ul class="exercise-list">
        ${exercises.map(name => `
          <li>
            <input type="checkbox" id="ex_${name.replace(/\s/g, '_')}" value="${name}">
            <label for="ex_${name.replace(/\s/g, '_')}">${name}</label>
          </li>
        `).join('')}
      </ul>
      <div class="add-exercise-row">
        <input type="text" id="quick-add-input" placeholder="Add new exercise...">
        <button class="btn btn-secondary btn-sm" data-action="quick-add-exercise">Add</button>
      </div>
      <button class="btn btn-primary btn-block" data-action="start-workout">Start Workout</button>
    </div>`;

  // Make the entire li toggle the checkbox
  main().querySelectorAll('.exercise-list li').forEach(li => {
    li.addEventListener('click', e => {
      if (e.target.tagName === 'INPUT') return;
      const cb = li.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
    });
  });
}

// =============================================
// VIEW: WORKOUT ACTIVE
// =============================================
function viewWorkoutActive() {
  $('header-text').textContent = 'Log Workout';
  const exercises = viewParams.exercises || [];
  const editWorkout = viewParams.edit || null;
  const u = unit();

  let html = '<div style="padding-top:12px">';

  exercises.forEach((name, exIdx) => {
    const last = getLastSession(name);
    const editEx = editWorkout ? editWorkout.exercises.find(e => e.name === name) : null;
    const initialSets = editEx ? editEx.sets :
      (last ? last.sets.map(s => ({ reps: s.reps, weight: s.weight, rir: s.rir })) :
      [{ reps: '', weight: '', rir: 3 }]);

    html += `
      <div class="exercise-block" data-exercise="${name}" data-ex-idx="${exIdx}">
        <h3>${name}</h3>
        ${last && !editWorkout ? `<div class="last-session">Last (${formatDateShort(last.date)}): ${last.sets.map(s => `${s.reps}×${s.weight}`).join(', ')} ${u}</div>` : ''}
        <div class="set-header">
          <span>Set</span><span>Reps</span><span>${u}</span><span>RIR</span><span></span>
        </div>
        <div class="sets-container">
          ${initialSets.map((s, setIdx) => setRowHTML(setIdx + 1, s, u)).join('')}
        </div>
        <button class="add-set-btn" data-action="add-set" data-ex-idx="${exIdx}">+ Add Set</button>
      </div>`;
  });

  html += `
    <div class="form-group mt-16">
      <label for="workout-notes">Notes</label>
      <textarea id="workout-notes" placeholder="Energy level, sleep, how it felt...">${editWorkout ? (editWorkout.notes || '') : ''}</textarea>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:24px;">
      <button class="btn btn-secondary" style="flex:1" data-action="cancel-workout">Cancel</button>
      <button class="btn btn-primary" style="flex:2" data-action="finish-workout">${editWorkout ? 'Save Changes' : 'Finish Workout'}</button>
    </div>
    <button class="btn btn-ghost btn-block text-sm" data-action="add-exercise-during">+ Add Another Exercise</button>
  </div>`;

  main().innerHTML = html;
}

function setRowHTML(num, set, u) {
  return `
    <div class="set-row">
      <span class="set-num">${num}</span>
      <input type="number" class="reps-input" value="${set.reps}" placeholder="0" inputmode="numeric">
      <input type="number" class="weight-input" value="${set.weight}" placeholder="0" inputmode="decimal" step="any">
      <select class="rir-select">${rirOptions(set.rir != null ? set.rir : 3)}</select>
      <button class="remove-set-btn" data-action="remove-set">&times;</button>
    </div>`;
}

// =============================================
// VIEW: HISTORY
// =============================================
function viewHistory() {
  let html = `
    <div style="padding-top:12px">
      <div class="tabs">
        <button class="tab ${historyTab === 'workouts' ? 'active' : ''}" data-tab="workouts">Workouts</button>
        <button class="tab ${historyTab === 'runs' ? 'active' : ''}" data-tab="runs">Runs</button>
        <button class="tab ${historyTab === 'weights' ? 'active' : ''}" data-tab="weights">Weight</button>
      </div>
      <div id="history-content"></div>
    </div>`;
  main().innerHTML = html;
  renderHistoryTab();
}

function renderHistoryTab() {
  const container = $('history-content');
  if (historyTab === 'workouts') renderWorkoutHistory(container);
  else if (historyTab === 'runs') renderRunHistory(container);
  else renderWeightHistory(container);
}

function renderWorkoutHistory(el) {
  const workouts = Store.getWorkouts();
  if (workouts.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>No workouts yet. Hit the home screen to log your first one.</p></div>';
    return;
  }
  el.innerHTML = workouts.map(w => {
    const names = w.exercises.map(e => e.name).join(', ');
    const totalSets = w.exercises.reduce((sum, e) => sum + e.sets.length, 0);
    return `
      <div class="card" data-action="view-workout" data-id="${w.id}">
        <div class="card-date">${formatDate(w.date)}</div>
        <div class="card-title">${names}</div>
        <div class="card-meta">${w.exercises.length} exercise${w.exercises.length > 1 ? 's' : ''} &middot; ${totalSets} sets${w.notes ? ' &middot; ' + truncate(w.notes, 40) : ''}</div>
      </div>`;
  }).join('');
}

function renderRunHistory(el) {
  const runs = Store.getRuns();
  const filtered = runFilter === 'all' ? runs : runs.filter(r => r.type === runFilter);

  let html = `
    <div class="tabs" style="margin-bottom:12px">
      <button class="tab ${runFilter === 'all' ? 'active' : ''}" data-run-filter="all">All</button>
      <button class="tab ${runFilter === 'run' ? 'active' : ''}" data-run-filter="run">Run</button>
      <button class="tab ${runFilter === 'sprint' ? 'active' : ''}" data-run-filter="sprint">Sprint</button>
      <button class="tab ${runFilter === 'intervals' ? 'active' : ''}" data-run-filter="intervals">Intervals</button>
    </div>`;

  if (filtered.length === 0) {
    html += '<div class="empty-state"><p>No runs logged yet.</p></div>';
  } else {
    html += filtered.map(r => `
      <div class="card" data-action="delete-run-confirm" data-id="${r.id}">
        <div class="card-date">${formatDate(r.date)} &middot; <span style="text-transform:capitalize">${r.type}</span></div>
        <div class="card-title">${r.distance || '—'}${r.time ? ' &middot; ' + r.time : ''}</div>
        ${r.notes ? `<div class="card-meta">${r.notes}</div>` : ''}
      </div>`).join('');
  }
  el.innerHTML = html;
}

function renderWeightHistory(el) {
  const weights = Store.getWeights();
  const u = unit();

  if (weights.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>No weight entries yet.</p></div>';
    return;
  }

  let html = '<canvas id="weight-chart"></canvas>';
  html += `<table class="data-table"><thead><tr><th>Date</th><th>Weight</th><th>Change</th></tr></thead><tbody>`;

  // Show newest first in table
  const reversed = [...weights].reverse();
  reversed.forEach((w, i) => {
    const prevIdx = weights.length - 1 - i - 1;
    const prev = prevIdx >= 0 ? weights[prevIdx] : null;
    const change = prev ? (w.weight - prev.weight).toFixed(1) : '—';
    const changeClass = change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : '';
    const changeStr = change === '—' ? '—' : (change > 0 ? '+' + change : change);
    html += `<tr data-action="delete-weight-confirm" data-date="${w.date}" style="cursor:pointer">
      <td>${formatDateShort(w.date)}</td>
      <td>${w.weight} ${u}</td>
      <td class="${changeClass}">${changeStr} ${change !== '—' ? u : ''}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  el.innerHTML = html;

  // Draw chart
  if (weights.length >= 2) {
    requestAnimationFrame(() => drawWeightChart(weights));
  }
}

// =============================================
// VIEW: WORKOUT DETAIL
// =============================================
function viewWorkoutDetail() {
  const id = viewParams.id;
  const w = Store.getWorkouts().find(x => x.id === id);
  if (!w) { goBack(); return; }

  $('header-text').textContent = formatDate(w.date);
  const u = unit();

  let html = '<div style="padding-top:12px">';
  w.exercises.forEach(ex => {
    html += `
      <div class="detail-section">
        <h3><span class="clickable-exercise" data-action="view-exercise-history" data-name="${ex.name}">${ex.name}</span></h3>
        ${ex.sets.map((s, i) => `
          <div class="set-detail">Set ${i+1}: ${s.reps} &times; ${s.weight} ${u} (RIR ${s.rir != null ? s.rir : '—'})</div>
        `).join('')}
      </div>`;
  });

  if (w.notes) {
    html += `<div class="detail-notes">${w.notes}</div>`;
  }

  html += `
    <div class="detail-actions">
      <button class="btn btn-secondary" style="flex:1" data-action="edit-workout" data-id="${w.id}">Edit</button>
      <button class="btn btn-danger" style="flex:1" data-action="delete-workout" data-id="${w.id}">Delete</button>
    </div>
  </div>`;

  main().innerHTML = html;
}

// =============================================
// VIEW: EXERCISE HISTORY
// =============================================
function viewExerciseHistory() {
  const name = viewParams.name;
  $('header-text').textContent = name;
  const u = unit();
  const workouts = Store.getWorkouts();

  const sessions = [];
  for (const w of workouts) {
    const ex = w.exercises.find(e => e.name === name);
    if (ex && ex.sets.length > 0) {
      sessions.push({ date: w.date, sets: ex.sets });
    }
  }

  if (sessions.length === 0) {
    main().innerHTML = '<div class="empty-state" style="padding-top:40px"><p>No history for this exercise yet.</p></div>';
    return;
  }

  let html = '<div style="padding-top:12px">';
  html += `<table class="data-table"><thead><tr><th>Date</th><th>Sets</th><th>Details</th></tr></thead><tbody>`;

  sessions.forEach(s => {
    const details = s.sets.map(set => `${set.reps}&times;${set.weight}`).join(', ');
    const rirs = s.sets.map(set => set.rir != null ? set.rir : '—').join(',');
    html += `<tr>
      <td>${formatDateShort(s.date)}</td>
      <td>${s.sets.length}</td>
      <td>${details} ${u}<br><span class="text-muted text-sm">RIR: ${rirs}</span></td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  main().innerHTML = html;
}

// =============================================
// VIEW: EXERCISE LIBRARY
// =============================================
function viewExerciseLibrary() {
  $('header-text').textContent = 'Exercise Library';
  const exercises = Store.getExercises();

  let html = `
    <div style="padding-top:12px">
      <div class="add-exercise-row">
        <input type="text" id="new-exercise-input" placeholder="New exercise name...">
        <button class="btn btn-primary btn-sm" data-action="add-exercise">Add</button>
      </div>
      ${exercises.map(name => `
        <div class="library-item">
          <span class="clickable-exercise" data-action="view-exercise-history" data-name="${name}">${name}</span>
          <button class="delete-ex" data-action="remove-exercise" data-name="${name}">&times;</button>
        </div>
      `).join('')}
    </div>`;

  main().innerHTML = html;
}

// =============================================
// VIEW: RUN NEW
// =============================================
function viewRunNew() {
  $('header-text').textContent = 'Log Run';

  main().innerHTML = `
    <div style="padding-top:12px">
      <div class="form-group">
        <label for="run-date">Date</label>
        <input type="date" id="run-date" value="${today()}">
      </div>
      <div class="form-group">
        <label for="run-type">Type</label>
        <select id="run-type">
          <option value="run">Run</option>
          <option value="sprint">Sprint</option>
          <option value="intervals">Intervals</option>
        </select>
      </div>
      <div class="form-group">
        <label for="run-distance">Distance</label>
        <input type="text" id="run-distance" placeholder="e.g. 3 miles, 5K">
      </div>
      <div class="form-group">
        <label for="run-time">Time</label>
        <input type="text" id="run-time" placeholder="e.g. 24:30">
      </div>
      <div class="form-group">
        <label for="run-notes">Notes</label>
        <textarea id="run-notes" placeholder="Details, intervals, how it felt..."></textarea>
      </div>
      <button class="btn btn-primary btn-block" data-action="save-run">Save Run</button>
    </div>`;
}

// =============================================
// VIEW: WEIGHT NEW
// =============================================
function viewWeightNew() {
  $('header-text').textContent = 'Log Weight';
  const u = unit();

  main().innerHTML = `
    <div style="padding-top:12px">
      <div class="form-group">
        <label for="bw-date">Date</label>
        <input type="date" id="bw-date" value="${today()}">
      </div>
      <div class="form-group">
        <label for="bw-weight">Weight (${u})</label>
        <input type="number" id="bw-weight" placeholder="0" inputmode="decimal" step="0.1">
      </div>
      <button class="btn btn-primary btn-block" data-action="save-weight">Save Weight</button>
    </div>`;
}

// =============================================
// VIEW: SETTINGS
// =============================================
function viewSettings() {
  const u = unit();

  main().innerHTML = `
    <div style="padding-top:12px">
      <div class="section-title">Preferences</div>
      <div class="setting-row">
        <div>
          <div class="label">Weight Unit</div>
          <div class="sublabel">Used for all weight displays</div>
        </div>
        <button class="toggle-btn" data-action="toggle-unit">${u}</button>
      </div>

      <div class="section-title">Exercise Library</div>
      <div class="setting-row" data-action="go-exercise-library" style="cursor:pointer">
        <div>
          <div class="label">Manage Exercises</div>
          <div class="sublabel">${Store.getExercises().length} exercises</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>

      <div class="section-title">Data</div>
      <div class="setting-row" data-action="export-data" style="cursor:pointer">
        <div>
          <div class="label">Export Data</div>
          <div class="sublabel">Download backup as JSON</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <div class="setting-row" data-action="import-data" style="cursor:pointer">
        <div>
          <div class="label">Import Data</div>
          <div class="sublabel">Restore from a JSON backup</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      </div>
      <div class="section-title">About</div>
      <div class="setting-row">
        <div>
          <div class="label">DragonLog</div>
          <div class="sublabel">v1.0 &middot; All data stored locally on this device</div>
        </div>
      </div>
    </div>`;
}

// =============================================
// EVENT HANDLERS
// =============================================
function handleMainClick(e) {
  // Tab clicks
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    historyTab = tab.dataset.tab;
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === historyTab));
    renderHistoryTab();
    return;
  }

  // Run filter clicks
  const rf = e.target.closest('[data-run-filter]');
  if (rf) {
    runFilter = rf.dataset.runFilter;
    renderHistoryTab();
    return;
  }

  // Data-action clicks
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  switch (action) {
    case 'go-workout-select': navigate('workout-select'); break;
    case 'go-run-new': navigate('run-new'); break;
    case 'go-weight-new': navigate('weight-new'); break;
    case 'go-exercise-library': navigate('exercise-library'); break;

    case 'start-workout': handleStartWorkout(); break;
    case 'quick-add-exercise': handleQuickAddExercise(); break;
    case 'add-set': handleAddSet(actionEl); break;
    case 'remove-set': handleRemoveSet(actionEl); break;
    case 'finish-workout': handleFinishWorkout(); break;
    case 'cancel-workout': handleCancelWorkout(); break;
    case 'add-exercise-during': handleAddExerciseDuring(); break;

    case 'save-run': handleSaveRun(); break;
    case 'save-weight': handleSaveWeight(); break;

    case 'view-workout': navigate('workout-detail', { id: actionEl.dataset.id }); break;
    case 'edit-workout': handleEditWorkout(actionEl.dataset.id); break;
    case 'delete-workout': handleDeleteWorkout(actionEl.dataset.id); break;
    case 'delete-run-confirm': handleDeleteRunConfirm(actionEl.dataset.id); break;
    case 'delete-weight-confirm': handleDeleteWeightConfirm(actionEl.dataset.date); break;

    case 'view-exercise-history': navigate('exercise-history', { name: actionEl.dataset.name }); break;

    case 'toggle-unit': handleToggleUnit(); break;
    case 'export-data': handleExportData(); break;
    case 'import-data': $('import-file').click(); break;
    case 'add-exercise': handleAddExerciseLibrary(); break;
    case 'remove-exercise': handleRemoveExercise(actionEl.dataset.name); break;
  }
}

function handleStartWorkout() {
  const checked = main().querySelectorAll('.exercise-list input:checked');
  if (checked.length === 0) {
    showToast('Select at least one exercise');
    return;
  }
  const exercises = Array.from(checked).map(cb => cb.value);
  navigate('workout-active', { exercises });
}

function handleQuickAddExercise() {
  const input = $('quick-add-input');
  const name = input.value.trim();
  if (!name) return;
  const exercises = Store.getExercises();
  if (exercises.includes(name)) {
    showToast('Exercise already exists');
    return;
  }
  exercises.push(name);
  Store.setExercises(exercises);
  input.value = '';
  viewWorkoutSelect(); // re-render
  showToast('Added: ' + name);
}

function handleAddSet(btn) {
  const block = btn.closest('.exercise-block');
  const container = block.querySelector('.sets-container');
  const rows = container.querySelectorAll('.set-row');
  const lastRow = rows[rows.length - 1];
  const newNum = rows.length + 1;
  const u = unit();

  // Pre-fill from last row
  const reps = lastRow ? lastRow.querySelector('.reps-input').value : '';
  const weight = lastRow ? lastRow.querySelector('.weight-input').value : '';
  const rir = lastRow ? parseInt(lastRow.querySelector('.rir-select').value) : 3;

  const temp = document.createElement('div');
  temp.innerHTML = setRowHTML(newNum, { reps, weight, rir }, u);
  const newRow = temp.firstElementChild;
  container.appendChild(newRow);

  // Focus reps input
  newRow.querySelector('.reps-input').focus();
}

function handleRemoveSet(btn) {
  const row = btn.closest('.set-row');
  const container = row.parentElement;
  if (container.querySelectorAll('.set-row').length <= 1) {
    showToast('Need at least one set');
    return;
  }
  row.remove();
  // Renumber sets
  container.querySelectorAll('.set-row').forEach((r, i) => {
    r.querySelector('.set-num').textContent = i + 1;
  });
}

function handleFinishWorkout() {
  const blocks = main().querySelectorAll('.exercise-block');
  const exercises = [];

  blocks.forEach(block => {
    const name = block.dataset.exercise;
    const sets = [];
    block.querySelectorAll('.set-row').forEach(row => {
      const reps = parseInt(row.querySelector('.reps-input').value) || 0;
      const weight = parseFloat(row.querySelector('.weight-input').value) || 0;
      const rir = parseInt(row.querySelector('.rir-select').value);
      if (reps > 0 || weight > 0) {
        sets.push({ reps, weight, rir });
      }
    });
    if (sets.length > 0) {
      exercises.push({ name, sets });
    }
  });

  if (exercises.length === 0) {
    showToast('Log at least one set');
    return;
  }

  const notes = ($('workout-notes') || {}).value || '';
  const editWorkout = viewParams.edit;

  if (editWorkout) {
    Store.updateWorkout({
      ...editWorkout,
      exercises,
      notes,
    });
    showToast('Workout updated');
  } else {
    Store.addWorkout({
      id: generateId('w'),
      date: today(),
      exercises,
      notes,
    });
    showToast('Workout saved!');
  }

  // Clear nav history back to home
  navHistory = [];
  currentView = 'home';
  viewParams = {};
  render();
}

function handleCancelWorkout() {
  showConfirm('Discard this workout?', () => {
    goBack();
    goBack(); // Past the select screen too
  });
}

function handleAddExerciseDuring() {
  const name = prompt('Exercise name:');
  if (!name || !name.trim()) return;
  const trimmed = name.trim();

  // Add to library if not already there
  const lib = Store.getExercises();
  if (!lib.includes(trimmed)) {
    lib.push(trimmed);
    Store.setExercises(lib);
  }

  // Add to current workout
  viewParams.exercises = [...(viewParams.exercises || []), trimmed];
  viewWorkoutActive();
  showToast('Added: ' + trimmed);
}

function handleSaveRun() {
  const date = $('run-date').value;
  const type = $('run-type').value;
  const distance = $('run-distance').value.trim();
  const time = $('run-time').value.trim();
  const notes = $('run-notes').value.trim();

  if (!date) { showToast('Please enter a date'); return; }

  Store.addRun({
    id: generateId('r'),
    date, type, distance, time, notes,
  });

  showToast('Run saved!');
  navHistory = [];
  currentView = 'home';
  viewParams = {};
  render();
}

function handleSaveWeight() {
  const date = $('bw-date').value;
  const weight = parseFloat($('bw-weight').value);

  if (!date) { showToast('Please enter a date'); return; }
  if (!weight || weight <= 0) { showToast('Please enter a valid weight'); return; }

  Store.addWeight({ date, weight });
  showToast('Weight saved!');
  navHistory = [];
  currentView = 'home';
  viewParams = {};
  render();
}

function handleEditWorkout(id) {
  const w = Store.getWorkouts().find(x => x.id === id);
  if (!w) return;
  navigate('workout-active', {
    exercises: w.exercises.map(e => e.name),
    edit: w,
  });
}

function handleDeleteWorkout(id) {
  showConfirm('Delete this workout?', () => {
    Store.deleteWorkout(id);
    showToast('Workout deleted');
    goBack();
  });
}

function handleDeleteRunConfirm(id) {
  showConfirm('Delete this run entry?', () => {
    Store.deleteRun(id);
    showToast('Run deleted');
    renderHistoryTab();
  });
}

function handleDeleteWeightConfirm(date) {
  showConfirm('Delete this weight entry?', () => {
    Store.deleteWeight(date);
    showToast('Entry deleted');
    renderHistoryTab();
  });
}

function handleToggleUnit() {
  const settings = Store.getSettings();
  settings.unit = settings.unit === 'lbs' ? 'kg' : 'lbs';
  Store.setSettings(settings);
  viewSettings();
  showToast('Unit: ' + settings.unit);
}

function handleExportData() {
  const data = Store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dragonlog-backup-' + today() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported!');
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      showConfirm('This will replace all your current data. Continue?', () => {
        Store.importAll(data);
        showToast('Data imported!');
        render();
      });
    } catch {
      showToast('Invalid file format');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function handleAddExerciseLibrary() {
  const input = $('new-exercise-input');
  const name = input.value.trim();
  if (!name) return;
  const exercises = Store.getExercises();
  if (exercises.includes(name)) {
    showToast('Already exists');
    return;
  }
  exercises.push(name);
  Store.setExercises(exercises);
  viewExerciseLibrary();
  showToast('Added: ' + name);
}

function handleRemoveExercise(name) {
  showConfirm(`Remove "${name}" from library?`, () => {
    const exercises = Store.getExercises().filter(e => e !== name);
    Store.setExercises(exercises);
    viewExerciseLibrary();
    showToast('Removed');
  });
}

// =============================================
// WEIGHT CHART
// =============================================
function drawWeightChart(entries) {
  const canvas = $('weight-chart');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 15, right: 15, bottom: 30, left: 50 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const weights = entries.map(e => e.weight);
  const minW = Math.min(...weights) - 1;
  const maxW = Math.max(...weights) + 1;
  const range = maxW - minW || 1;

  // Grid lines
  ctx.strokeStyle = '#2a3555';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * plotH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  // Line
  ctx.strokeStyle = '#7E6DAF';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  entries.forEach((entry, i) => {
    const x = entries.length === 1 ? pad.left + plotW / 2 : pad.left + (i / (entries.length - 1)) * plotW;
    const y = pad.top + (1 - (entry.weight - minW) / range) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points
  ctx.fillStyle = '#7E6DAF';
  entries.forEach((entry, i) => {
    const x = entries.length === 1 ? pad.left + plotW / 2 : pad.left + (i / (entries.length - 1)) * plotW;
    const y = pad.top + (1 - (entry.weight - minW) / range) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Y-axis labels
  ctx.fillStyle = '#8892a4';
  ctx.font = '11px system-ui';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const val = minW + range * (1 - i / 4);
    const y = pad.top + (i / 4) * plotH;
    ctx.fillText(val.toFixed(1), pad.left - 6, y);
  }

  // X-axis date labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const maxLabels = Math.min(entries.length, 6);
  const step = Math.max(1, Math.floor((entries.length - 1) / (maxLabels - 1)));
  for (let i = 0; i < entries.length; i += step) {
    const x = entries.length === 1 ? pad.left + plotW / 2 : pad.left + (i / (entries.length - 1)) * plotW;
    const parts = entries[i].date.split('-');
    ctx.fillText(`${parseInt(parts[1])}/${parseInt(parts[2])}`, x, h - pad.bottom + 6);
  }
  // Always show last
  if ((entries.length - 1) % step !== 0 && entries.length > 1) {
    const x = pad.left + plotW;
    const parts = entries[entries.length - 1].date.split('-');
    ctx.fillText(`${parseInt(parts[1])}/${parseInt(parts[2])}`, x, h - pad.bottom + 6);
  }
}

// =============================================
// UTILITY
// =============================================
function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

// =============================================
// INIT
// =============================================
function init() {
  try {
    const el = document.getElementById('app-main');
    if (!el) return;

    // Event delegation on main content
    el.addEventListener('click', handleMainClick);

    // Bottom nav
    $('bottom-nav').addEventListener('click', e => {
      const btn = e.target.closest('.nav-btn');
      if (!btn) return;
      const view = btn.dataset.nav;
      navHistory = [];
      currentView = view;
      viewParams = {};
      render();
    });

    // Back button
    $('back-btn').addEventListener('click', goBack);

    // File import
    $('import-file').addEventListener('change', handleImportFile);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Initial render
    render();
  } catch (e) {
    document.getElementById('app-main').innerHTML =
      '<pre style="color:red;padding:20px;word-wrap:break-word">' + e.message + '\n' + e.stack + '</pre>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
