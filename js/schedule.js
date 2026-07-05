/* schedule.js - class timetable, to-do list, study planner, pomodoro, exam tracker, habit tracker */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let scheduleTab = 'timetable';
let pomodoroState = { seconds: 25 * 60, running: false, mode: 'work', interval: null };

function renderSchedule() {
  const tabs = ['timetable', 'todo', 'study', 'exams', 'habits'];
  const labels = { timetable: 'Class Routine', todo: 'To-Do List', study: 'Study Planner', exams: 'Exams & Deadlines', habits: 'Habit Tracker' };
  return `
    <div class="tabs">${tabs.map(t => `<button class="tab-btn ${scheduleTab===t?'active':''}" onclick="setScheduleTab('${t}')">${labels[t]}</button>`).join('')}</div>
    <div id="schedule-tab-content">${renderScheduleTab()}</div>
  `;
}

function setScheduleTab(tab) { scheduleTab = tab; render(); }

function renderScheduleTab() {
  switch (scheduleTab) {
    case 'timetable': return renderTimetable();
    case 'todo': return renderTodo();
    case 'study': return renderStudy();
    case 'exams': return renderExams();
    case 'habits': return renderHabits();
  }
}

function bindScheduleEvents() {
  const addClassBtn = document.getElementById('add-class-btn');
  if (addClassBtn) addClassBtn.onclick = () => {
    const day = document.getElementById('cls-day').value;
    const start = document.getElementById('cls-start').value;
    const end = document.getElementById('cls-end').value;
    const subject = document.getElementById('cls-subject').value.trim();
    const location = document.getElementById('cls-location').value.trim();
    const alarm = document.getElementById('cls-alarm').checked;
    if (!subject || !start || !end) return showToast('Fill in subject, start and end time');
    DB.classes.push({ id: uid(), day, start, end, subject, location, alarm });
    persist(); render();
  };

  const addTodoBtn = document.getElementById('add-todo-btn');
  if (addTodoBtn) addTodoBtn.onclick = () => {
    const title = document.getElementById('todo-title').value.trim();
    const due = document.getElementById('todo-due').value;
    const priority = document.getElementById('todo-priority').value;
    const category = document.getElementById('todo-category').value;
    if (!title) return showToast('Enter a task title');
    DB.todos.push({ id: uid(), title, due, priority, category, done: false });
    persist(); render();
  };

  const addStudyBtn = document.getElementById('add-study-btn');
  if (addStudyBtn) addStudyBtn.onclick = () => {
    const subject = document.getElementById('study-subject').value.trim();
    const date = document.getElementById('study-date').value || todayStr();
    const duration = Number(document.getElementById('study-duration').value);
    if (!subject || !duration) return showToast('Enter subject and duration');
    DB.studySessions.push({ id: uid(), subject, date, duration });
    persist(); render();
  };

  const addExamBtn = document.getElementById('add-exam-btn');
  if (addExamBtn) addExamBtn.onclick = () => {
    const subject = document.getElementById('exam-subject').value.trim();
    const date = document.getElementById('exam-date').value;
    const time = document.getElementById('exam-time').value || '09:00';
    const alarm = document.getElementById('exam-alarm').checked;
    if (!subject || !date) return showToast('Enter subject and date');
    DB.exams.push({ id: uid(), subject, date, time, alarm, syllabus: [] });
    persist(); render();
  };

  const addHabitBtn = document.getElementById('add-habit-btn');
  if (addHabitBtn) addHabitBtn.onclick = () => {
    const name = document.getElementById('habit-name').value.trim();
    if (!name) return showToast('Enter habit name');
    DB.habits.push({ id: uid(), name, log: {} });
    persist(); render();
  };

  initPomodoroUI();
}

