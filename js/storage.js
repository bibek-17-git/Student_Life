/* storage.js - simple localStorage wrapper with default schema */

const DB_KEY = 'slm_data_v1';

function cloneData(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

const DEFAULT_DATA = {
  settings: {
    currency: '৳',
    darkMode: false,
    dashboardSections: { classes: true, exams: true, finance: true, tasks: true, reminders: true, savings: true },
    financeRange: 'month'
  },
  income: [],
  expenses: [],
  budgets: {},
  budgetAlerted: {},
  savingsGoals: [],
  debts: [],
  splits: [],
  recurring: [],
  classes: [],
  todos: [],
  studySessions: [],
  exams: [],
  habits: [],
  reminders: [],
  notes: [],
  contacts: []
};

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      saveData(DEFAULT_DATA);
      return cloneData(DEFAULT_DATA);
    }
    const parsed = JSON.parse(raw);
    // merge with defaults so new keys added later don't break old saved data
    const merged = { ...cloneData(DEFAULT_DATA), ...parsed };
    // settings is nested, so shallow merge above can miss new sub-fields - merge one level deeper
    merged.settings = { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) };
    merged.settings.dashboardSections = { ...DEFAULT_DATA.settings.dashboardSections, ...((parsed.settings || {}).dashboardSections || {}) };
    return merged;
  } catch (e) {
    console.error('Failed to load data, resetting.', e);
    saveData(DEFAULT_DATA);
    return cloneData(DEFAULT_DATA);
  }
}

function saveData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// global in-memory store, hydrated on load
let DB = loadData();

function persist() {
  saveData(DB);
}

function resetAllData() {
  DB = cloneData(DEFAULT_DATA);
  persist();
}

function exportDataAsJSON() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student-life-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportDataAsCSV() {
  let csv = 'Type,Date,Category/Source,Amount,Note\n';
  DB.income.forEach(i => csv += `Income,${i.date},${i.source},${i.amount},"${(i.note||'').replace(/"/g,'')}"\n`);
  DB.expenses.forEach(e => csv += `Expense,${e.date},${e.category},${e.amount},"${(e.note||'').replace(/"/g,'')}"\n`);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student-life-finance.csv';
  a.click();
  URL.revokeObjectURL(url);
}
