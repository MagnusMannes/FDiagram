// Page-based BHA tool logic
let currentBha = { name: '', assemblies: [] };
let currentAssembly = [];
let currentAssemblyIdx = 0;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

loadSession();

function loadSession() {
  try {
    const obj = JSON.parse(localStorage.getItem('currentBha') || '{}');
    currentBha = { name: obj.name || '', assemblies: obj.assemblies || [] };
    currentAssemblyIdx = parseInt(localStorage.getItem('currentAssemblyIdx') || '0', 10);
  } catch {
    currentBha = { name: '', assemblies: [] };
    currentAssemblyIdx = 0;
  }
}

function storeSession() {
  localStorage.setItem('currentBha', JSON.stringify(currentBha));
  localStorage.setItem('currentAssemblyIdx', String(currentAssemblyIdx));
}

// ───── Main page ─────
const newBtn = document.getElementById('newBtn');
if (newBtn) {
  newBtn.onclick = async () => {
    const name = prompt('Enter name for new BHA');
    if (!name) return;
    currentBha = { name: name.trim(), assemblies: [] };
    saveCurrentBha();
    await backupFile();
    storeSession();
    location.href = 'assembly.html';
  };
}

const histBtn = document.getElementById('historyBtn');
if (histBtn) histBtn.onclick = () => location.href = 'load.html';

const loadBtn = document.getElementById('loadBtn');
if (loadBtn) loadBtn.onclick = () => document.getElementById('fileInput').click();

const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) {
          currentBha = { name: 'Imported BHA', assemblies: [data] };
        } else {
          currentBha = {
            name: data.name || 'Imported BHA',
            assemblies: data.assemblies || [data.assembly || []]
          };
        }
        saveCurrentBha();
        storeSession();
        location.href = 'assembly.html';
      } catch { alert('Invalid JSON'); }
    };
    reader.readAsText(file);
  };
}

// ───── Load page ─────
const loadList = document.getElementById('loadList');
if (loadList) {
  renderLoadList();
  document.getElementById('loadBackBtn').onclick = () => location.href = 'index.html';
}

function renderLoadList() {
  loadList.innerHTML = '';
  const list = getBhaNames();
  if (!list.length) { loadList.textContent = 'No stored BHAs'; return; }
  list.forEach(info => {
    const row = document.createElement('div');
    row.className = 'load-row';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'primary';
    loadBtn.textContent = info.name;
    loadBtn.onclick = () => {
      const item = localStorage.getItem('bha-' + info.name);
      if (!item) { alert('BHA not found'); return; }
      try {
        const obj = JSON.parse(item);
        currentBha = {
          name: obj.name,
          assemblies: obj.assemblies || [obj.assembly || []]
        };
        saveCurrentBha();
        storeSession();
        location.href = 'assembly.html';
      } catch { alert('Failed to load BHA'); }
    };

    const created = document.createElement('span');
    created.className = 'dim';
    created.textContent = new Date(info.createdAt).toLocaleDateString();

    const updated = document.createElement('span');
    updated.className = 'dim';
    updated.textContent = new Date(info.updatedAt).toLocaleDateString();

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => { deleteBha(info.name); renderLoadList(); };

    row.appendChild(loadBtn);
    row.appendChild(created);
    row.appendChild(updated);
    row.appendChild(delBtn);
    loadList.appendChild(row);
  });
}

// ───── Assembly page ─────
const assemblyList = document.getElementById('assemblyList');
if (assemblyList) {
  renderAssemblyList();
  document.getElementById('addAssyBtn').onclick = () => {
    currentBha.assemblies.push([]);
    currentAssemblyIdx = currentBha.assemblies.length - 1;
    saveCurrentBha();
    storeSession();
    location.href = 'builder.html';
  };
  document.getElementById('backMainBtn').onclick = () => {
    storeSession();
    if (history.length > 1) history.back();
    else location.href = 'index.html';
  };

}

// ───── Builder page ─────
const bhaCanvas = document.getElementById('bhaCanvas');
if (bhaCanvas) {
  const ctx = bhaCanvas.getContext('2d');
  let placed = [];

  document.getElementById('assyTitle').textContent = 'Assembly ' + (currentAssemblyIdx + 1);

  fetch('public_components.json')
    .then(r => r.json())
    .then(data => {
      if (data && Array.isArray(data.components)) {
        data.components.forEach(c => addPaletteItem(c, document.getElementById('publicList')));
      }
    });

  const privateInput = document.getElementById('privateInput');
  privateInput.addEventListener('change', e => {
    const list = document.getElementById('privateList');
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        try { addPaletteItem(JSON.parse(reader.result), list); } catch {}
      };
      reader.readAsText(file);
    });
  });

  function addPaletteItem(comp, container) {
    const div = document.createElement('div');
    div.className = 'tool-item';
    div.draggable = true;
    div.textContent = comp.name || 'Component';
    div.dataset.comp = JSON.stringify(comp);
    div.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('application/json', div.dataset.comp);
    });
    container.appendChild(div);
  }

  bhaCanvas.addEventListener('dragover', ev => ev.preventDefault());
  bhaCanvas.addEventListener('drop', ev => {
    ev.preventDefault();
    const json = ev.dataTransfer.getData('application/json');
    if (!json) return;
    const comp = JSON.parse(json);
    drawComponent(comp, ev.offsetX, ev.offsetY);
    placed.push({ comp, x: ev.offsetX, y: ev.offsetY });
  });

  function drawComponent(comp, x, y) {
    comp.parts.forEach(p => {
      ctx.fillStyle = p.color || '#ccc';
      ctx.fillRect(x + (p.x || 0), y + (p.y || 0), p.width, p.height);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(x + (p.x || 0), y + (p.y || 0), p.width, p.height);
    });
  }

  if (currentBha.assemblies[currentAssemblyIdx]) {
    placed = currentBha.assemblies[currentAssemblyIdx];
    placed.forEach(item => drawComponent(item.comp, item.x, item.y));
  }

  document.getElementById('backAssyBtn').onclick = () => {
    currentBha.assemblies[currentAssemblyIdx] = placed;
    saveCurrentBha();
    storeSession();
    // Replace the builder page in history so returning from assemblies
    // never navigates back here
    location.replace('assembly.html');
  };
}