/* ---------- Timetable ---------- */
function renderTimetable() {
  return `
    <div class="card">
      <h3>Add Class</h3>
      <div class="form-row">
        <select id="cls-day">${DAYS.map(d => `<option>${d}</option>`).join('')}</select>
        <input type="time" id="cls-start">
        <input type="time" id="cls-end">
      </div>
      <div class="form-row">
        <input type="text" id="cls-subject" placeholder="Subject name">
        <input type="text" id="cls-location" placeholder="Location (optional)">
      </div>
      <div class="form-row" style="align-items:center;">
        <label class="checkbox-row" style="cursor:pointer;"><input type="checkbox" id="cls-alarm" checked> 🔔 Set alarm at class start time</label>
      </div>
      <button class="btn" id="add-class-btn">＋ Add Class</button>
    </div>
    <div class="section-title">Weekly Timetable</div>
    <div class="card" style="overflow-x:auto;">
      <div class="timetable">
        <div class="tt-head"></div>
        ${DAYS.map(d => `<div class="tt-head">${d.slice(0,3)}</div>`).join('')}
        <div class="tt-cell" style="background:transparent;border:none;"></div>
        ${DAYS.map(d => `<div class="tt-cell">
          ${DB.classes.filter(c => c.day === d).sort((a,b)=>a.start.localeCompare(b.start)).map(c => `
            <div class="tt-class" onclick="deleteClass('${c.id}')" title="Click to remove">${c.alarm !== false ? '🔔 ' : ''}${escapeHtml(c.subject)}<br>${c.start}-${c.end}</div>
          `).join('')}
        </div>`).join('')}
      </div>
    </div>
  `;
}
function deleteClass(id) { DB.classes = DB.classes.filter(c => c.id !== id); persist(); render(); }

/* Alarm check: fires once per class per day, at its scheduled start time */
function checkDueClasses() {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const todayKey = todayStr();
  let changed = false;
  DB.classes.forEach(c => {
    if (c.alarm === false) return;
    if (c.day !== weekday) return;
    if (c._lastAlertDate === todayKey) return;
    const [h, m] = c.start.split(':').map(Number);
    const classTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    if (classTime <= now && classTime > new Date(now - 5 * 60000)) {
      triggerAlarm('Class: ' + c.subject, c.start + '-' + c.end + (c.location ? ' · ' + c.location : ''));
      c._lastAlertDate = todayKey;
      changed = true;
    }
  });
  if (changed) persist();
}

/* Alarm check: fires once per exam, at its scheduled date/time */
function checkDueExams() {
  const now = new Date();
  let changed = false;
  DB.exams.forEach(e => {
    if (e.alarm === false || e._alerted) return;
    const dt = new Date(e.date + 'T' + (e.time || '09:00'));
    if (dt <= now && dt > new Date(now - 5 * 60000)) {
      triggerAlarm('Exam/Assignment: ' + e.subject, e.date + ' · ' + (e.time || '09:00'));
      e._alerted = true;
      changed = true;
    }
  });
  if (changed) persist();
}

/* ---------- To-Do ---------- */
function renderTodo() {
  const pending = DB.todos.filter(t => !t.done).sort((a,b) => (a.due||'9999').localeCompare(b.due||'9999'));
  const done = DB.todos.filter(t => t.done);
  return `
    <div class="card">
      <h3>Add Task</h3>
      <div class="form-row">
        <input type="text" id="todo-title" placeholder="Task title">
        <input type="date" id="todo-due">
      </div>
      <div class="form-row">
        <select id="todo-priority"><option>Medium</option><option>High</option><option>Low</option></select>
        <select id="todo-category"><option>Study</option><option>Personal</option><option>Other</option></select>
      </div>
      <button class="btn" id="add-todo-btn">＋ Add Task</button>
    </div>
    <div class="section-title">Pending (${pending.length})</div>
    <div class="card">
      ${pending.length ? `<div class="row-list">${pending.map(t => `
        <div class="row-item">
          <div class="checkbox-row"><input type="checkbox" onchange="toggleTodo('${t.id}')"><div><div class="title">${escapeHtml(t.title)}</div><div class="meta">${t.due ? 'Due '+t.due : 'No due date'} · ${t.category}</div></div></div>
          <span class="pill ${t.priority==='High'?'red':t.priority==='Medium'?'amber':'green'}">${t.priority}</span>
          <div class="row-actions"><button onclick="deleteTodo('${t.id}')">✕</button></div>
        </div>`).join('')}</div>` : `<div class="empty-state">No pending tasks.</div>`}
    </div>
    ${done.length ? `<div class="section-title">Completed (${done.length})</div>
    <div class="card"><div class="row-list">${done.map(t => `
      <div class="row-item" style="opacity:0.6;">
        <div class="checkbox-row"><input type="checkbox" checked onchange="toggleTodo('${t.id}')"><div class="title" style="text-decoration:line-through;">${escapeHtml(t.title)}</div></div>
        <div class="row-actions"><button onclick="deleteTodo('${t.id}')">✕</button></div>
      </div>`).join('')}</div></div>` : ''}
  `;
}
function toggleTodo(id) { const t = DB.todos.find(t => t.id === id); if (t) t.done = !t.done; persist(); render(); }
function deleteTodo(id) { DB.todos = DB.todos.filter(t => t.id !== id); persist(); render(); }

