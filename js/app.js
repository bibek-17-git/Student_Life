/* app.js - navigation, dashboard, settings, shared helpers */

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  finance: 'Finance',
  schedule: 'Schedule',
  reminders: 'Reminders',
  notes: 'Notes',
  settings: 'Settings'
};

let currentPage = 'dashboard';

function fmt(amount) {
  const n = Number(amount) || 0;
  return DB.settings.currency + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function daysUntil(dateStr) {
  const today = new Date(todayStr());
  const target = new Date(dateStr);
  return Math.ceil((target - today) / 86400000);
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function navigate(page) {
  currentPage = page;
  document.getElementById('page-title').textContent = PAGE_TITLES[page];
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  render();
}

function render() {
  const content = document.getElementById('page-content');
  switch (currentPage) {
    case 'dashboard': content.innerHTML = renderDashboard(); break;
    case 'finance': content.innerHTML = renderFinance(); bindFinanceEvents(); break;
    case 'schedule': content.innerHTML = renderSchedule(); bindScheduleEvents(); break;
    case 'reminders': content.innerHTML = renderReminders(); bindReminderEvents(); break;
    case 'notes': content.innerHTML = renderNotes(); bindNoteEvents(); break;
    case 'settings': content.innerHTML = renderSettings(); bindSettingsEvents(); break;
  }
}

/* ---------------- Dashboard ---------------- */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 21) return 'Good Evening';
  return 'Good Night';
}

function getNextUpEvent() {
  const now = new Date();
  let best = null;

  // check classes for the next 7 days
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const weekdayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    DB.classes.filter(c => c.day === weekdayName).forEach(c => {
      const [h, m] = c.start.split(':').map(Number);
      const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
      if (dt > now && (!best || dt < best.time)) {
        best = { type: 'Class', title: c.subject, time: dt, meta: c.start + (c.location ? ' · ' + c.location : '') };
      }
    });
    if (best && offset > 1) break;
  }

  (DB.exams || []).forEach(e => {
    const dt = new Date(e.date + 'T' + (e.time || '09:00'));
    if (dt > now && (!best || dt < best.time)) {
      best = { type: 'Exam/Assignment', title: e.subject, time: dt, meta: e.date + ' · ' + (e.time || '09:00') };
    }
  });

  DB.reminders.filter(r => !r.done).forEach(r => {
    const dt = new Date(r.datetime);
    if (dt > now && (!best || dt < best.time)) {
      best = { type: 'Reminder', title: r.title, time: dt, meta: dt.toLocaleString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) };
    }
  });

  return best;
}

function minutesUntilLabel(mins) {
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return `in ${h}h ${m}m`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}

function setDashboardFinanceRange(range) {
  DB.settings.financeRange = range;
  persist();
  render();
}

