/* finance.js - income, expenses, budgets, savings goals, debts, split expenses, recurring bills */

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Rent', 'Phone/Internet', 'Books/Materials', 'Outing with Friends', 'Medicine', 'Shopping', 'Entertainment', 'Other'];
const INCOME_SOURCES = ['Tuition Fee Earning', 'Part-time Job', 'Family/Parents', 'Scholarship', 'Other'];

let financeTab = 'overview';

function allCategories() {
  return [...EXPENSE_CATEGORIES, ...(DB.customCategories || [])];
}

function renderFinance() {
  const tabs = ['overview', 'income', 'expenses', 'budget', 'savings', 'debts', 'split', 'recurring'];
  const labels = { overview: 'Overview', income: 'Income', expenses: 'Expenses', budget: 'Budget', savings: 'Savings Goals', debts: 'Debts', split: 'Split Expense', recurring: 'Recurring Bills' };

  return `
    <div class="tabs">
      ${tabs.map(t => `<button class="tab-btn ${financeTab===t?'active':''}" onclick="setFinanceTab('${t}')">${labels[t]}</button>`).join('')}
    </div>
    <div id="finance-tab-content">${renderFinanceTab()}</div>
  `;
}

function setFinanceTab(tab) {
  financeTab = tab;
  render();
}

function renderFinanceTab() {
  switch (financeTab) {
    case 'overview': return renderFinanceOverview();
    case 'income': return renderIncomeTab();
    case 'expenses': return renderExpensesTab();
    case 'budget': return renderBudgetTab();
    case 'savings': return renderSavingsTab();
    case 'debts': return renderDebtsTab();
    case 'split': return renderSplitTab();
    case 'recurring': return renderRecurringTab();
  }
}

/* ---------- Overview ---------- */
function renderFinanceOverview() {
  const monthPrefix = todayStr().slice(0, 7);
  const monthIncome = DB.income.filter(i => i.date.startsWith(monthPrefix)).reduce((s, i) => s + Number(i.amount), 0);
  const monthExpense = DB.expenses.filter(e => e.date.startsWith(monthPrefix)).reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = {};
  DB.expenses.filter(e => e.date.startsWith(monthPrefix)).forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });
  const catEntries = Object.entries(byCategory).sort((a,b) => b[1]-a[1]);
  const maxCat = catEntries.length ? catEntries[0][1] : 1;

  return `
    <div class="grid cols-3">
      <div class="card"><h3>Income (This Month)</h3><div class="stat green">${fmt(monthIncome)}</div></div>
      <div class="card"><h3>Expense (This Month)</h3><div class="stat red">${fmt(monthExpense)}</div></div>
      <div class="card"><h3>Balance</h3><div class="stat ${monthIncome-monthExpense>=0?'green':'red'}">${fmt(monthIncome-monthExpense)}</div></div>
    </div>
    <div class="section-title">Expense by Category (This Month)</div>
    <div class="card">
      ${catEntries.length ? `<div class="row-list">${catEntries.map(([cat, amt]) => `
        <div>
          <div class="row-item"><div class="title">${escapeHtml(cat)}</div><div class="amount expense">${fmt(amt)}</div></div>
          <div class="progress-bar"><div style="width:${(amt/maxCat*100).toFixed(0)}%"></div></div>
        </div>`).join('')}</div>` : `<div class="empty-state">No expenses recorded this month yet.</div>`}
    </div>
  `;
}