/* ---------- Study Planner + Pomodoro ---------- */
function renderStudy() {
  const sorted = [...DB.studySessions].sort((a,b) => b.date.localeCompare(a.date));
  const totalMinutes = DB.studySessions.reduce((s, x) => s + Number(x.duration), 0);
  return `
    <div class="grid cols-2">
      <div class="card">
        <h3>Plan a Study Session</h3>
        <div class="form-row">
          <input type="text" id="study-subject" placeholder="Subject">
          <input type="date" id="study-date" value="${todayStr()}">
        </div>
        <div class="form-row"><input type="number" id="study-duration" placeholder="Duration (minutes)"></div>
        <button class="btn" id="add-study-btn">＋ Log Session</button>
        <p class="stat-label" style="margin-top:10px;">Total logged: ${totalMinutes} minutes</p>
      </div>
      <div class="card">
        <h3>Focus Timer (Pomodoro)</h3>
        <div class="pomodoro-display" id="pomodoro-display">25:00</div>
        <div class="form-row" style="justify-content:center;">
          <button class="btn sm" id="pomodoro-start">Start</button>
          <button class="btn sm secondary" id="pomodoro-pause">Pause</button>
          <button class="btn sm ghost" id="pomodoro-reset">Reset</button>
        </div>
        <p class="stat-label" style="text-align:center;" id="pomodoro-mode-label">Work session — 25 min</p>
      </div>
    </div>
    <div class="section-title">Study Log</div>
    <div class="card">
      ${sorted.length ? `<div class="row-list">${sorted.map(s => `
        <div class="row-item">
          <div><div class="title">${escapeHtml(s.subject)}</div><div class="meta">${s.date}</div></div>
          <span class="pill">${s.duration} min</span>
          <div class="row-actions"><button onclick="deleteStudy('${s.id}')">✕</button></div>
        </div>`).join('')}</div>` : `<div class="empty-state">No study sessions logged yet.</div>`}
    </div>
  `;
}
function deleteStudy(id) { DB.studySessions = DB.studySessions.filter(s => s.id !== id); persist(); render(); }

function initPomodoroUI() {
  const startBtn = document.getElementById('pomodoro-start');
  const pauseBtn = document.getElementById('pomodoro-pause');
  const resetBtn = document.getElementById('pomodoro-reset');
  if (!startBtn) return;

  updatePomodoroDisplay();

  startBtn.onclick = () => {
    if (pomodoroState.running) return;
    pomodoroState.running = true;
    pomodoroState.interval = setInterval(() => {
      pomodoroState.seconds--;
      if (pomodoroState.seconds <= 0) {
        pomodoroState.mode = pomodoroState.mode === 'work' ? 'break' : 'work';
        pomodoroState.seconds = pomodoroState.mode === 'work' ? 25 * 60 : 5 * 60;
        showToast(pomodoroState.mode === 'work' ? 'Break over — back to work!' : 'Work session done — take a break!');
      }
      updatePomodoroDisplay();
    }, 1000);
  };
  pauseBtn.onclick = () => { pomodoroState.running = false; clearInterval(pomodoroState.interval); };
  resetBtn.onclick = () => {
    pomodoroState.running = false;
    clearInterval(pomodoroState.interval);
    pomodoroState.seconds = 25 * 60;
    pomodoroState.mode = 'work';
    updatePomodoroDisplay();
  };
}
function updatePomodoroDisplay() {
  const el = document.getElementById('pomodoro-display');
  if (!el) return;
  const m = Math.floor(pomodoroState.seconds / 60).toString().padStart(2, '0');
  const s = (pomodoroState.seconds % 60).toString().padStart(2, '0');
  el.textContent = `${m}:${s}`;
  const label = document.getElementById('pomodoro-mode-label');
  if (label) label.textContent = pomodoroState.mode === 'work' ? 'Work session — 25 min' : 'Break — 5 min';
}

