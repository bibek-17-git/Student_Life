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
}