/* ---------- Income ---------- */
function renderIncomeTab() {
  const sorted = [...DB.income].sort((a,b) => b.date.localeCompare(a.date));
  return `
    <div class="card">
      <h3>Add Income</h3>
      <div class="form-row">
        <select id="inc-source">${INCOME_SOURCES.map(s => `<option>${s}</option>`).join('')}</select>
        <input type="number" id="inc-amount" placeholder="Amount">
        <input type="date" id="inc-date" value="${todayStr()}">
      </div>
      <div class="form-row"><input type="text" id="inc-note" placeholder="Note (optional)"></div>
      <button class="btn" id="add-income-btn">＋ Add Income</button>
    </div>
    <div class="section-title">Income History</div>
    <div class="card">
      ${sorted.length ? `<div class="row-list">${sorted.map(i => `
        <div class="row-item">
          <div><div class="title">${escapeHtml(i.source)}</div><div class="meta">${i.date}${i.note ? ' · '+escapeHtml(i.note) : ''}</div></div>
          <div class="amount income">+${fmt(i.amount)}</div>
          <div class="row-actions"><button onclick="deleteIncome('${i.id}')">✕</button></div>
        </div>`).join('')}</div>` : `<div class="empty-state">No income recorded yet.</div>`}
    </div>
  `;
}

function bindFinanceEvents() {
  const addIncomeBtn = document.getElementById('add-income-btn');
  if (addIncomeBtn) addIncomeBtn.onclick = () => {
    const source = document.getElementById('inc-source').value;
    const amount = Number(document.getElementById('inc-amount').value);
    const date = document.getElementById('inc-date').value || todayStr();
    const note = document.getElementById('inc-note').value.trim();
    if (!amount) return showToast('Enter a valid amount');
    DB.income.push({ id: uid(), source, amount, date, note });
    persist(); showToast('Income added'); render();
  };

  const addExpenseBtn = document.getElementById('add-expense-btn');
  if (addExpenseBtn) addExpenseBtn.onclick = () => {
    const category = document.getElementById('exp-category').value;
    const amount = Number(document.getElementById('exp-amount').value);
    const date = document.getElementById('exp-date').value || todayStr();
    const note = document.getElementById('exp-note').value.trim();
    if (!amount) return showToast('Enter a valid amount');
    DB.expenses.push({ id: uid(), category, amount, date, note });
    persist(); showToast('Expense added'); render();
  };

  const saveBudgetBtn = document.getElementById('save-budget-btn');
  if (saveBudgetBtn) saveBudgetBtn.onclick = () => {
    allCategories().forEach(cat => {
      const el = document.getElementById('budget-' + cat.replace(/\W/g,'_'));
      if (el) {
        const v = Number(el.value);
        if (v > 0) DB.budgets[cat] = v; else delete DB.budgets[cat];
      }
    });
    persist(); showToast('Budget saved'); render();
  };

  const addGoalBtn = document.getElementById('add-goal-btn');
  if (addGoalBtn) addGoalBtn.onclick = () => {
    const name = document.getElementById('goal-name').value.trim();
    const target = Number(document.getElementById('goal-target').value);
    const targetDate = document.getElementById('goal-date').value;
    if (!name || !target) return showToast('Enter goal name and target amount');
    DB.savingsGoals.push({ id: uid(), name, target, current: 0, targetDate });
    persist(); render();
  };

  const addDebtBtn = document.getElementById('add-debt-btn');
  if (addDebtBtn) addDebtBtn.onclick = () => {
    const person = document.getElementById('debt-person').value.trim();
    const amount = Number(document.getElementById('debt-amount').value);
    const type = document.getElementById('debt-type').value;
    if (!person || !amount) return showToast('Enter person and amount');
    DB.debts.push({ id: uid(), person, amount, type, paid: false, date: todayStr() });
    persist(); render();
  };

  const addSplitBtn = document.getElementById('add-split-btn');
  if (addSplitBtn) addSplitBtn.onclick = () => {
    const desc = document.getElementById('split-desc').value.trim();
    const total = Number(document.getElementById('split-total').value);
    const namesRaw = document.getElementById('split-friends').value.trim();
    if (!desc || !total || !namesRaw) return showToast('Fill in description, total, and friend names');
    const names = namesRaw.split(',').map(n => n.trim()).filter(Boolean);
    const perPerson = Math.round((total / (names.length + 1)) * 100) / 100;
    DB.splits.push({ id: uid(), desc, total, date: todayStr(), friends: names.map(n => ({ name: n, amount: perPerson, paid: false })) });
    persist(); render();
  };

  const addRecurringBtn = document.getElementById('add-recurring-btn');
  if (addRecurringBtn) addRecurringBtn.onclick = () => {
    const name = document.getElementById('rec-name').value.trim();
    const amount = Number(document.getElementById('rec-amount').value);
    const dueDay = Number(document.getElementById('rec-day').value);
    const category = document.getElementById('rec-category').value;
    if (!name || !amount || !dueDay) return showToast('Fill in all fields');
    DB.recurring.push({ id: uid(), name, amount, dueDay, category });
    persist(); render();
  };
}