function renderDashboard() {
  const today = todayStr();
  const now = new Date();
  const monthPrefix = today.slice(0, 7);
  const sections = DB.settings.dashboardSections || {};

  const range = DB.settings.financeRange || 'month';
  let rangeStart;
  if (range === 'today') rangeStart = today;
  else if (range === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    rangeStart = d.toISOString().slice(0, 10);
  } else rangeStart = monthPrefix + '-01';

  const rangeIncome = DB.income.filter(i => i.date >= rangeStart).reduce((s, i) => s + Number(i.amount), 0);
  const rangeExpense = DB.expenses.filter(e => e.date >= rangeStart).reduce((s, e) => s + Number(e.amount), 0);
  const rangeSavings = rangeIncome - rangeExpense;
  const todayExpense = DB.expenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0);
  const monthExpense = DB.expenses.filter(e => e.date.startsWith(monthPrefix)).reduce((s, e) => s + Number(e.amount), 0);

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(daysInMonth - dayOfMonth + 1, 1);
  const totalBudget = Object.values(DB.budgets).reduce((s, v) => s + Number(v), 0);
  const remainingBudget = Math.max(totalBudget - monthExpense, 0);
  const safeToday = totalBudget > 0 ? Math.floor(remainingBudget / daysLeft) : null;

  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const todaysClasses = DB.classes.filter(c => c.day === weekday).sort((a,b) => a.start.localeCompare(b.start));

  const allTodos = DB.todos;
  const pendingTodos = allTodos.filter(t => !t.done).sort((a,b) => (a.due||'9999').localeCompare(b.due||'9999')).slice(0, 5);
  const overdueTodos = allTodos.filter(t => !t.done && t.due && t.due < today);
  const todosToday = allTodos.filter(t => t.due === today);
  const todosCompletedTotal = allTodos.filter(t => t.done).length;

  const upcomingReminders = DB.reminders
    .filter(r => !r.done)
    .sort((a,b) => a.datetime.localeCompare(b.datetime))
    .slice(0, 5);

  document.getElementById('date-line').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const upcomingExams = [...(DB.exams || [])]
    .filter(e => daysUntil(e.date) >= 0)
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const nextUp = getNextUpEvent();
  const topGoal = [...DB.savingsGoals].sort((a,b) => (b.current/b.target) - (a.current/a.target))[0];

  const rangeLabel = range === 'today' ? "Today" : range === 'week' ? 'This Week' : 'This Month';

  return `
    <div class="section-title">${getGreeting()} 👋</div>

    ${nextUp ? `
    <div class="card" style="border-left:4px solid var(--blue);">
      <h3>⏰ Next Up</h3>
      <div class="row-item" style="border:none;padding:0;">
        <div><div class="title">${nextUp.type}: ${escapeHtml(nextUp.title)}</div><div class="meta">${nextUp.meta}</div></div>
        <span class="pill blue">${minutesUntilLabel(Math.round((nextUp.time - now) / 60000))}</span>
      </div>
    </div>` : `<div class="card empty-state">Nothing scheduled next. Add classes, exams, or reminders to see them here.</div>`}

    ${overdueTodos.length ? `
    <div class="card" style="border-left:4px solid var(--red);margin-top:14px;">
      <h3 style="color:var(--red);">⚠ Overdue Tasks</h3>
      <div class="row-list">${overdueTodos.map(t => `
        <div class="row-item">
          <div><div class="title">${escapeHtml(t.title)}</div><div class="meta">Was due ${t.due}</div></div>
          <span class="pill red">Overdue</span>
        </div>`).join('')}</div>
    </div>` : ''}

    ${sections.classes !== false ? `
    <div class="section-title" style="margin-top:22px;">Today's Classes</div>
    <div class="card">
      ${todaysClasses.length ? `<div class="row-list">${todaysClasses.map(c => `
        <div class="row-item">
          <div><div class="title">${escapeHtml(c.subject)}</div><div class="meta">${c.start} - ${c.end} ${c.location ? '· '+escapeHtml(c.location) : ''}</div></div>
        </div>`).join('')}</div>` : `<div class="empty-state">No classes scheduled today. Add your routine in the Schedule tab.</div>`}
    </div>` : ''}

    ${sections.exams !== false ? `
    <div class="section-title" style="margin-top:22px;">Exams & Assessments</div>
    <div class="card">
      ${upcomingExams.length ? `<div class="row-list">${upcomingExams.map(e => {
        const days = daysUntil(e.date);
        return `<div class="row-item">
          <div><div class="title">${alarmTimingLabel(e)} ${escapeHtml(e.subject)}</div><div class="meta">${e.date}${e.time ? ' · '+e.time : ''}</div></div>
          <span class="pill ${days<=3?'red':days<=7?'amber':'green'}">${days} days left</span>
        </div>`;
      }).join('')}</div>` : `<div class="empty-state">No upcoming exams or assignments. Add them in the Schedule tab.</div>`}
    </div>` : ''}

    ${sections.finance !== false ? `
    <div class="section-title" style="margin-top:22px;">Finance Overview</div>
    <div class="tabs" style="margin-bottom:10px;">
      ${['today','week','month'].map(r => `<button class="tab-btn ${range===r?'active':''}" onclick="setDashboardFinanceRange('${r}')">${r==='today'?'Today':r==='week'?'This Week':'This Month'}</button>`).join('')}
    </div>
    <div class="grid cols-3">
      <div class="card">
        <h3>Income (${rangeLabel})</h3>
        <div class="stat green">${fmt(rangeIncome)}</div>
      </div>
      <div class="card">
        <h3>Expense (${rangeLabel})</h3>
        <div class="stat red">${fmt(rangeExpense)}</div>
      </div>
      <div class="card">
        <h3>Net (${rangeLabel})</h3>
        <div class="stat ${rangeSavings >= 0 ? 'green' : 'red'}">${fmt(rangeSavings)}</div>
      </div>
    </div>

    ${safeToday !== null ? `
    <div class="card" style="margin-top:14px;">
      <h3>Safe to Spend Today</h3>
      <div class="stat blue">${fmt(safeToday)}</div>
      <div class="stat-label">based on remaining monthly budget ÷ ${daysLeft} days left</div>
    </div>` : ''}` : ''}

    ${sections.savings !== false && topGoal ? `
    <div class="section-title" style="margin-top:22px;">Savings Goal Snapshot</div>
    <div class="card">
      <div class="row-item" style="border:none;padding:0;margin-bottom:6px;">
        <div class="title">${escapeHtml(topGoal.name)}</div>
        <div class="meta">${fmt(topGoal.current)} / ${fmt(topGoal.target)}</div>
      </div>
      <div class="progress-bar"><div style="width:${Math.min((topGoal.current/topGoal.target)*100,100)}%"></div></div>
    </div>` : ''}

    ${sections.tasks !== false ? `
    <div class="section-title" style="margin-top:22px;">Today's Task Progress</div>
    <div class="card">
      <div class="row-item" style="border:none;padding:0;">
        <div class="meta">${todosToday.filter(t=>t.done).length} of ${todosToday.length || 0} tasks due today completed</div>
        <div class="meta">${todosCompletedTotal} completed all-time</div>
      </div>
      <div class="progress-bar"><div style="width:${todosToday.length ? (todosToday.filter(t=>t.done).length/todosToday.length*100) : 0}%"></div></div>
    </div>` : ''}

    <div class="grid cols-2" style="margin-top:22px;">
      ${sections.tasks !== false ? `
      <div>
        <div class="section-title">Pending Tasks</div>
        <div class="card">
          ${pendingTodos.length ? `<div class="row-list">${pendingTodos.map(t => `
            <div class="row-item">
              <div><div class="title">${escapeHtml(t.title)}</div><div class="meta">${t.due ? 'Due '+t.due : 'No due date'}</div></div>
              <span class="pill ${t.priority === 'High' ? 'red' : t.priority === 'Medium' ? 'amber' : 'green'}">${t.priority}</span>
            </div>`).join('')}</div>` : `<div class="empty-state">No pending tasks. 🎉</div>`}
        </div>
      </div>` : '<div></div>'}
      ${sections.reminders !== false ? `
      <div>
        <div class="section-title">Upcoming Reminders</div>
        <div class="card">
          ${upcomingReminders.length ? `<div class="row-list">${upcomingReminders.map(r => `
            <div class="row-item">
              <div><div class="title">${alarmTimingLabel(r)} ${escapeHtml(r.title)}</div><div class="meta">${new Date(r.datetime).toLocaleString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div></div>
              <span class="pill">${r.category}</span>
            </div>`).join('')}</div>` : `<div class="empty-state">No upcoming reminders.</div>`}
        </div>
      </div>` : '<div></div>'}
    </div>

    <div class="section-title">Quick Add</div>
    <div class="form-row">
      <button class="btn" onclick="navigate('finance')">＋ Add Expense</button>
      <button class="btn secondary" onclick="navigate('schedule')">＋ Add Task</button>
      <button class="btn secondary" onclick="navigate('reminders')">＋ Add Reminder</button>
    </div>
  `;
}

