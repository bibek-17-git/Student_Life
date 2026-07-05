/* notes.js - quick notes/memos with pinning */

function renderNotes() {
  const pinned = DB.notes.filter(n => n.pinned);
  const others = DB.notes.filter(n => !n.pinned);
  return `
    <div class="card">
      <h3>Add Note</h3>
      <div class="form-row"><textarea id="note-text" rows="3" placeholder="Write a quick note..."></textarea></div>
      <button class="btn" id="add-note-btn">＋ Add Note</button>
    </div>
    ${pinned.length ? `<div class="section-title">Pinned</div>
    <div class="grid cols-3">${pinned.map(n => renderNoteCard(n)).join('')}</div>` : ''}
    <div class="section-title">All Notes</div>
    <div class="grid cols-3">
      ${others.length ? others.map(n => renderNoteCard(n)).join('') : (pinned.length ? '' : `<div class="card empty-state">No notes yet.</div>`)}
    </div>
  `;
}

function renderNoteCard(n) {
  return `<div class="note-card ${n.pinned?'pinned':''}">
    <div style="white-space:pre-wrap;font-size:13px;margin-bottom:24px;">${escapeHtml(n.text)}</div>
    <div style="position:absolute;bottom:8px;right:8px;display:flex;gap:8px;">
      <button class="btn sm ghost" style="padding:3px 8px;" onclick="togglePinNote('${n.id}')">${n.pinned ? '📌' : '📍'}</button>
      <button class="btn sm ghost" style="padding:3px 8px;" onclick="deleteNote('${n.id}')">✕</button>
    </div>
  </div>`;
}

function bindNoteEvents() {
  const btn = document.getElementById('add-note-btn');
  if (btn) btn.onclick = () => {
    const text = document.getElementById('note-text').value.trim();
    if (!text) return;
    DB.notes.unshift({ id: uid(), text, pinned: false });
    persist(); render();
  };
}
function togglePinNote(id) { const n = DB.notes.find(n => n.id === id); n.pinned = !n.pinned; persist(); render(); }
function deleteNote(id) { DB.notes = DB.notes.filter(n => n.id !== id); persist(); render(); }