function deleteIncome(id) { DB.income = DB.income.filter(i => i.id !== id); persist(); render(); }
function deleteExpense(id) { DB.expenses = DB.expenses.filter(e => e.id !== id); persist(); render(); }
function deleteGoal(id) { DB.savingsGoals = DB.savingsGoals.filter(g => g.id !== id); persist(); render(); }
function deleteDebt(id) { DB.debts = DB.debts.filter(d => d.id !== id); persist(); render(); }
function toggleDebtPaid(id) { const d = DB.debts.find(d => d.id === id); if (d) d.paid = !d.paid; persist(); render(); }
function deleteSplit(id) { DB.splits = DB.splits.filter(s => s.id !== id); persist(); render(); }
function toggleSplitPaid(splitId, idx) { const s = DB.splits.find(s => s.id === splitId); if (s) s.friends[idx].paid = !s.friends[idx].paid; persist(); render(); }
function deleteRecurring(id) { DB.recurring = DB.recurring.filter(r => r.id !== id); persist(); render(); }
function addToGoal(id) {
  const amt = Number(prompt('Add how much to this goal?'));
  if (!amt) return;
  const g = DB.savingsGoals.find(g => g.id === id);
  if (g) g.current = Math.min(g.current + amt, g.target);
  persist(); render();
}

/* ---------- Expenses ---------- */
function renderExpensesTab() {
  const sorted = [...DB.expenses].sort((a,b) => b.date.localeCompare(a.date));
  return `
    <div class="card">
      <h3>Add Expense</h3>
      <div class="form-row">
        <select id="exp-category">${allCategories().map(c => `<option>${c}</option>`).join('')}</select>
        <input type="number" id="exp-amount" placeholder="Amount">
        <input type="date" id="exp-date" value="${todayStr()}">
      </div>
      <div class="form-row"><input type="text" id="exp-note" placeholder="Note (optional)"></div>
      <button class="btn" id="add-expense-btn">＋ Add Expense</button>
    </div>
    <div class="section-title">Expense History</div>
    <div class="card">
      ${sorted.length ? `<div class="row-list">${sorted.map(e => `
        <div class="row-item">
          <div><div class="title">${escapeHtml(e.category)}</div><div class="meta">${e.date}${e.note ? ' · '+escapeHtml(e.note) : ''}</div></div>
          <div class="amount expense">-${fmt(e.amount)}</div>
          <div class="row-actions"><button onclick="deleteExpense('${e.id}')">✕</button></div>
        </div>`).join('')}</div>` : `<div class="empty-state">No expenses recorded yet.</div>`}
    </div>
  `;
}