/* ---------------- Settings ---------------- */
function renderSettings() {
  return `
    <div class="card">
      <h3>Currency Symbol</h3>
      <div class="form-row">
        <input type="text" id="set-currency" value="${escapeHtml(DB.settings.currency)}" maxlength="3" style="max-width:100px;">
        <button class="btn" id="save-currency-btn">Save</button>
      </div>
    </div>

    <div class="section-title">Alarm & Notifications</div>
    <div class="card">
      <p style="font-size:13px;color:var(--ink-soft);margin-top:0;">
        When a reminder is due, the app plays a sound, vibrates the phone, and (if allowed) shows a system notification.
      </p>
      ${'Notification' in window ? `
      <div class="form-row" style="align-items:center;">
        <span class="pill ${Notification.permission === 'granted' ? 'green' : Notification.permission === 'denied' ? 'red' : 'amber'}">
          ${Notification.permission === 'granted' ? '✓ Notifications enabled' : Notification.permission === 'denied' ? '✕ Notifications blocked' : '! Not enabled yet'}
        </span>
        ${Notification.permission !== 'granted' ? `<button class="btn sm" id="enable-notif-btn">Enable Notifications</button>` : `<button class="btn sm secondary" id="test-alarm-btn">🔔 Test Alarm</button>`}
      </div>
      ${Notification.permission === 'denied' ? `<p style="font-size:12px;color:var(--ink-soft);">You blocked notifications earlier. Enable them from your browser's site settings to get alarm popups even when the app is in the background.</p>` : ''}
      ` : `
      <div class="form-row" style="align-items:center;">
        <span class="pill red">✕ Notifications not supported on this browser</span>
        <button class="btn sm secondary" id="test-alarm-btn">🔔 Test Alarm (sound + vibration only)</button>
      </div>
      `}
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:0;">Note: this alarm only fires while the app or your browser is running (even in a background tab). It cannot wake your phone up if the browser is fully closed — that requires a native app, which is possible as a future upgrade.</p>
    </div>

    <div class="section-title">Dashboard Sections</div>
    <div class="card">
      <p style="font-size:13px;color:var(--ink-soft);margin-top:0;">Choose which sections appear on your Dashboard.</p>
      <div class="grid cols-2">
        ${Object.entries({classes:'Today\'s Classes', exams:'Exams & Assessments', finance:'Finance Overview', savings:'Savings Goal Snapshot', tasks:'Tasks & Progress', reminders:'Upcoming Reminders'}).map(([key,label]) => `
          <label class="checkbox-row" style="cursor:pointer;">
            <input type="checkbox" class="dash-section-toggle" data-key="${key}" ${DB.settings.dashboardSections[key] !== false ? 'checked' : ''}>
            ${label}
          </label>`).join('')}
      </div>
    </div>

    <div class="section-title">Custom Expense Categories</div>
    <div class="card">
      <div class="form-row">
        <input type="text" id="new-category" placeholder="e.g. Gym, Subscriptions">
        <button class="btn" id="add-category-btn">＋ Add Category</button>
      </div>
      <div class="row-list" id="category-list">
        ${(DB.customCategories || []).map((c, i) => `
          <div class="row-item"><div class="title">${escapeHtml(c)}</div>
          <div class="row-actions"><button onclick="removeCategory(${i})">✕</button></div></div>
        `).join('') || '<div class="empty-state">No custom categories yet.</div>'}
      </div>
    </div>

    <div class="section-title">Data & Backup</div>
    <div class="card">
      <p style="font-size:13px;color:var(--ink-soft);margin-top:0;">Export your data regularly to avoid losing it if you clear browser storage.</p>
      <div class="form-row">
        <button class="btn secondary" onclick="exportDataAsJSON()">⬇ Export Full Backup (JSON)</button>
        <button class="btn secondary" onclick="exportDataAsCSV()">⬇ Export Finance (CSV)</button>
      </div>
      <div class="form-row" style="margin-top:8px;">
        <button class="btn danger" id="reset-data-btn">🗑 Reset All Data</button>
      </div>
    </div>

    <div class="section-title">Emergency Contacts</div>
    <div class="card">
      <div class="form-row">
        <input type="text" id="contact-name" placeholder="Name">
        <input type="text" id="contact-relation" placeholder="Relation">
        <input type="text" id="contact-phone" placeholder="Phone">
        <button class="btn" id="add-contact-btn">＋ Add</button>
      </div>
      <div class="row-list">
        ${DB.contacts.map((c, i) => `
          <div class="row-item">
            <div><div class="title">${escapeHtml(c.name)}</div><div class="meta">${escapeHtml(c.relation)} · ${escapeHtml(c.phone)}</div></div>
            <div class="row-actions"><button onclick="removeContact(${i})">✕</button></div>
          </div>`).join('') || '<div class="empty-state">No contacts added yet.</div>'}
      </div>
    </div>
  `;
}

