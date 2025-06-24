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
  loadList.innerHTML = '';
  const names = getBhaNames();
  if (!names.length) loadList.textContent = 'No stored BHAs';
  names.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = name;
    btn.onclick = () => {
      const item = localStorage.getItem('bha-' + name);
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
    loadList.appendChild(btn);
  });
  document.getElementById('loadBackBtn').onclick = () => location.href = 'index.html';
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
  let list;
  try { list = JSON.parse(localStorage.getItem('bha-names') || '[]'); } catch { list = []; }
  list = list.filter(name => {
    const item = localStorage.getItem('bha-' + name);
    if (!item) return false;
    try {
      const obj = JSON.parse(item);
      if (Date.now() - obj.savedAt > MONTH_MS) {
        localStorage.removeItem('bha-' + name);
        return false;
      }
      return true;
    } catch {
      localStorage.removeItem('bha-' + name);
      return false;
    }
  });
  localStorage.setItem('bha-names', JSON.stringify(list));
  return list;
}

function saveCurrentBha() {
  if (!currentBha.name) return;
  const data = { name: currentBha.name, assemblies: currentBha.assemblies, savedAt: Date.now() };
  localStorage.setItem('bha-' + currentBha.name, JSON.stringify(data));
  const names = getBhaNames();
  if (!names.includes(currentBha.name)) {
    names.push(currentBha.name);
    localStorage.setItem('bha-names', JSON.stringify(names));
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
    del.className = 'secondary';
    del.textContent = 'Delete';
    del.onclick = () => {
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