/* ---------- Budget ---------- */
function renderBudgetTab() {
  const monthPrefix = todayStr().slice(0, 7);
  const spentByCat = {};
  DB.expenses.filter(e => e.date.startsWith(monthPrefix)).forEach(e => {
    spentByCat[e.category] = (spentByCat[e.category] || 0) + Number(e.amount);
  });

  return `
    <div class="card">
      <h3>Set Monthly Budget by Category</h3>
      <div class="grid cols-2">
        ${allCategories().map(cat => `
          <div>
            <label>${escapeHtml(cat)}</label>
            <input type="number" id="budget-${cat.replace(/\W/g,'_')}" value="${DB.budgets[cat] || ''}" placeholder="0">
          </div>`).join('')}
      </div>
      <button class="btn" id="save-budget-btn" style="margin-top:12px;">Save Budget</button>
    </div>
    <div class="section-title">Budget Progress (This Month)</div>
    <div class="card">
      ${Object.keys(DB.budgets).length ? `<div class="row-list">${Object.entries(DB.budgets).map(([cat, budget]) => {
        const spent = spentByCat[cat] || 0;
        const pct = Math.min((spent / budget) * 100, 100);
        const cls = spent > budget ? 'over' : pct > 80 ? 'warn' : '';
        return `<div>
          <div class="row-item"><div class="title">${escapeHtml(cat)}</div><div class="meta">${fmt(spent)} / ${fmt(budget)}</div></div>
          <div class="progress-bar"><div class="${cls}" style="width:${pct}%"></div></div>
        </div>`;
      }).join('')}</div>` : `<div class="empty-state">No budgets set yet.</div>`}
    </div>
  `;
}

/* ---------- Savings Goals ---------- */
function renderSavingsTab() {
  return `
    <div class="card">
      <h3>Create Savings Goal</h3>
      <div class="form-row">
        <input type="text" id="goal-name" placeholder="Goal name e.g. New Laptop">
        <input type="number" id="goal-target" placeholder="Target amount">
        <input type="date" id="goal-date">
      </div>
      <button class="btn" id="add-goal-btn">＋ Create Goal</button>
    </div>
    <div class="section-title">Your Goals</div>
    <div class="grid cols-2">
      ${DB.savingsGoals.length ? DB.savingsGoals.map(g => {
        const pct = Math.min((g.current / g.target) * 100, 100);
        return `<div class="card">
          <div class="row-item" style="border:none;padding:0;margin-bottom:6px;">
            <div class="title">${escapeHtml(g.name)}</div>
            <div class="row-actions"><button onclick="deleteGoal('${g.id}')">✕</button></div>
          </div>
          <div class="meta">${fmt(g.current)} of ${fmt(g.target)} ${g.targetDate ? '· by '+g.targetDate : ''}</div>
          <div class="progress-bar"><div style="width:${pct}%"></div></div>
          <button class="btn sm secondary" style="margin-top:10px;" onclick="addToGoal('${g.id}')">＋ Add Savings</button>
        </div>`;
      }).join('') : `<div class="card empty-state">No savings goals yet. Create one above.</div>`}
    </div>
  `;
}