/* ---------- Exams ---------- */
function renderExams() {
  const sorted = [...DB.exams].sort((a,b) => a.date.localeCompare(b.date));
  return `
    <div class="card">
      <h3>Add Exam / Assignment Deadline</h3>
      <div class="form-row">
        <input type="text" id="exam-subject" placeholder="Subject / Assignment name">
        <input type="date" id="exam-date">
        <input type="time" id="exam-time" value="09:00">
      </div>
      <div class="form-row" style="align-items:center;">
        <label class="checkbox-row" style="cursor:pointer;"><input type="checkbox" id="exam-alarm" checked> 🔔 Set alarm for this date/time</label>
      </div>
      <button class="btn" id="add-exam-btn">＋ Add</button>
    </div>
    <div class="section-title">Upcoming</div>
    <div class="grid cols-2">
      ${sorted.length ? sorted.map(e => {
        const days = daysUntil(e.date);
        const doneCount = e.syllabus.filter(s => s.done).length;
        return `<div class="card">
          <div class="row-item" style="border:none;padding:0;">
            <div><div class="title">${e.alarm !== false ? '🔔 ' : ''}${escapeHtml(e.subject)}</div><div class="meta">${e.date}${e.time ? ' · '+e.time : ''}</div></div>
            <span class="pill ${days<=3?'red':days<=7?'amber':'green'}">${days>=0 ? days+' days left' : 'Passed'}</span>
            <div class="row-actions"><button onclick="deleteExam('${e.id}')">✕</button></div>
          </div>
          <div class="form-row" style="margin-top:10px;">
            <input type="text" id="syl-${e.id}" placeholder="Add syllabus topic">
            <button class="btn sm secondary" onclick="addSyllabusTopic('${e.id}')">＋</button>
          </div>
          ${e.syllabus.length ? `<div class="row-list">${e.syllabus.map((s, idx) => `
            <div class="checkbox-row"><input type="checkbox" ${s.done?'checked':''} onchange="toggleSyllabus('${e.id}', ${idx})"><span style="${s.done?'text-decoration:line-through;color:var(--ink-soft);':''}">${escapeHtml(s.topic)}</span></div>
          `).join('')}</div><div class="meta" style="margin-top:6px;">${doneCount}/${e.syllabus.length} topics done</div>` : ''}
        </div>`;
      }).join('') : `<div class="card empty-state">No exams or deadlines added yet.</div>`}
    </div>
  `;
}
function deleteExam(id) { DB.exams = DB.exams.filter(e => e.id !== id); persist(); render(); }
function addSyllabusTopic(examId) {
  const input = document.getElementById('syl-' + examId);
  const topic = input.value.trim();
  if (!topic) return;
  const exam = DB.exams.find(e => e.id === examId);
  exam.syllabus.push({ topic, done: false });
  persist(); render();
}
function toggleSyllabus(examId, idx) {
  const exam = DB.exams.find(e => e.id === examId);
  exam.syllabus[idx].done = !exam.syllabus[idx].done;
  persist(); render();
}

/* ---------- Habits ---------- */
function renderHabits() {
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last14.push(d.toISOString().slice(0, 10));
  }
  return `
    <div class="card">
      <h3>Add Habit to Track</h3>
      <div class="form-row">
        <input type="text" id="habit-name" placeholder="e.g. Exercise, Reading, Sleep on time">
        <button class="btn" id="add-habit-btn">＋ Add Habit</button>
      </div>
    </div>
    <div class="section-title">Last 14 Days</div>
    ${DB.habits.length ? DB.habits.map(h => {
      const streak = calcStreak(h);
      return `<div class="card" style="margin-bottom:12px;">
        <div class="row-item" style="border:none;padding:0;margin-bottom:8px;">
          <div class="title">${escapeHtml(h.name)}</div>
          <span class="pill green">${streak} day streak</span>
          <div class="row-actions"><button onclick="deleteHabit('${h.id}')">✕</button></div>
        </div>
        <div class="habit-grid">
          ${last14.map(d => `<div class="habit-day ${h.log[d] ? 'done' : ''}" title="${d}" onclick="toggleHabitDay('${h.id}', '${d}')"></div>`).join('')}
        </div>
      </div>`;
    }).join('') : `<div class="card empty-state">No habits added yet.</div>`}
  `;
}
function toggleHabitDay(id, date) {
  const h = DB.habits.find(h => h.id === id);
  h.log[date] = !h.log[date];
  persist(); render();
}
function deleteHabit(id) { DB.habits = DB.habits.filter(h => h.id !== id); persist(); render(); }
function calcStreak(h) {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (h.log[key]) streak++; else break;
  }
  return streak;
}