// ───── Helpers ─────
function addComponent(tool) {
  const div = document.createElement('div');
  div.className = 'bha-component';
  div.innerHTML = `<span>${tool.name}</span><span class="dim">${tool.od}" · ${tool.length} ft</span>`;
  dropZone.appendChild(div);
}

function loadAssembly(arr) {
  currentAssembly = Array.isArray(arr) ? [...arr] : [];
  if (dropZone) dropZone.querySelectorAll('.bha-component').forEach(el => el.remove());
  currentAssembly.forEach(addComponent);
}

function getBhaNames() {
  let names;
  try { names = JSON.parse(localStorage.getItem('bha-names') || '[]'); } catch { names = []; }
  const out = [];
  const now = Date.now();
  names.forEach(name => {
    const item = localStorage.getItem('bha-' + name);
    if (!item) return;
    try {
      const obj = JSON.parse(item);
      const updated = obj.updatedAt || obj.savedAt || 0;
      if (now - updated > MONTH_MS) {
        localStorage.removeItem('bha-' + name);
        return;
      }
      out.push({ name, createdAt: obj.createdAt || updated, updatedAt: updated });
    } catch {
      localStorage.removeItem('bha-' + name);
    }
  });
  localStorage.setItem('bha-names', JSON.stringify(out.map(o => o.name)));
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

function saveCurrentBha() {
  if (!currentBha.name) return;
  const key = 'bha-' + currentBha.name;
  let created = Date.now();
  const existing = localStorage.getItem(key);
  if (existing) {
    try { created = JSON.parse(existing).createdAt || created; } catch {}
  }
  const data = {
    name: currentBha.name,
    assemblies: currentBha.assemblies,
    createdAt: created,
    updatedAt: Date.now()
  };
  localStorage.setItem(key, JSON.stringify(data));
  const names = getBhaNames().map(n => n.name);
  if (!names.includes(currentBha.name)) {
    names.push(currentBha.name);
    localStorage.setItem('bha-names', JSON.stringify(names));
  }
}

function deleteBha(name) {
  if (!confirm('Are you sure you want to delete this BHA?')) return;
  let names;
  try { names = JSON.parse(localStorage.getItem('bha-names') || '[]'); } catch { names = []; }
  names = names.filter(n => n !== name);
  localStorage.setItem('bha-names', JSON.stringify(names));
  localStorage.removeItem('bha-' + name);
  if (currentBha.name === name) {
    localStorage.removeItem('currentBha');
    localStorage.removeItem('currentAssemblyIdx');
    currentBha = { name: '', assemblies: [] };
    currentAssemblyIdx = 0;
  }
}

async function backupFile() {
  const data = { name: currentBha.name, assemblies: currentBha.assemblies };
  const json = JSON.stringify(data, null, 2);
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: currentBha.name + '.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch {}
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentBha.name + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function renderAssemblyList() {
  const title = document.getElementById('bhaTitle');
  const list = document.getElementById('assemblyList');
  if (!list) return;
  if (title) title.textContent = currentBha.name || 'BHA';
  list.innerHTML = '';
  currentBha.assemblies.forEach((assy, idx) => {
    const row = document.createElement('div');

    const edit = document.createElement('button');
    edit.className = 'primary';
    edit.textContent = 'Assembly ' + (idx + 1);
    edit.onclick = () => {
      currentAssemblyIdx = idx;
      storeSession();
      location.href = 'builder.html';
    };

    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = 'Delete';
    del.onclick = () => {
      if (!confirm('Are you sure you want to delete this assembly?')) return;
      currentBha.assemblies.splice(idx, 1);
      if (currentAssemblyIdx >= currentBha.assemblies.length) {
        currentAssemblyIdx = currentBha.assemblies.length - 1;
      }
      saveCurrentBha();
      storeSession();
      renderAssemblyList();
    };

    row.appendChild(edit);
    row.appendChild(del);
    list.appendChild(row);
  });
}
