# Student Life Manager

An all-in-one Progressive Web App (PWA) for university students to manage finances, class schedule, tasks, reminders, and notes — all in one place, fully offline-capable.

## Features

**Finance**
- Income tracking (tuition earnings, part-time job, family support, scholarship)
- Expense tracking by category with notes
- Monthly budgets per category with progress bars
- Savings goals with progress tracking
- Debt/loan tracker (who owes you, who you owe)
- Split expenses with friends
- Recurring bill reminders (rent, wifi, phone)
- Spending overview and category breakdown

**Schedule**
- Weekly class timetable
- To-do list with priority and due dates
- Study session planner + built-in Pomodoro focus timer
- Exam/assignment deadline tracker with countdown and syllabus checklist
- Habit tracker with streaks

**Reminders & Alarm**
- Custom reminders with categories and repeat (daily/weekly/monthly)
- Auto-surfaced recurring bill due dates
- Alarm system: when a reminder is due, the app plays a sound, vibrates the device, and shows a system notification (if permission granted) — works while the app or browser is open/in background. It cannot ring while the browser is fully closed (that needs a native app, e.g. via Capacitor, as a future step).

**Notes**
- Quick notes with pinning

**Settings**
- Currency symbol
- Dark mode
- Custom expense categories
- Data export (JSON backup, CSV for finance)
- Emergency contacts list

## Tech

Plain HTML, CSS, and JavaScript — no build step, no framework, no backend. All data is stored locally in the browser (`localStorage`), so it stays on your device.

## Running Locally

Just open `index.html` in a browser, or serve the folder with any static server:

```bash
npx serve .
```

## Deploying (GitHub Pages)

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set source to the `main` branch, root folder.
4. Your app will be live at `https://<username>.github.io/<repo-name>/`.

## Installing as an App (PWA)

Once deployed, open the live link on your phone in Chrome and choose **"Add to Home Screen"**. The app will behave like a native app: full-screen, offline-capable, with its own icon.

## Project Structure

```
student-life-manager/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   └── style.css
├── js/
│   ├── storage.js      # data persistence layer
│   ├── app.js           # navigation, dashboard, settings
│   ├── finance.js        # income, expenses, budget, savings, debts, splits, recurring
│   ├── schedule.js        # timetable, to-do, study planner, exams, habits
│   ├── reminders.js       # custom reminders
│   └── notes.js           # quick notes
└── icons/
```

## Adding New Features Later

Each module lives in its own JS file. To add a new section:
1. Create a new file in `js/` (e.g. `js/newmodule.js`).
2. Add render + event-binding functions following the pattern in `finance.js` or `schedule.js`.
3. Add a nav item in `index.html` and a case in the `render()` switch in `app.js`.
4. Add the new data array/object to `DEFAULT_DATA` in `storage.js`.

## Data & Privacy

All data stays in your browser's local storage — nothing is sent to a server. Use **Settings → Export Full Backup** regularly, especially before clearing browser data or switching devices.
