/* alarm.js - handles sound, vibration, and system notifications for due reminders */

let notificationPermissionAsked = false;

function requestNotificationPermission() {
  if (notificationPermissionAsked) return;
  notificationPermissionAsked = true;
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

/* Short beep using Web Audio API - no external audio file needed, works offline */
function playAlarmSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [0, 0.25, 0.5].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.22);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch (e) {
    // Web Audio not available/blocked - silently ignore, visual + vibration alert still works
  }
}

function vibrateAlarm() {
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 300]);
  }
}

function showSystemNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: [200, 100, 200, 100, 300],
        tag: 'slm-reminder-' + Date.now()
      });
    }).catch(() => {
      new Notification(title, { body, icon: 'icons/icon-192.png' });
    });
  } else {
    new Notification(title, { body, icon: 'icons/icon-192.png' });
  }
}

/* Fires all three alert channels together for a due reminder/alarm */
function triggerAlarm(title, body) {
  playAlarmSound();
  vibrateAlarm();
  showSystemNotification(title, body);
  showToast('⏰ ' + title);
}

/* Runs every check cycle: class start times, exam/assignment date-times, and custom reminders */
function checkAllAlarms() {
  if (typeof checkDueClasses === 'function') checkDueClasses();
  if (typeof checkDueExams === 'function') checkDueExams();
  if (typeof checkDueReminders === 'function') checkDueReminders();
  if (typeof checkBudgetAlerts === 'function') checkBudgetAlerts();
}

/* ---------- Shared "when should the alarm ring" controls (used by Class & Exam forms) ---------- */

function alarmControlsHTML(prefix) {
  return `
    <div class="form-row" style="align-items:center;flex-wrap:wrap;">
      <label class="checkbox-row" style="cursor:pointer;"><input type="checkbox" id="${prefix}-alarm" checked> 🔔 Alarm</label>
      <select id="${prefix}-alarm-mode" onchange="updateAlarmModeVisibility('${prefix}')">
        <option value="at">Ring at event time</option>
        <option value="before">Ring X minutes before</option>
        <option value="custom">Ring at a custom time</option>
      </select>
      <input type="number" id="${prefix}-alarm-offset" min="1" value="10" placeholder="Minutes before" style="display:none;max-width:150px;">
      <input type="time" id="${prefix}-alarm-custom" style="display:none;">
    </div>
  `;
}

function updateAlarmModeVisibility(prefix) {
  const modeEl = document.getElementById(prefix + '-alarm-mode');
  if (!modeEl) return;
  const mode = modeEl.value;
  const offsetEl = document.getElementById(prefix + '-alarm-offset');
  const customEl = document.getElementById(prefix + '-alarm-custom');
  if (offsetEl) offsetEl.style.display = mode === 'before' ? 'inline-block' : 'none';
  if (customEl) customEl.style.display = mode === 'custom' ? 'inline-block' : 'none';
}

/* Reads the three alarm-timing fields for a given form prefix */
function readAlarmControls(prefix) {
  return {
    alarm: document.getElementById(prefix + '-alarm').checked,
    alarmMode: document.getElementById(prefix + '-alarm-mode').value,
    alarmOffset: Number(document.getElementById(prefix + '-alarm-offset').value) || 10,
    alarmCustomTime: document.getElementById(prefix + '-alarm-custom').value || null
  };
}

/* Given the event's own date + start time (HH:MM) and an alarm config, returns the actual Date the alarm should fire */
function computeAlarmMoment(dateStr, baseTimeStr, item) {
  const [bh, bmin] = (baseTimeStr || '00:00').split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const base = new Date(y, mo - 1, d, bh, bmin);

  if (item.alarmMode === 'before') {
    return new Date(base.getTime() - (Number(item.alarmOffset) || 0) * 60000);
  }
  if (item.alarmMode === 'custom' && item.alarmCustomTime) {
    const [ch, cm] = item.alarmCustomTime.split(':').map(Number);
    return new Date(y, mo - 1, d, ch, cm);
  }
  return base;
}

/* Short label describing when the alarm rings, for display next to the bell icon */
function alarmTimingLabel(item) {
  if (item.alarm === false) return '';
  if (item.alarmMode === 'before') return `🔔 ${item.alarmOffset} min before`;
  if (item.alarmMode === 'custom' && item.alarmCustomTime) return `🔔 at ${item.alarmCustomTime}`;
  return '🔔';
}
