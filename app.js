// Page-based BHA tool logic
let currentBha = { name: '', assemblies: [] };
let currentAssembly = [];
let currentAssemblyIdx = 0;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

loadSession();

function loadSession() {
  try {
    const obj = JSON.parse(localStorage.getItem('currentBha') || '{}');
    currentBha = { name: obj.name || '', assemblies: [] };
    if (Array.isArray(obj.assemblies)) {
      obj.assemblies.forEach((a, i) => {
        if (Array.isArray(a)) {
          currentBha.assemblies.push({ name: 'Assembly ' + (i + 1), items: a });
        } else if (a && Array.isArray(a.items)) {
          currentBha.assemblies.push({ name: a.name || 'Assembly ' + (i + 1), items: a.items });
        }
      });
    }
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
        currentBha = { name: data.name || 'Imported BHA', assemblies: [] };
        const arr = Array.isArray(data.assemblies) ? data.assemblies :
                    (Array.isArray(data.assembly) ? [data.assembly] :
                    (Array.isArray(data) ? data : []));
        arr.forEach((a, i) => {
          if (Array.isArray(a)) {
            currentBha.assemblies.push({ name: 'Assembly ' + (i + 1), items: a });
          } else if (a && Array.isArray(a.items)) {
            currentBha.assemblies.push({ name: a.name || 'Assembly ' + (i + 1), items: a.items });
          }
        });
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
    const num = currentBha.assemblies.length + 1;
    currentBha.assemblies.push({ name: 'Assembly ' + num, items: [] });
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

  const nameInput = document.getElementById('assyTitle');
  const assyObj = currentBha.assemblies[currentAssemblyIdx] || { name: 'Assembly ' + (currentAssemblyIdx + 1), items: [] };
  nameInput.value = assyObj.name;
  nameInput.addEventListener('input', () => {
    assyObj.name = nameInput.value.trim() || 'Assembly ' + (currentAssemblyIdx + 1);
    redraw();
  });

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
    placed.push({ comp, x: ev.offsetX, y: ev.offsetY });
    redraw();
  });

  function drawComponent(comp, x, y) {
    comp.parts.forEach(p => {
      ctx.fillStyle = p.color || '#ccc';
      ctx.fillRect(x + (p.x || 0), y + (p.y || 0), p.width, p.height);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(x + (p.x || 0), y + (p.y || 0), p.width, p.height);
    });
  }

  function drawFrame() {
    const margin = 20;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, bhaCanvas.width, bhaCanvas.height);
    ctx.strokeRect(margin, margin, bhaCanvas.width - margin * 2, bhaCanvas.height - margin * 2);
    const tbW = 270; // 50% larger title block
    const tbH = 80;
    const smallRow = tbH / 4;
    const titleCol = 50; // narrow column just wide enough for label
    const x = bhaCanvas.width - margin - tbW;
    const y = bhaCanvas.height - margin - tbH;
    ctx.strokeRect(x, y, tbW, tbH);
    ctx.beginPath();
    ctx.moveTo(x, y + smallRow);
    ctx.lineTo(x + tbW, y + smallRow);
    ctx.moveTo(x + titleCol, y);
    ctx.lineTo(x + titleCol, y + smallRow);
    ctx.stroke();

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#000';
    ctx.fillText('Title:', x + 4, y + 14);
    ctx.fillText(assyObj.name, x + titleCol + 4, y + 14);
    ctx.fillText('Comment:', x + 4, y + smallRow + 14);
  }

  function redraw() {
    ctx.clearRect(0, 0, bhaCanvas.width, bhaCanvas.height);
    drawFrame();
    placed.forEach(item => drawComponent(item.comp, item.x, item.y));
  }

  if (assyObj.items) {
    placed = assyObj.items;
  }
  redraw();

  function renderForPrint(ctx, scale) {
    const width = bhaCanvas.width * scale;
    const height = bhaCanvas.height * scale;
    const margin = 20 * scale;
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = '#000';
    ctx.clearRect(0, 0, width, height);
    ctx.strokeRect(0, 0, width, height);
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

    const tbW = 270 * scale;
    const tbH = 80 * scale;
    const smallRow = tbH / 4;
    const titleCol = 50 * scale;
    const x = width - margin - tbW;
    const y = height - margin - tbH;
    ctx.strokeRect(x, y, tbW, tbH);
    ctx.beginPath();
    ctx.moveTo(x, y + smallRow);
    ctx.lineTo(x + tbW, y + smallRow);
    ctx.moveTo(x + titleCol, y);
    ctx.lineTo(x + titleCol, y + smallRow);
    ctx.stroke();

    ctx.font = (12 * scale) + 'px sans-serif';
    ctx.fillStyle = '#000';
    ctx.fillText('Title:', x + 4 * scale, y + 14 * scale);
    ctx.fillText(assyObj.name, x + titleCol + 4 * scale, y + 14 * scale);
    ctx.fillText('Comment:', x + 4 * scale, y + smallRow + 14 * scale);

    placed.forEach(item => {
      item.comp.parts.forEach(p => {
        ctx.fillStyle = p.color || '#ccc';
        const dx = (item.x + (p.x || 0)) * scale;
        const dy = (item.y + (p.y || 0)) * scale;
        const dw = p.width * scale;
        const dh = p.height * scale;
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(dx, dy, dw, dh);
      });
    });
  }

  document.getElementById('printPdfBtn').onclick = () => {
    const now = new Date();
    const stamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    const fileName = (assyObj.name || 'assembly') + '_' + stamp;

    const scale = 3; // roughly 300 DPI for A4
    const pCanvas = document.createElement('canvas');
    pCanvas.width = bhaCanvas.width * scale;
    pCanvas.height = bhaCanvas.height * scale;
    renderForPrint(pCanvas.getContext('2d'), scale);
    const imgData = pCanvas.toDataURL('image/png');

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write('<html><head><title>' + fileName + '</title>');
    doc.write('<style>@page{margin:0;}body{margin:0;}img{width:100%;height:auto;}</style>');
    doc.write('</head><body>');
    doc.write('<img src="' + imgData + '">');
    doc.write('</body></html>');
    doc.close();
    frame.onload = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    };
    frame.contentWindow.onafterprint = () => frame.remove();
  };

  document.getElementById('backAssyBtn').onclick = () => {
    assyObj.items = placed;
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
    edit.textContent = assy.name || 'Assembly ' + (idx + 1);
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