/* ---------- Debts ---------- */
function renderDebtsTab() {
  const owed = DB.debts.filter(d => d.type === 'owed' && !d.paid);
  const owing = DB.debts.filter(d => d.type === 'owe' && !d.paid);
  return `
    <div class="card">
      <h3>Add Debt / Loan Entry</h3>
      <div class="form-row">
        <input type="text" id="debt-person" placeholder="Person's name">
        <input type="number" id="debt-amount" placeholder="Amount">
        <select id="debt-type"><option value="owe">I owe them</option><option value="owed">They owe me</option></select>
      </div>
      <button class="btn" id="add-debt-btn">＋ Add</button>
    </div>
    <div class="grid cols-2">
      <div>
        <div class="section-title">They Owe Me</div>
        <div class="card">
          ${owed.length ? `<div class="row-list">${owed.map(d => `
            <div class="row-item">
              <div><div class="title">${escapeHtml(d.person)}</div><div class="meta">${d.date}</div></div>
              <div class="amount income">${fmt(d.amount)}</div>
              <div class="row-actions"><button onclick="toggleDebtPaid('${d.id}')">✓</button><button onclick="deleteDebt('${d.id}')">✕</button></div>
            </div>`).join('')}</div>` : `<div class="empty-state">Nobody owes you right now.</div>`}
        </div>
      </div>
      <div>
        <div class="section-title">I Owe Them</div>
        <div class="card">
          ${owing.length ? `<div class="row-list">${owing.map(d => `
            <div class="row-item">
              <div><div class="title">${escapeHtml(d.person)}</div><div class="meta">${d.date}</div></div>
              <div class="amount expense">${fmt(d.amount)}</div>
              <div class="row-actions"><button onclick="toggleDebtPaid('${d.id}')">✓</button><button onclick="deleteDebt('${d.id}')">✕</button></div>
            </div>`).join('')}</div>` : `<div class="empty-state">You don't owe anyone right now.</div>`}
        </div>
      </div>
    </div>
  `;
}

/* ---------- Split Expense ---------- */
function renderSplitTab() {
  return `
    <div class="card">
      <h3>Split an Expense with Friends</h3>
      <div class="form-row">
        <input type="text" id="split-desc" placeholder="What was it for? e.g. Dinner outing">
        <input type="number" id="split-total" placeholder="Total amount">
      </div>
      <div class="form-row"><input type="text" id="split-friends" placeholder="Friend names, comma separated e.g. Rafi, Tanvir"></div>
      <button class="btn" id="add-split-btn">＋ Split Expense</button>
      <p style="font-size:12px;color:var(--ink-soft);margin-bottom:0;">Splits equally between you and the friends listed.</p>
    </div>
    <div class="section-title">Split History</div>
    <div class="row-list">
      ${DB.splits.length ? DB.splits.map(s => `
        <div class="card">
          <div class="row-item" style="border:none;padding:0;margin-bottom:8px;">
            <div><div class="title">${escapeHtml(s.desc)}</div><div class="meta">${s.date} · Total ${fmt(s.total)} · Your share ${fmt(s.total/(s.friends.length+1))}</div></div>
            <div class="row-actions"><button onclick="deleteSplit('${s.id}')">✕</button></div>
          </div>
          <div class="row-list">
            ${s.friends.map((f, idx) => `
              <div class="row-item">
                <div class="title">${escapeHtml(f.name)}</div>
                <div class="amount">${fmt(f.amount)}</div>
                <span class="pill ${f.paid ? 'green' : 'amber'}" style="cursor:pointer;" onclick="toggleSplitPaid('${s.id}', ${idx})">${f.paid ? 'Paid' : 'Pending'}</span>
              </div>`).join('')}
          </div>
        </div>
      `).join('') : `<div class="card empty-state">No split expenses yet.</div>`}
    </div>
  `;
}

/* ---------- Recurring Bills ---------- */
function renderRecurringTab() {
  return `
    <div class="card">
      <h3>Add Recurring Bill</h3>
      <div class="form-row">
        <input type="text" id="rec-name" placeholder="e.g. Wifi Bill">
        <input type="number" id="rec-amount" placeholder="Amount">
        <input type="number" id="rec-day" placeholder="Due day of month (1-31)" min="1" max="31">
        <select id="rec-category">${allCategories().map(c => `<option>${c}</option>`).join('')}</select>
      </div>
      <button class="btn" id="add-recurring-btn">＋ Add Recurring Bill</button>
    </div>
    <div class="section-title">Recurring Bills</div>
    <div class="card">
      ${DB.recurring.length ? `<div class="row-list">${DB.recurring.map(r => `
        <div class="row-item">
          <div><div class="title">${escapeHtml(r.name)}</div><div class="meta">Due on day ${r.dueDay} of each month · ${escapeHtml(r.category)}</div></div>
          <div class="amount expense">${fmt(r.amount)}</div>
          <div class="row-actions"><button onclick="deleteRecurring('${r.id}')">✕</button></div>
        </div>`).join('')}</div>` : `<div class="empty-state">No recurring bills set up yet.</div>`}
    </div>
  `;
}
