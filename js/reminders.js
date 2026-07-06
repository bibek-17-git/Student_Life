/* reminders.js - custom reminders with categories and repeat options */

const REMINDER_CATEGORIES = ['Class/Tuition', 'Bill Payment', 'Deadline', 'Birthday/Important Date', 'Personal'];

function renderReminders() {
  const upcoming = DB.reminders.filter(r => !r.done).sort((a,b) => a.datetime.localeCompare(b.datetime));
  const done = DB.reminders.filter(r => r.done);

  const recurringBills = DB.recurring.map(r => {
    const now = new Date();
    let due = new Date(now.getFullYear(), now.getMonth(), r.dueDay);
    if (due < now) due = new Date(now.getFullYear(), now.getMonth() + 1, r.dueDay);
    return { ...r, dueDate: due };
  }).sort((a,b) => a.dueDate - b.dueDate);

  return `
    <div class="card">
      <h3>Add Reminder</h3>
      <div class="form-row">
        <input type="text" id="rem-title" placeholder="Reminder title">
        <input type="datetime-local" id="rem-datetime">
      </div>
      <div class="form-row">
        <select id="rem-category">${REMINDER_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
        <select id="rem-repeat">
          <option value="none">Does not repeat</option>
          <option value="daily">Repeat daily</option>
          <option value="weekly">Repeat weekly</option>
          <option value="monthly">Repeat monthly</option>
        </select>
      </div>
      ${alarmControlsHTML('rem')}
      <button class="btn" id="add-reminder-btn">＋ Add Reminder</button>
    </div>

    ${recurringBills.length ? `
    <div class="section-title">Upcoming Recurring Bills</div>
    <div class="card">
      <div class="row-list">${recurringBills.map(r => `
        <div class="row-item">
          <div><div class="title">${escapeHtml(r.name)}</div><div class="meta">Due ${r.dueDate.toDateString()} · ${escapeHtml(r.category)}</div></div>
          <div class="amount expense">${fmt(r.amount)}</div>
        </div>`).join('')}</div>
    </div>` : ''}

    <div class="section-title">Upcoming Reminders (${upcoming.length})</div>
    <div class="card">
      ${upcoming.length ? `<div class="row-list">${upcoming.map(r => `
        <div class="row-item">
          <div class="checkbox-row"><input type="checkbox" onchange="toggleReminder('${r.id}')"><div><div class="title">${alarmTimingLabel(r)} ${escapeHtml(r.title)}</div><div class="meta">${new Date(r.datetime).toLocaleString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'})}${r.repeat!=='none' ? ' · repeats '+r.repeat : ''}</div></div></div>
          <span class="pill">${r.category}</span>
          <div class="row-actions"><button onclick="deleteReminder('${r.id}')">✕</button></div>
        </div>`).join('')}</div>` : `<div class="empty-state">No upcoming reminders. Add one above.</div>`}
    </div>

    ${done.length ? `<div class="section-title">Completed</div>
    <div class="card"><div class="row-list">${done.map(r => `
      <div class="row-item" style="opacity:0.6;">
        <div class="checkbox-row"><input type="checkbox" checked onchange="toggleReminder('${r.id}')"><div class="title" style="text-decoration:line-through;">${escapeHtml(r.title)}</div></div>
        <div class="row-actions"><button onclick="deleteReminder('${r.id}')">✕</button></div>
      </div>`).join('')}</div></div>` : ''}
  `;
}

function bindReminderEvents() {
  const btn = document.getElementById('add-reminder-btn');
  if (btn) btn.onclick = () => {
    const title = document.getElementById('rem-title').value.trim();
    const datetime = document.getElementById('rem-datetime').value;
    const category = document.getElementById('rem-category').value;
    const repeat = document.getElementById('rem-repeat').value;
    const alarmCfg = readAlarmControls('rem');
    if (!title || !datetime) return showToast('Enter a title and date/time');
    DB.reminders.push({ id: uid(), title, datetime, category, repeat, ...alarmCfg, done: false });
    persist(); render();
  };
}

function toggleReminder(id) {
  const r = DB.reminders.find(r => r.id === id);
  if (!r) return;
  r.done = !r.done;
  if (r.done && r.repeat !== 'none') {
    const next = new Date(r.datetime);
    if (r.repeat === 'daily') next.setDate(next.getDate() + 1);
    if (r.repeat === 'weekly') next.setDate(next.getDate() + 7);
    if (r.repeat === 'monthly') next.setMonth(next.getMonth() + 1);
    DB.reminders.push({ id: uid(), title: r.title, datetime: next.toISOString().slice(0,16), category: r.category, repeat: r.repeat, done: false });
  }
  persist(); render();
}
function deleteReminder(id) { DB.reminders = DB.reminders.filter(r => r.id !== id); persist(); render(); }

/* Check for reminders that are due "now" and fire the full alarm (sound + vibration + notification) */
function checkDueReminders() {
  const now = new Date();
  let changed = false;
  DB.reminders.forEach(r => {
    if (!r.done && !r._alerted && r.alarm !== false) {
      const dateStr = r.datetime.slice(0, 10);
      const timeStr = r.datetime.slice(11, 16);
      const alarmTime = computeAlarmMoment(dateStr, timeStr, r);
      if (alarmTime <= now && alarmTime > new Date(now - 5 * 60000)) {
        triggerAlarm(r.title, r.category + ' · ' + new Date(r.datetime).toLocaleString('en-US', {hour:'2-digit', minute:'2-digit'}));
        r._alerted = true;
        changed = true;
      }
    }
  });

  // Also alert for recurring bills due today (once per day)
  const todayKey = todayStr();
  DB.recurring.forEach(rec => {
    const dayNow = now.getDate();
    if (rec.dueDay === dayNow && rec._lastAlertDate !== todayKey) {
      triggerAlarm('Bill Due: ' + rec.name, fmt(rec.amount) + ' · ' + rec.category);
      rec._lastAlertDate = todayKey;
      changed = true;
    }
  });

  if (changed) persist();
}