function bindSettingsEvents() {
  const enableNotifBtn = document.getElementById('enable-notif-btn');
  if (enableNotifBtn) enableNotifBtn.onclick = () => {
    if ('Notification' in window) Notification.requestPermission().then(() => render());
  };
  const testAlarmBtn = document.getElementById('test-alarm-btn');
  if (testAlarmBtn) testAlarmBtn.onclick = () => {
    triggerAlarm('Test Alarm', 'This is what a reminder alert looks and sounds like.');
  };

  document.querySelectorAll('.dash-section-toggle').forEach(cb => {
    cb.onchange = () => {
      DB.settings.dashboardSections[cb.dataset.key] = cb.checked;
      persist();
      showToast('Dashboard updated');
    };
  });

  document.getElementById('save-currency-btn').onclick = () => {
    const v = document.getElementById('set-currency').value.trim() || '৳';
    DB.settings.currency = v;
    persist();
    showToast('Currency updated');
    render();
  };
  document.getElementById('add-category-btn').onclick = () => {
    const v = document.getElementById('new-category').value.trim();
    if (!v) return;
    DB.customCategories = DB.customCategories || [];
    DB.customCategories.push(v);
    persist();
    render();
  };
  document.getElementById('reset-data-btn').onclick = () => {
    if (confirm('This will permanently delete all your data. Continue?')) {
      resetAllData();
      showToast('All data has been reset');
      render();
    }
  };
  document.getElementById('add-contact-btn').onclick = () => {
    const name = document.getElementById('contact-name').value.trim();
    const relation = document.getElementById('contact-relation').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    if (!name || !phone) return showToast('Name and phone are required');
    DB.contacts.push({ id: uid(), name, relation, phone });
    persist();
    render();
  };
}

function removeCategory(i) {
  DB.customCategories.splice(i, 1);
  persist();
  render();
}
function removeContact(i) {
  DB.contacts.splice(i, 1);
  persist();
  render();
}

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });

  if (DB.settings.darkMode) document.body.classList.add('dark');
  document.getElementById('dark-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    DB.settings.darkMode = document.body.classList.contains('dark');
    persist();
  });

  navigate('dashboard');
  checkAllAlarms();
  setInterval(checkAllAlarms, 60000);

  // Ask for notification permission on first meaningful interaction (click),
  // since browsers block permission prompts that fire immediately on page load.
  document.body.addEventListener('click', requestNotificationPermission, { once: true });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});
