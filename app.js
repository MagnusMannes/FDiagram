// Page-based BHA tool logic
let currentBha = { name: '', assemblies: [] };
let currentAssembly = [];
let currentAssemblyIdx = 0;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Scale used when rendering imported PDF pages to images. Higher values
// produce better quality at the cost of memory usage.
const PDF_IMPORT_SCALE = 4; // default was 2

let CONNECTOR_TEMPLATE = null;

function preprocessConnectorTemplate(data) {
  const parts = [];
  const lines = [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  (data.parts || []).forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
    parts.push({
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      verts: (p.symVertices || []).slice().sort((a, b) => a.y - b.y),
    });
  });

  (data.drawnShapes || []).forEach((s) => {
    if (s.type === 'line') {
      minX = Math.min(minX, s.x1, s.x2);
      maxX = Math.max(maxX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2);
      maxY = Math.max(maxY, s.y1, s.y2);
      lines.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 });
    }
  });

  const width = maxX - minX;
  const height = maxY - minY;

  parts.forEach((p) => {
    p.x -= minX;
    p.y -= minY;
    const x = p.x;
    const y = p.y;
    const w = p.width;
    const h = p.height;
    const verts = p.verts;
    const pts = [];
    pts.push({ x, y });
    pts.push({ x: x + w, y });
    verts.forEach((v) => {
      pts.push({ x: x + w + v.dx, y: y + v.y });
    });
    pts.push({ x: x + w, y: y + h });
    pts.push({ x, y: y + h });
    for (let i = verts.length - 1; i >= 0; i--) {
      const v = verts[i];
      pts.push({ x: x - v.dx, y: y + v.y });
    }
    p.points = pts;
  });

  lines.forEach((l) => {
    l.x1 -= minX;
    l.y1 -= minY;
    l.x2 -= minX;
    l.y2 -= minY;
  });

  return { width, height, parts, lines };
}

// built-in fallback for connector graphics
const THREAD_TEMPLATE_DATA = {
  "parts": [
    {"x":1008,"y":20,"width":504,"height":59.71653543307087,"color":"#cccccc","topConnector":"none","bottomConnector":"none","special":false,"specialForms":[],"symVertices":[{"y":0,"dx":0},{"y":59.71653543307087,"dx":0}]},
    {"x":1044,"y":79.71653543307087,"width":432,"height":371.99999999999994,"color":"#cccccc","topConnector":"none","bottomConnector":"none","special":false,"specialForms":[],"symVertices":[{"y":0,"dx":36},{"y":371.99999999999994,"dx":0}]}
  ],
  "drawnShapes": [
    {"type":"line","width":2,"parentIndex":1,"x1":1042.5795454545455,"y1":78.54545454545455,"x2":1507.7045454545455,"y2":117.04545454545456,"relX1":-0.00328808922558913,"relY1":-0.003148066902194428,"relX2":1.0733901515151516,"relY2":0.1003465567537196},
    {"type":"line","width":2,"parentIndex":1,"x1":1010.125,"y1":110.375,"x2":1504,"y2":153,"relX1":-0.07841435185185185,"relY1":0.08241522733045466,"relX2":1.0648148148148149,"relY2":0.196998560663788},
    {"type":"line","width":2,"parentIndex":1,"x1":1015.5476190476192,"y1":147.625,"x2":1501.4464285714287,"y2":188.00000000000003,"relX1":-0.06586199294532603,"relY1":0.1825496359326052,"relX2":1.05890376984127,"relY2":0.29108458216916444},
    {"type":"line","width":2,"parentIndex":1,"x1":1022.9999999999998,"y1":225.5,"x2":1493.9999999999998,"y2":268.6428571428571,"relX1":-0.04861111111111164,"relY1":0.3918910337820676,"relX2":1.041666666666666,"relY2":0.507866456209103},
    {"type":"line","width":2,"parentIndex":1,"x1":1025.2440476190475,"y1":262.4761904761905,"x2":1490.529761904762,"y2":304.6190476190476,"relX1":-0.0434165564373901,"relY1":0.49128939527720333,"relX2":1.0336337081128748,"relY2":0.6045766456612279},
    {"type":"line","width":2,"parentIndex":1,"x1":1029.5178571428569,"y1":301.1071428571429,"x2":1486.0892857142856,"y2":348.29761904761904,"relX1":-0.03352347883597944,"relY1":0.5951360414625592,"relX2":1.0233548280423277,"relY2":0.7219921602541618},
    {"type":"line","width":2,"parentIndex":1,"x1":1033.9999999999998,"y1":339,"x2":1481.1428571428569,"y2":388.3333333333333,"relX1":-0.023148148148148674,"relY1":0.6969985606637881,"relX2":1.0119047619047612,"relY2":0.8296150481189852},
    {"type":"line","width":2,"parentIndex":1,"x1":1036.0119047619046,"y1":376.62499999999994,"x2":1477.2023809523807,"y2":427.3869047619047,"relX1":-0.018490961199294935,"relY1":0.7981410337820675,"relX2":1.002783289241622,"relY2":0.9345977670129944},
    {"type":"line","width":2,"parentIndex":1,"x1":1018.5535714285712,"y1":186.25000000000006,"x2":1496.7499999999998,"y2":227.87500000000006,"relX1":-0.05890376984127033,"relY1":0.2863802810938957,"relX2":1.0480324074074068,"relY2":0.3982754423842183},
    {"type":"line","width":2,"parentIndex":1,"x1":1039.2819264069265,"y1":415.29166666666663,"x2":1393.922619047619,"y2":451.1488095238094,"relX1":-0.010921466650633196,"relY1":0.9020836861118167,"relX2":0.8100060626102292,"relY2":0.9984738550826306}
  ]
};

CONNECTOR_TEMPLATE = preprocessConnectorTemplate(THREAD_TEMPLATE_DATA);

// attempt to load updated thread template
fetch('fdrawingv1/threads.json')
  .then(r => r.json())
  .then(d => {
    CONNECTOR_TEMPLATE = preprocessConnectorTemplate(d);
    if (typeof redraw === 'function') redraw();
  })
  .catch(() => { if (typeof redraw === 'function') redraw(); });

loadSession();

function normalizeAssembly(a, idx) {
  if (Array.isArray(a)) {
    return { name: 'Assembly ' + (idx + 1), items: a, texts: [], dimensions: [], diameters: [], fields: {}, pdfImage: null, showBorder: true, showTitle: true };
  }
  if (a && typeof a === 'object') {
    return {
      name: a.name || 'Assembly ' + (idx + 1),
      items: Array.isArray(a.items) ? a.items : [],
      texts: Array.isArray(a.texts) ? a.texts : [],
      dimensions: Array.isArray(a.dimensions) ? a.dimensions : [],
      diameters: Array.isArray(a.diameters) ? a.diameters : [],
      fields: a.fields || {},
      pdfImage: typeof a.pdfImage === 'string' ? a.pdfImage : null,
      showBorder: a.showBorder !== false,
      showTitle: a.showTitle !== false
    };
  }
  return { name: 'Assembly ' + (idx + 1), items: [], texts: [], dimensions: [], diameters: [], fields: {}, pdfImage: null, showBorder: true, showTitle: true };
}

function loadSession() {
  try {
    const obj = JSON.parse(localStorage.getItem('currentBha') || '{}');
    currentBha = { name: obj.name || '', assemblies: [] };
    if (Array.isArray(obj.assemblies)) {
      obj.assemblies.forEach((a, i) => {
        currentBha.assemblies.push(normalizeAssembly(a, i));
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
  newBtn.onclick = () => {
    const name = prompt('Enter name for new BHA');
    if (!name) return;
    currentBha = { name: name.trim(), assemblies: [] };
    saveCurrentBha();
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
          currentBha.assemblies.push(normalizeAssembly(a, i));
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
        currentBha = { name: obj.name, assemblies: [] };
        const arr = Array.isArray(obj.assemblies) ? obj.assemblies :
                    (obj.assembly ? [obj.assembly] : []);
        arr.forEach((a, i) => {
          currentBha.assemblies.push(normalizeAssembly(a, i));
        });
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

    const exportBtn = document.createElement('button');
    exportBtn.className = 'export-btn';
    exportBtn.textContent = 'Export';
    exportBtn.onclick = () => exportBha(info.name);

    row.appendChild(loadBtn);
    row.appendChild(created);
    row.appendChild(updated);
    row.appendChild(delBtn);
    row.appendChild(exportBtn);
    loadList.appendChild(row);
  });
}

// ───── Assembly page ─────
const assemblyList = document.getElementById('assemblyList');
if (assemblyList) {
  renderAssemblyList();
  const previewCanvas = document.getElementById('assemblyPreview');
  const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
  const contextMenu = document.getElementById('assyContextMenu');
  const moveUpItem = contextMenu ? contextMenu.querySelector('[data-action="up"]') : null;
  const moveDownItem = contextMenu ? contextMenu.querySelector('[data-action="down"]') : null;
  let contextIndex = -1;

  function hideContextMenu() { if (contextMenu) contextMenu.style.display = 'none'; }

  assemblyList.addEventListener('contextmenu', e => {
    const row = e.target.closest('.assy-row');
    if (!row) return;
    e.preventDefault();
    contextIndex = parseInt(row.dataset.index, 10);
    if (contextMenu) {
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
      contextMenu.style.display = 'block';
    }
  });
  window.addEventListener('click', hideContextMenu);
  if (moveUpItem) moveUpItem.onclick = () => {
    if (contextIndex > 0) {
      const tmp = currentBha.assemblies[contextIndex];
      currentBha.assemblies[contextIndex] = currentBha.assemblies[contextIndex - 1];
      currentBha.assemblies[contextIndex - 1] = tmp;
      saveCurrentBha();
      storeSession();
      renderAssemblyList();
    }
    hideContextMenu();
  };
  if (moveDownItem) moveDownItem.onclick = () => {
    if (contextIndex >= 0 && contextIndex < currentBha.assemblies.length - 1) {
      const tmp = currentBha.assemblies[contextIndex];
      currentBha.assemblies[contextIndex] = currentBha.assemblies[contextIndex + 1];
      currentBha.assemblies[contextIndex + 1] = tmp;
      saveCurrentBha();
      storeSession();
      renderAssemblyList();
    }
    hideContextMenu();
  };

  assemblyList.addEventListener('mouseover', e => {
    const row = e.target.closest('.assy-row');
    if (!row || !previewCanvas || !previewCtx) return;
    const idx = parseInt(row.dataset.index, 10);
    previewCanvas.hidden = false;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    renderAssembly(previewCtx, currentBha.assemblies[idx], previewCanvas.width / 794);
  });
  assemblyList.addEventListener('mouseout', e => {
    if (previewCanvas) previewCanvas.hidden = true;
  });

  document.getElementById('printAllBtn').onclick = () => {
    const scale = 4; // roughly 400 DPI for A4
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
    doc.write('<html><head><title>' + (currentBha.name || 'BHA') + '</title>');
    doc.write('<style>@page{size:210mm 297mm;margin:0;}body{margin:0;}img{width:100%;height:auto;page-break-after:always;}</style>');
    doc.write('</head><body>');
    currentBha.assemblies.forEach((a, i) => {
      const img = generateAssemblyImage(a, scale);
      doc.write('<img src="' + img + '">');
    });
    doc.write('</body></html>');
    doc.close();
    frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
    frame.contentWindow.onafterprint = () => frame.remove();
  };
  document.getElementById('addAssyBtn').onclick = () => {
    const num = currentBha.assemblies.length + 1;
    currentBha.assemblies.push({
      name: 'Assembly ' + num,
      items: [],
      texts: [],
      dimensions: [],
      diameters: [],
      fields: {},
      pdfImage: null,
      showBorder: true,
      showTitle: true
    });
    currentAssemblyIdx = currentBha.assemblies.length - 1;
    saveCurrentBha();
    storeSession();
    location.href = 'builder.html';
  };

  const uploadBtn = document.getElementById('uploadPdfBtn');
  const uploadInput = document.getElementById('extPdfInput');
  if (uploadBtn && uploadInput) {
    uploadBtn.onclick = () => uploadInput.click();
    uploadInput.onchange = async () => {
      const files = Array.from(uploadInput.files || []);
      if (!files.length) return;
      for (const file of files) {
        const url = URL.createObjectURL(file);
        try {
          const pdf = await pdfjsLib.getDocument(url).promise;
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: PDF_IMPORT_SCALE });
            const c = document.createElement('canvas');
            c.width = viewport.width;
            c.height = viewport.height;
            await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
            const imgData = c.toDataURL('image/png');
            const num = currentBha.assemblies.length + 1;
            const base = file.name.replace(/\.pdf$/i, '') || 'Assembly ' + num;
            const name = pdf.numPages > 1 ? `${base} - p${p}` : base;
            currentBha.assemblies.push({
              name,
              items: [],
              texts: [],
              dimensions: [],
              diameters: [],
              fields: {},
              pdfImage: imgData
            });
          }
        } catch (err) {
          alert('Failed to load PDF');
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      currentAssemblyIdx = currentBha.assemblies.length - 1;
      saveCurrentBha();
      storeSession();
      location.href = 'builder.html';
      uploadInput.value = '';
    };
  }
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
  const dropZone = document.getElementById('dropZone');
  let placed = [];
  const DEFAULT_SCALE = 0.125;
  const SCALE_STEP = 0.1;
  let builderScale = 1;
  const FDRAWER_URL = 'https://magnusmannes.github.io/FDrawer/';
  let pdfImg = null;
  let selectedItem = null;
  let resizeObj = null;
  let resizeAnchor = null;
  let resizeStartDist = 0;
  let resizeStartScale = 1;

  const previewCanvas = document.getElementById('previewCanvas');
  const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

  const addLengthBtn = document.getElementById('addLengthBtn');
  const addDiameterBtn = document.getElementById('addDiameterBtn');
  let lengthMode = false;
  let lengthPoints = [];
  const dimensions = [];
  const diameters = [];
  const addTextBtn = document.getElementById('addTextBtn');
  let textMode = false;
  const textBoxes = [];
  const DIAMETER_OFFSET = 20;
  const PRINT_TEXT_SCALE = 1.2;
  let dimensionDragTarget = null;
  let dimensionDragStartX = 0;
  let dimensionDragStartOffset = 0;
  let dimensionPointDragTarget = null;
  let dimensionPointDragStartY = 0;
  let diameterDragTarget = null;
  let diameterDragStartY = 0;
  let diameterDragStartOffset = 0;
  let textDragTarget = null;
  let textDragOffX = 0;
  let textDragOffY = 0;
  let diameterMode = false;
  let previewMouseX = 0;
  let previewMouseY = 0;


  function getCanvasPos(e) {
    const rect = bhaCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (bhaCanvas.width / rect.width),
      y: (e.clientY - rect.top) * (bhaCanvas.height / rect.height)
    };
  }

  function showPreview(comp) {
    if (!previewCanvas || !previewCtx) return;
    previewCanvas.hidden = false;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const b = getComponentBounds(comp);
    const scale = Math.min(
      (previewCanvas.width - 20) / b.width,
      (previewCanvas.height - 20) / b.height
    );
    previewCtx.save();
    previewCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
    previewCtx.scale(scale, scale);
    previewCtx.translate(-b.minX - b.width / 2, -b.minY - b.height / 2);
    drawComponent(previewCtx, comp, 0, 0, false, 1);
    previewCtx.restore();
  }

  function hidePreview() {
    if (previewCanvas) previewCanvas.hidden = true;
  }

  const nameInput = document.getElementById('assyTitle');
  const assyObj = currentBha.assemblies[currentAssemblyIdx] || {
    name: 'Assembly ' + (currentAssemblyIdx + 1),
    items: [],
    texts: [],
    dimensions: [],
    diameters: [],
    fields: {},
    pdfImage: null,
    showBorder: true,
    showTitle: true
  };
  if (assyObj.showBorder === undefined) assyObj.showBorder = true;
  if (assyObj.showTitle === undefined) assyObj.showTitle = true;
  if (assyObj.pdfImage) {
    pdfImg = new Image();
    pdfImg.src = assyObj.pdfImage;
    pdfImg.onload = redraw;
  }
  nameInput.value = assyObj.name;
  nameInput.addEventListener('input', () => {
    assyObj.name = nameInput.value.trim() || 'Assembly ' + (currentAssemblyIdx + 1);
    redraw();
  });

  const FIELD_DEFS = [
    { id: 'totalLength', label: 'Total L' },
    { id: 'maxOD', label: 'Max OD' },
    { id: 'minID', label: 'Minimum ID' },
    { id: 'fishNeckLength', label: 'Fish neck L' },
    { id: 'fishNeckOD', label: 'Fish neck OD' },
    { id: 'weight', label: 'Weight' },
    { id: 'basket', label: 'Basket' },
    { id: 'date', label: 'Date', getDefault: () => new Date().toISOString().split('T')[0] },
    { id: 'comments', label: 'Comment', double: true }
  ];
  const fields = assyObj.fields || {};
  FIELD_DEFS.forEach(def => {
    if (!fields[def.id]) {
      fields[def.id] = { value: def.getDefault ? def.getDefault() : '', enabled: false };
    }
  });
  assyObj.fields = fields;
  const fieldRects = [];

  fetch('public_components.json')
    .then(r => r.json())
    .then(data => {
      if (data && Array.isArray(data.components)) {
        data.components.forEach(c => addPaletteItem(c, document.getElementById('publicList')));
      }
    });

  const privateListEl = document.getElementById('privateList');
  let privateComponents = [];

  function loadPrivateComponents() {
    try {
      privateComponents = JSON.parse(localStorage.getItem('privateComponents') || '[]');
    } catch { privateComponents = []; }
    privateListEl.innerHTML = '';
    privateComponents.forEach(c => addPaletteItem(c, privateListEl, {isPrivate: true, store: false}));
  }

  function savePrivateComponents() {
    localStorage.setItem('privateComponents', JSON.stringify(privateComponents));
  }

  loadPrivateComponents();

  const fieldListEl = document.getElementById('fieldList');
  if (fieldListEl) {
    fieldListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const id = cb.dataset.field;
      if (fields[id]) cb.checked = fields[id].enabled;
      cb.addEventListener('change', () => {
        if (!fields[id]) return;
        fields[id].enabled = cb.checked;
        if (id === 'date' && cb.checked && !fields[id].value)
          fields[id].value = new Date().toISOString().split('T')[0];
        redraw();
      });
    });
  }

  const privateInput = document.getElementById('privateInput');
  privateInput.addEventListener('change', e => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          addPaletteItem(JSON.parse(reader.result), privateListEl, {isPrivate: true, store: true});
        } catch {}
      };
      reader.readAsText(file);
    });
  });

  const newComponentBtn = document.getElementById('newComponentBtn');
  let drawerWin = null;
  let editTarget = null;
  if (newComponentBtn) {
    newComponentBtn.onclick = () => {
      drawerWin = window.open(FDRAWER_URL, 'fdrawer');
    };
  }

  window.addEventListener('message', e => {
    if (!drawerWin || e.source !== drawerWin) return;
    const msg = e.data || {};
    if (msg.type === 'newComponent' && msg.component) {
      drawerWin.close();
      drawerWin = null;
      if (editTarget) {
        editTarget.comp = normalizeComponent(msg.component);
        editTarget = null;
        redraw();
      } else {
        addPaletteItem(normalizeComponent(msg.component), privateListEl, {isPrivate: true, store: true});
      }
    }
  });

  function addPaletteItem(comp, container, opts = {}) {
    const { isPrivate = false, store = false } = opts;
    const div = document.createElement('div');
    div.className = 'tool-item';
    div.draggable = true;
    div.textContent = comp.name || 'Component';
    div.dataset.comp = JSON.stringify(comp);
    div.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('application/json', div.dataset.comp);
    });
    div.addEventListener('mouseenter', () => showPreview(comp));
    div.addEventListener('mouseleave', hidePreview);
    if (isPrivate) {
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '×';
      del.draggable = false;
      del.addEventListener('click', ev => {
        ev.stopPropagation();
        if (!confirm('Delete this component?')) return;
        container.removeChild(div);
        privateComponents = privateComponents.filter(c => JSON.stringify(c) !== div.dataset.comp);
        savePrivateComponents();
      });
      div.prepend(del);
      if (store) {
        privateComponents.push(comp);
        savePrivateComponents();
      }
    }
    container.appendChild(div);
  }

  bhaCanvas.addEventListener('dragover', ev => ev.preventDefault());
  bhaCanvas.addEventListener('drop', ev => {
    ev.preventDefault();
    const json = ev.dataTransfer.getData('application/json');
    if (!json) return;
    const comp = normalizeComponent(JSON.parse(json));
    const pos = getCanvasPos(ev);
    placed.push({
      comp,
      x: pos.x,
      y: pos.y,
      flipped: false,
      scale: Math.max(0.05, DEFAULT_SCALE * builderScale),
      attachedTo: null,
      attachedChildren: []
    });
    redraw();
  });

  let dragObj = null;
  let dragOffX = 0;
  let dragOffY = 0;

  const contextMenu = document.getElementById('contextMenu');
  const modifyItem = document.getElementById('modifyItem');
  const removeLengthItem = document.getElementById('removeLengthItem');
  const removeDiameterItem = document.getElementById('removeDiameterItem');
  const toggleDiameterTypeItem = document.getElementById('toggleDiameterTypeItem');
  const deleteTextItem = document.getElementById('deleteTextItem');
  let contextTarget = null;
  let dimensionContextTarget = null;
  let diameterContextTarget = null;
  let textContextTarget = null;
  let rightDragItems = null;
  let rightDragPrevX = 0;
  let rightDragPrevY = 0;
  let rightDragging = false;

  bhaCanvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (rightDragging) { rightDragging = false; return; }
    const {x, y} = getCanvasPos(e);
    contextTarget = null;
    dimensionContextTarget = null;
    diameterContextTarget = null;
    textContextTarget = null;
    for (let i = placed.length - 1; i >= 0; i--) {
      const it = placed[i];
      if (hitTest(it, x, y)) { contextTarget = it; break; }
    }
    if (!contextTarget) {
      for (let i = 0; i < dimensions.length; i++) {
        if (dimensionHitTest(dimensions[i], x, y)) { dimensionContextTarget = i; break; }
      }
      if (dimensionContextTarget === null) {
        for (let i = 0; i < diameters.length; i++) {
          if (diameterHitTest(diameters[i], x, y)) { diameterContextTarget = i; break; }
        }
        if (diameterContextTarget === null) {
          for (let i = 0; i < textBoxes.length; i++) {
            if (textHitTest(textBoxes[i], x, y)) { textContextTarget = i; break; }
          }
        }
      }
    }
    if (contextTarget || dimensionContextTarget !== null || diameterContextTarget !== null || textContextTarget !== null) {
      modifyItem.style.display = contextTarget ? 'block' : 'none';
      if (removeLengthItem)
        removeLengthItem.style.display = dimensionContextTarget !== null ? 'block' : 'none';
      if (removeDiameterItem)
        removeDiameterItem.style.display = diameterContextTarget !== null ? 'block' : 'none';
      if (toggleDiameterTypeItem)
        toggleDiameterTypeItem.style.display = diameterContextTarget !== null ? 'block' : 'none';
      if (deleteTextItem)
        deleteTextItem.style.display = textContextTarget !== null ? 'block' : 'none';
      const dzRect = dropZone.getBoundingClientRect();
      contextMenu.style.left = (e.clientX - dzRect.left) + 'px';
      contextMenu.style.top = (e.clientY - dzRect.top) + 'px';
      contextMenu.style.display = 'block';
    } else {
      contextMenu.style.display = 'none';
    }
  });

  window.addEventListener('click', () => { contextMenu.style.display = 'none'; });

  modifyItem.addEventListener('click', () => {
    if (!contextTarget) return;
    contextMenu.style.display = 'none';
    editTarget = contextTarget;
    drawerWin = window.open(FDRAWER_URL, 'fdrawer');
    const sendEditMsg = () => {
      if (drawerWin && !drawerWin.closed) {
        drawerWin.postMessage({ type: 'editComponent', component: editTarget.comp }, '*');
      }
    };
    if (drawerWin) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        sendEditMsg();
        if (!drawerWin || drawerWin.closed || attempts >= 10) {
          clearInterval(interval);
        }
      }, 300);
      drawerWin.onload = () => {
        sendEditMsg();
      };
    }
  });

  if (removeLengthItem) {
    removeLengthItem.addEventListener('click', () => {
      if (dimensionContextTarget === null) return;
      dimensions.splice(dimensionContextTarget, 1);
      dimensionContextTarget = null;
      contextMenu.style.display = 'none';
      redraw();
    });
  }

  if (removeDiameterItem) {
    removeDiameterItem.addEventListener('click', () => {
      if (diameterContextTarget === null) return;
      diameters.splice(diameterContextTarget, 1);
      diameterContextTarget = null;
      contextMenu.style.display = 'none';
      redraw();
    });
  }

  if (toggleDiameterTypeItem) {
    toggleDiameterTypeItem.addEventListener('click', () => {
      if (diameterContextTarget === null) return;
      const dia = diameters[diameterContextTarget];
      dia.style = dia.style === 'singleLeft' ? 'double' : 'singleLeft';
      contextMenu.style.display = 'none';
      redraw();
    });
  }

  if (deleteTextItem) {
    deleteTextItem.addEventListener('click', () => {
      if (textContextTarget === null) return;
      textBoxes.splice(textContextTarget, 1);
      textContextTarget = null;
      contextMenu.style.display = 'none';
      redraw();
    });
  }

  function getHandlePos(it) {
    const b = getComponentBounds(it.comp);
    return {
      x: it.x + it.scale * (it.flipped ? b.minX : b.maxX),
      y: it.y + it.scale * (it.flipped ? b.maxY : b.minY)
    };
  }

  function getAnchorPos(it) {
    const b = getComponentBounds(it.comp);
    return {
      x: it.x + it.scale * (it.flipped ? b.maxX : b.minX),
      y: it.y + it.scale * (it.flipped ? b.minY : b.maxY)
    };
  }

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  function getItemBox(it) {
    const b = getComponentBounds(it.comp);
    return {
      left: it.x + b.minX * it.scale,
      right: it.x + b.maxX * it.scale,
      top: it.y + b.minY * it.scale,
      bottom: it.y + b.maxY * it.scale,
      width: (b.maxX - b.minX) * it.scale,
      height: (b.maxY - b.minY) * it.scale
    };
  }

  function pointInPolygon(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function hitTest(it, x, y) {
    const b = getComponentBounds(it.comp);
    const scale = it.scale;

    // Bounding box check first to make the entire component clickable
    const left = it.x + b.minX * scale;
    const right = it.x + b.maxX * scale;
    const top = it.y + b.minY * scale;
    const bottom = it.y + b.maxY * scale;
    if (x >= left && x <= right && y >= top && y <= bottom) return true;

    // Check bounding box of each part so hollow sections are still clickable
    for (const p of it.comp.parts) {
      const px = it.flipped ? b.width - p.x - p.width : p.x;
      const py = it.flipped ? b.height - p.y - p.height : p.y;
      const partLeft = it.x + px * scale;
      const partRight = partLeft + p.width * scale;
      const partTop = it.y + py * scale;
      const partBottom = partTop + p.height * scale;
      if (x >= partLeft && x <= partRight && y >= partTop && y <= partBottom)
        return true;
    }

    // Fall back to polygon hit test if needed
    for (const p of it.comp.parts) {
      const pts = partPolygonPoints(p, 0, 0).map(pt => {
        let px = it.flipped ? b.width - pt.x : pt.x;
        let py = it.flipped ? b.height - pt.y : pt.y;
        return { x: it.x + px * scale, y: it.y + py * scale };
      });
      if (pointInPolygon(pts, x, y)) return true;
    }
    return false;
  }

  function localToCanvas(it, lx, ly) {
    const b = getComponentBounds(it.comp);
    if (it.flipped) {
      lx = b.width - lx;
      ly = b.height - ly;
    }
    return { x: it.x + lx * it.scale, y: it.y + ly * it.scale };
  }

  function drawDimension(ctx, dim, scale = 1, textScale = 1) {
    const p1 = localToCanvas(dim.p1.item, dim.p1.x, dim.p1.y);
    const p2 = localToCanvas(dim.p2.item, dim.p2.x, dim.p2.y);
    const baseX = Math.max(p1.x, p2.x) + 20;
    const x = (baseX + (dim.offset || 0)) * scale;
    const y1 = p1.y * scale;
    const y2 = p2.y * scale;
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const len = Math.abs(bottom - top);
    const label = dim.label !== null && dim.label !== undefined ? dim.label : len.toFixed(0);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(p1.x * scale, p1.y * scale);
    ctx.lineTo(x, p1.y * scale);
    ctx.moveTo(p2.x * scale, p2.y * scale);
    ctx.lineTo(x, p2.y * scale);
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    const a = 6 * scale;
    ctx.beginPath();
    ctx.moveTo(x - a, top + a);
    ctx.lineTo(x, top);
    ctx.lineTo(x + a, top + a);
    ctx.moveTo(x - a, bottom - a);
    ctx.lineTo(x, bottom);
    ctx.lineTo(x + a, bottom - a);
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = (12 * scale * textScale) + 'px sans-serif';
    if (len > 30 * scale) {
      ctx.save();
      ctx.translate(x - 8 * scale, (top + bottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    } else {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 4 * scale, (top + bottom) / 2);
    }
  }

  function dimensionHitTest(dim, x, y) {
    const p1 = localToCanvas(dim.p1.item, dim.p1.x, dim.p1.y);
    const p2 = localToCanvas(dim.p2.item, dim.p2.x, dim.p2.y);
    const lineX = Math.max(p1.x, p2.x) + 20 + (dim.offset || 0);
    const top = Math.min(p1.y, p2.y);
    const bottom = Math.max(p1.y, p2.y);
    const near = 6;
    function distToSeg(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 0) t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const lx = x1 + t * dx;
      const ly = y1 + t * dy;
      return Math.hypot(px - lx, py - ly);
    }
    if (Math.abs(x - lineX) <= near && y >= top - near && y <= bottom + near) return true;
    if (distToSeg(x, y, p1.x, p1.y, lineX, p1.y) <= near) return true;
    if (distToSeg(x, y, p2.x, p2.y, lineX, p2.y) <= near) return true;

    const len = Math.abs(p2.y - p1.y);
    const label = dim.label !== null && dim.label !== undefined ? dim.label : len.toFixed(0);
    ctx.font = '12px sans-serif';
    const textWidth = ctx.measureText(label).width;
    const textHeight = 12;
    if (len > 30) {
      const cx = lineX - 8;
      const cy = (top + bottom) / 2;
      if (Math.abs(x - cx) <= textHeight / 2 + 2 && Math.abs(y - cy) <= textWidth / 2 + 2) return true;
    } else {
      const tx1 = lineX + 4;
      const ty1 = (top + bottom) / 2 - textHeight / 2 - 2;
      const tx2 = tx1 + textWidth + 4;
      const ty2 = ty1 + textHeight + 4;
    if (x >= tx1 && x <= tx2 && y >= ty1 && y <= ty2) return true;
    }
    return false;
  }

  function dimensionEndpointHitTest(dim, x, y) {
    const p1 = localToCanvas(dim.p1.item, dim.p1.x, dim.p1.y);
    const p2 = localToCanvas(dim.p2.item, dim.p2.x, dim.p2.y);
    const lineX = Math.max(p1.x, p2.x) + 20 + (dim.offset || 0);
    const near = 6;
    function distToSeg(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 0) t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const lx = x1 + t * dx;
      const ly = y1 + t * dy;
      return Math.hypot(px - lx, py - ly);
    }
    if (distToSeg(x, y, p1.x, p1.y, lineX, p1.y) <= near) return 'p1';
    if (distToSeg(x, y, p2.x, p2.y, lineX, p2.y) <= near) return 'p2';
    return null;
  }

  function drawDiameter(ctx, dia, scale = 1, textScale = 1) {
    const b = getComponentBounds(dia.item.comp);
    let ly = dia.y;
    if (dia.item.flipped) ly = b.height - ly;
    const y = (dia.item.y + (ly + (dia.offset || 0)) * dia.item.scale) * scale;
    const left = (dia.item.x + b.minX * dia.item.scale) * scale;
    const right = (dia.item.x + b.maxX * dia.item.scale) * scale;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 * scale;
    const a = 6 * scale;
    ctx.beginPath();
    if (dia.style === 'singleLeft') {
      const out = left - DIAMETER_OFFSET * scale;
      ctx.moveTo(out, y);
      ctx.lineTo(left, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(left - a, y - a);
      ctx.lineTo(left, y);
      ctx.lineTo(left - a, y + a);
      ctx.stroke();
    } else {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(left + a, y - a);
      ctx.lineTo(left, y);
      ctx.lineTo(left + a, y + a);
      ctx.moveTo(right - a, y - a);
      ctx.lineTo(right, y);
      ctx.lineTo(right - a, y + a);
      ctx.stroke();
    }
    ctx.fillStyle = '#000';
    ctx.font = (12 * scale * textScale) + 'px sans-serif';
    const displayVal = dia.item.comp.od !== undefined ? String(dia.item.comp.od) : '';
    const val = displayVal ? '\u00F8 ' + displayVal : '';
    if (val) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val, left - DIAMETER_OFFSET * scale - 4 * scale, y);
    }
  }

  function diameterHitTest(dia, x, y) {
    const b = getComponentBounds(dia.item.comp);
    let ly = dia.y;
    if (dia.item.flipped) ly = b.height - ly;
    const lineY = dia.item.y + (ly + (dia.offset || 0)) * dia.item.scale;
    let left = dia.item.x + b.minX * dia.item.scale - 6;
    let right = dia.item.x + b.maxX * dia.item.scale + 6;
    if (dia.style === 'singleLeft') {
      right = left + 12; // padding around the line
      left = dia.item.x + b.minX * dia.item.scale - DIAMETER_OFFSET - 6;
    }
    if (Math.abs(y - lineY) <= 6 && x >= left && x <= right) return true;

    const displayVal = dia.item.comp.od !== undefined ? String(dia.item.comp.od) : '';
    const val = displayVal ? '\u00F8 ' + displayVal : '';
    if (val) {
      ctx.font = '12px sans-serif';
      const textWidth = ctx.measureText(val).width;
      const textHeight = 12;
      const tx2 = dia.item.x + b.minX * dia.item.scale - DIAMETER_OFFSET - 4;
      const tx1 = tx2 - textWidth - 4;
      const ty1 = lineY - textHeight / 2 - 2;
      const ty2 = lineY + textHeight / 2 + 2;
      if (x >= tx1 && x <= tx2 && y >= ty1 && y <= ty2) return true;
    }
    return false;
  }

  function drawTextBox(ctx, tb, scale = 1, textScale = 1) {
    ctx.fillStyle = '#000';
    ctx.font = (16 * scale * textScale) + 'px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(tb.text, tb.x * scale, tb.y * scale);
  }

  function textHitTest(tb, x, y) {
    ctx.font = '16px sans-serif';
    const w = ctx.measureText(tb.text).width;
    const h = 16;
    return x >= tb.x && x <= tb.x + w && y >= tb.y && y <= tb.y + h;
  }

  // get the Y coordinate (in local component space) of the connection surface
  // either at the top or bottom. If no connector is defined, fall back to the
  // extreme top/bottom of all parts.
  function connectorLocalY(comp, pos) {
    let val = pos === 'top' ? Infinity : -Infinity;
    comp.parts.forEach(p => {
      if (pos === 'top') {
        if (p.topConnector && p.topConnector !== 'none') {
          val = Math.min(val, p.y);
        }
      } else {
        if (p.bottomConnector && p.bottomConnector !== 'none') {
          val = Math.max(val, p.y + p.height);
        }
      }
    });
    if (pos === 'top') {
      if (val === Infinity) val = Math.min(...comp.parts.map(p => p.y));
    } else {
      if (val === -Infinity) val = Math.max(...comp.parts.map(p => p.y + p.height));
    }
    return val;
  }

  // like getItemBox but the top/bottom values correspond to the connection
  // surfaces so snapping aligns connectors correctly
  function getSnapBox(it) {
    const b = getItemBox(it);
    const cb = getComponentBounds(it.comp);
    let top = connectorLocalY(it.comp, 'top');
    let bottom = connectorLocalY(it.comp, 'bottom');
    if (it.flipped) {
      const h = cb.height;
      const origTop = top;
      top = h - bottom;
      bottom = h - origTop;
    }
    return {
      left: b.left,
      right: b.right,
      top: it.y + top * it.scale,
      bottom: it.y + bottom * it.scale,
      width: b.width,
      height: (bottom - top) * it.scale
    };
  }

  function detach(it) {
    if (it.attachedTo) {
      const p = it.attachedTo;
      p.attachedChildren = (p.attachedChildren || []).filter(c => c !== it);
      it.attachedTo = null;
    }
  }

  function attachBelow(child, parent) {
    if (!child || !parent) return;
    let cur = parent;
    while (cur) {
      if (cur === child) return; // avoid cycles
      cur = cur.attachedTo;
    }
    detach(child);
    child.attachedTo = parent;
    parent.attachedChildren = parent.attachedChildren || [];
    if (!parent.attachedChildren.includes(child)) parent.attachedChildren.push(child);
  }

  function getRoot(it) {
    let r = it;
    while (r && r.attachedTo) r = r.attachedTo;
    return r;
  }

  function collectTree(it, arr) {
    arr.push(it);
    (it.attachedChildren || []).forEach(c => collectTree(c, arr));
  }

  bhaCanvas.addEventListener('mousedown', e => {
    const {x, y} = getCanvasPos(e);
    previewMouseX = x;
    previewMouseY = y;

    if (textMode && e.button === 0) {
      const t = prompt('Enter text:', 'Text');
      if (t !== null) {
        textBoxes.push({ text: t.trim() || 'Text', x, y });
        redraw();
      }
      textMode = false;
      if (addTextBtn) addTextBtn.textContent = 'Add text';
      return;
    }

    if (lengthMode && e.button === 0) {
      let target = null;
      for (let i = placed.length - 1; i >= 0; i--) {
        if (hitTest(placed[i], x, y)) { target = placed[i]; break; }
      }
      if (target) {
        const b = getComponentBounds(target.comp);
        let lx = (x - target.x) / target.scale;
        let ly = (y - target.y) / target.scale;
        if (target.flipped) { lx = b.width - lx; ly = b.height - ly; }
        lengthPoints.push({ item: target, x: lx, y: ly });
        if (lengthPoints.length === 2) {
        const newDim = { p1: lengthPoints[0], p2: lengthPoints[1], offset: 0, label: null };
          const cp1 = localToCanvas(newDim.p1.item, newDim.p1.x, newDim.p1.y);
          const cp2 = localToCanvas(newDim.p2.item, newDim.p2.x, newDim.p2.y);
          const baseX = Math.max(cp1.x, cp2.x) + 20;
          let off = 0;
          const SP = 15;
          while (dimensions.some(d => {
            const op1 = localToCanvas(d.p1.item, d.p1.x, d.p1.y);
            const op2 = localToCanvas(d.p2.item, d.p2.x, d.p2.y);
            const ox = Math.max(op1.x, op2.x) + 20 + (d.offset || 0);
            return Math.abs(ox - (baseX + off)) < 8;
          })) off += SP;
          newDim.offset = off;
          dimensions.push(newDim);
          lengthMode = false;
          lengthPoints = [];
          if (addLengthBtn) addLengthBtn.textContent = 'Add lengths';
          redraw();
        }
      }
      return;
    }

    if (diameterMode && e.button === 0) {
      let target = null;
      for (let i = placed.length - 1; i >= 0; i--) {
        if (hitTest(placed[i], x, y)) { target = placed[i]; break; }
      }
      if (target) {
        const b = getComponentBounds(target.comp);
        let ly = (y - target.y) / target.scale;
        if (target.flipped) ly = b.height - ly;
        diameters.push({ item: target, y: ly, offset: 0, style: 'double' });
        diameterMode = false;
        if (addDiameterBtn) addDiameterBtn.textContent = 'Add diameter';
        redraw();
      }
      return;
    }

    if (!lengthMode && !diameterMode && e.button === 0) {
      for (let i = textBoxes.length - 1; i >= 0; i--) {
        if (textHitTest(textBoxes[i], x, y)) {
          textDragTarget = textBoxes[i];
          textDragOffX = x - textBoxes[i].x;
          textDragOffY = y - textBoxes[i].y;
          return;
        }
      }
      for (let i = dimensions.length - 1; i >= 0; i--) {
        const anchor = dimensionEndpointHitTest(dimensions[i], x, y);
        if (anchor) {
          dimensionPointDragTarget = { dim: dimensions[i], anchor };
          dimensionPointDragStartY = y;
          return;
        }
        if (dimensionHitTest(dimensions[i], x, y)) {
          dimensionDragTarget = dimensions[i];
          dimensionDragStartX = x;
          dimensionDragStartOffset = dimensionDragTarget.offset || 0;
          return;
        }
      }
      for (let i = diameters.length - 1; i >= 0; i--) {
        if (diameterHitTest(diameters[i], x, y)) {
          diameterDragTarget = diameters[i];
          diameterDragStartY = y;
          diameterDragStartOffset = diameterDragTarget.offset || 0;
          return;
        }
      }
    }

    if (e.button === 2) {
      for (let i = placed.length - 1; i >= 0; i--) {
      const it = placed[i];
      if (hitTest(it, x, y)) {
        rightDragItems = [];
        collectTree(getRoot(it), rightDragItems);
        rightDragPrevX = x;
        rightDragPrevY = y;
        return;
      }
      }
      return;
    }

    if (selectedItem) {
      const h = getHandlePos(selectedItem);
      if (dist(x, y, h.x, h.y) <= 8) {
        resizeObj = selectedItem;
        resizeAnchor = getAnchorPos(selectedItem);
        resizeStartDist = dist(h.x, h.y, resizeAnchor.x, resizeAnchor.y);
        resizeStartScale = selectedItem.scale;
        return;
      }
    }

    selectedItem = null;
    for (let i = placed.length - 1; i >= 0; i--) {
      const it = placed[i];
      if (hitTest(it, x, y)) {
        dragObj = it;
        selectedItem = it;
        dragOffX = x - it.x;
        dragOffY = y - it.y;
        placed.splice(i, 1);
        placed.push(it);
        redraw();
        break;
      }
    }
    redraw();
  });

  bhaCanvas.addEventListener('dblclick', e => {
    const {x, y} = getCanvasPos(e);
    for (let i = textBoxes.length - 1; i >= 0; i--) {
      if (textHitTest(textBoxes[i], x, y)) {
        const cur = textBoxes[i].text;
        const input = prompt('Edit text:', cur);
        if (input !== null) {
          textBoxes[i].text = input.trim();
          redraw();
        }
        return;
      }
    }
    for (let i = diameters.length - 1; i >= 0; i--) {
      if (diameterHitTest(diameters[i], x, y)) {
        const cur = diameters[i].item.comp.od !== undefined ? String(diameters[i].item.comp.od) : '';
        const input = prompt('Enter diameter:', cur);
        if (input !== null) {
          diameters[i].item.comp.od = input.trim();
          redraw();
        }
        break;
      }
    }
    for (let i = dimensions.length - 1; i >= 0; i--) {
      if (dimensionHitTest(dimensions[i], x, y)) {
        const p1 = localToCanvas(dimensions[i].p1.item, dimensions[i].p1.x, dimensions[i].p1.y);
        const p2 = localToCanvas(dimensions[i].p2.item, dimensions[i].p2.x, dimensions[i].p2.y);
        const len = Math.abs(p2.y - p1.y);
        const cur = dimensions[i].label || len.toFixed(0);
        const input = prompt('Enter length label:', cur);
        if (input !== null) {
          dimensions[i].label = input.trim();
          redraw();
        }
        break;
      }
    }

    for (const rect of fieldRects) {
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        const def = FIELD_DEFS.find(d => d.id === rect.id);
        const cur = fields[rect.id].value || '';
        const input = prompt('Edit ' + def.label + ':', cur);
        if (input !== null) {
          fields[rect.id].value = input.trim();
          redraw();
        }
        break;
      }
    }
  });

  window.addEventListener('mousemove', e => {
    const {x, y} = getCanvasPos(e);

    previewMouseX = x;
    previewMouseY = y;
    if (textDragTarget) {
      textDragTarget.x = x - textDragOffX;
      textDragTarget.y = y - textDragOffY;
      redraw();
      return;
    }
    if (lengthMode && lengthPoints.length === 1 && !dragObj && !resizeObj && !rightDragItems) {
      redraw();
    }

    if (rightDragItems) {
      const dx = x - rightDragPrevX;
      const dy = y - rightDragPrevY;
      rightDragItems.forEach(it => { it.x += dx; it.y += dy; });
      rightDragPrevX = x;
      rightDragPrevY = y;
      rightDragging = true;
      redraw();
      return;
    }

    if (dimensionPointDragTarget) {
      const tgt = dimensionPointDragTarget;
      const item = tgt.dim[tgt.anchor].item;
      const b = getComponentBounds(item.comp);
      let ly = (y - item.y) / item.scale;
      if (item.flipped) ly = b.height - ly;
      tgt.dim[tgt.anchor].y = ly;
      redraw();
      return;
    }

    if (dimensionDragTarget) {
      dimensionDragTarget.offset = dimensionDragStartOffset + (x - dimensionDragStartX);
      redraw();
      return;
    }

    if (diameterDragTarget) {
      diameterDragTarget.offset = diameterDragStartOffset + (y - diameterDragStartY);
      redraw();
      return;
    }

    if (resizeObj) {
      const d = dist(x, y, resizeAnchor.x, resizeAnchor.y);
      if (resizeStartDist > 0) {
        resizeObj.scale = Math.max(0.05, resizeStartScale * (d / resizeStartDist));
        redraw();
      }
      return;
    }

    if (!dragObj) return;
    dragObj.x = x - dragOffX;
    dragObj.y = y - dragOffY;
    redraw();
  });

  window.addEventListener('mouseup', () => {
    if (textDragTarget) {
      textDragTarget = null;
      redraw();
      return;
    }
    if (rightDragItems) {
      rightDragItems = null;
      rightDragging = false;
      return;
    }
    if (resizeObj) {
      resizeObj = null;
      redraw();
      return;
    }
    if (dimensionPointDragTarget) {
      dimensionPointDragTarget = null;
      redraw();
      return;
    }
    if (dimensionDragTarget) {
      dimensionDragTarget = null;
      redraw();
      return;
    }
    if (diameterDragTarget) {
      diameterDragTarget = null;
      redraw();
      return;
    }
    if (!dragObj) return;
    const b = getComponentBounds(dragObj.comp);
    const minX = dragObj.x + b.minX * dragObj.scale;
    const maxX = dragObj.x + b.maxX * dragObj.scale;
    const minY = dragObj.y + b.minY * dragObj.scale;
    const maxY = dragObj.y + b.maxY * dragObj.scale;
    if (maxX < 0 || minX > bhaCanvas.width || maxY < 0 || minY > bhaCanvas.height) {
      placed = placed.filter(p => p !== dragObj);
    }

    // snapping logic - allow attaching above or below nearby item
    const box = getSnapBox(dragObj);
    let best = null;
    let bestDist = 20;
    let attachAbove = false; // true if dragObj should become parent
    placed.forEach(o => {
      if (o === dragObj) return;
      const ob = getSnapBox(o);
      const centerDiff = Math.abs((box.left + box.right) / 2 - (ob.left + ob.right) / 2);
      if (centerDiff > Math.max(ob.width, box.width) / 2) return;

      const distBelow = Math.abs(box.top - ob.bottom);
      if (distBelow < bestDist) {
        best = o; bestDist = distBelow; attachAbove = false;
      }

      const distAbove = Math.abs(box.bottom - ob.top);
      if (distAbove < bestDist) {
        best = o; bestDist = distAbove; attachAbove = true;
      }
    });

    if (best) {
      const pb = getSnapBox(best);
      dragObj.x += ( (pb.left + pb.right) / 2 - (box.left + box.right) / 2 );
      if (attachAbove) {
        dragObj.y += pb.top - box.bottom;
        attachBelow(best, dragObj);
      } else {
        dragObj.y += pb.bottom - box.top;
        attachBelow(dragObj, best);
      }
    } else {
      detach(dragObj);
    }

    dragObj = null;
    redraw();
  });


  function normalizeComponent(comp) {
    if (!comp || !Array.isArray(comp.parts)) return comp;
    const copy = JSON.parse(JSON.stringify(comp));

    if (Array.isArray(copy.drawnShapes)) {
      copy.drawnShapes.forEach(s => {
        const idx = typeof s.parentIndex === 'number' ? s.parentIndex : -1;
        const p = copy.parts && copy.parts[idx];
        if (!p) return;
        if (s.type === 'line') {
          if (typeof s.relX1 === 'number') s.x1 = p.x + s.relX1 * p.width;
          if (typeof s.relY1 === 'number') s.y1 = p.y + s.relY1 * p.height;
          if (typeof s.relX2 === 'number') s.x2 = p.x + s.relX2 * p.width;
          if (typeof s.relY2 === 'number') s.y2 = p.y + s.relY2 * p.height;
        } else if (s.type === 'circle') {
          if (typeof s.relCX === 'number') s.cx = p.x + s.relCX * p.width;
          if (typeof s.relCY === 'number') s.cy = p.y + s.relCY * p.height;
          if (typeof s.relR === 'number') s.r = s.relR * ((p.width + p.height) / 2);
        } else if (s.type === 'curve') {
          if (s.relP0) s.p0 = { x: p.x + s.relP0.x * p.width, y: p.y + s.relP0.y * p.height };
          if (s.relP1) s.p1 = { x: p.x + s.relP1.x * p.width, y: p.y + s.relP1.y * p.height };
          if (s.relP2) s.p2 = { x: p.x + s.relP2.x * p.width, y: p.y + s.relP2.y * p.height };
        }
      });
    }

    const minX = Math.min(...copy.parts.map(p => p.x || 0));
    const minY = Math.min(...copy.parts.map(p => p.y || 0));

    copy.parts = copy.parts.map(p => ({
      ...p,
      x: (p.x || 0) - minX,
      y: (p.y || 0) - minY
    }));

    if (Array.isArray(copy.drawnShapes)) {
      copy.drawnShapes = copy.drawnShapes.map(s => {
        const d = JSON.parse(JSON.stringify(s));
        if (s.type === 'line') {
          d.x1 -= minX; d.y1 -= minY;
          d.x2 -= minX; d.y2 -= minY;
        } else if (s.type === 'circle') {
          d.cx -= minX; d.cy -= minY;
        } else if (s.type === 'curve') {
          d.p0.x -= minX; d.p0.y -= minY;
          d.p1.x -= minX; d.p1.y -= minY;
          d.p2.x -= minX; d.p2.y -= minY;
        }
        return d;
      });
    }

    return copy;
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [num >> 16, (num >> 8) & 255, num & 255];
  }

  function rgbToHex(r, g, b) {
    return (
      '#' + [r, g, b].map(v => {
        const h = v.toString(16);
        return h.length === 1 ? '0' + h : h;
      }).join('')
    );
  }

  function lightenColor(color, p) {
    const [r, g, b] = hexToRgb(color);
    const nr = Math.round(r + (255 - r) * p);
    const ng = Math.round(g + (255 - g) * p);
    const nb = Math.round(b + (255 - b) * p);
    return rgbToHex(nr, ng, nb);
  }

  function darkenColor(color, p) {
    const [r, g, b] = hexToRgb(color);
    const nr = Math.round(r * (1 - p));
    const ng = Math.round(g * (1 - p));
    const nb = Math.round(b * (1 - p));
    return rgbToHex(nr, ng, nb);
  }

  function parseInches(str) {
    str = (str || '').trim();
    let m = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]);
    m = str.match(/^(\d+)\/(\d+)$/);
    if (m) return parseInt(m[1]) / parseInt(m[2]);
    return parseFloat(str);
  }

  function formatTwelfthInches(val) {
    if (typeof val !== 'number' || isNaN(val)) return '';
    const sign = val < 0 ? -1 : 1;
    val = Math.abs(val);
    const whole = Math.floor(val);
    let frac = Math.round((val - whole) * 12);
    if (frac === 12) { frac = 0; return (sign < 0 ? '-' : '') + (whole + 1) + '"'; }
    if (frac === 0) return (sign < 0 ? '-' : '') + whole + '"';
    const g = gcd(frac, 12);
    frac /= g;
    const denom = 12 / g;
    const prefix = sign < 0 ? '-' : '';
    return prefix + (whole ? whole + ' ' : '') + frac + '/' + denom + '"';
  }

  function gcd(a, b) {
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }

  function hasTopThread(comp) {
    return comp.parts.some(p => p.topConnector && p.topConnector !== 'none');
  }

  function hasBottomThread(comp) {
    return comp.parts.some(p => p.bottomConnector && p.bottomConnector !== 'none');
  }

  function toggleThread(comp, pos) {
    const prop = pos === 'top' ? 'topConnector' : 'bottomConnector';
    comp.parts.forEach(p => {
      if (p[prop] !== undefined) {
        p[prop] = (p[prop] && p[prop] !== 'none') ? 'none' : 'PIN';
      }
    });
  }

  function drawConnector(ctx, part, pos, type) {
    if (!CONNECTOR_TEMPLATE) return;
    const scale = (part.width * 0.8) / CONNECTOR_TEMPLATE.width;
    const w = CONNECTOR_TEMPLATE.width * scale;
    const h = CONNECTOR_TEMPLATE.height * scale;
    const flip =
      (pos === 'top' && type === 'PIN') ||
      (pos === 'bottom' && type === 'BOX');
    const x0 = part.x + (part.width - w) / 2;
    let y0;
    if (pos === 'top') y0 = type === 'PIN' ? part.y - h : part.y;
    else y0 = type === 'PIN' ? part.y + part.height : part.y + part.height - h;

    ctx.save();
    ctx.translate(x0, y0);
    if (flip) {
      ctx.translate(0, h);
      ctx.scale(scale, -scale);
    } else {
      ctx.scale(scale, scale);
    }

    CONNECTOR_TEMPLATE.parts.forEach((p) => {
      const pts = p.points;
      if (!pts.length) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      const baseColor = type === 'BOX' ? '#b3b3b3' : '#cccccc';
      ctx.fillStyle = cylinderGradient(ctx, baseColor, p.x, p.width);
      if (type === 'BOX') {
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fill();
      }
    });

    CONNECTOR_TEMPLATE.lines.forEach((l) => {
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.strokeStyle = type === 'BOX' ? '#555' : '#000';
      ctx.lineWidth = 2;
      if (type === 'BOX') ctx.setLineDash([4, 2]);
      ctx.stroke();
      if (type === 'BOX') ctx.setLineDash([]);
    });

    ctx.restore();
  }

  function cylinderGradient(ctx, color, x, w) {
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, darkenColor(color, 0.25));
    grad.addColorStop(0.25, lightenColor(color, 0.2));
    grad.addColorStop(0.5, lightenColor(color, 0.4));
    grad.addColorStop(0.75, lightenColor(color, 0.2));
    grad.addColorStop(1, darkenColor(color, 0.25));
    return grad;
  }

  function partPolygonPoints(p, offX, offY) {
    const x = offX + (p.x || 0);
    const y = offY + (p.y || 0);
    const w = p.width;
    const h = p.height;
    const verts = (p.symVertices || []).slice().sort((a,b)=>a.y-b.y);
    const pts = [];
    pts.push({x, y});
    pts.push({x:x+w, y});
    verts.forEach(v => pts.push({x:x+w+v.dx, y:y+v.y}));
    pts.push({x:x+w, y:y+h});
    pts.push({x, y:y+h});
    for(let i=verts.length-1;i>=0;i--) pts.push({x:x-verts[i].dx, y:y+verts[i].y});
    return pts;
  }

  function drawPart(ctx, p, offX, offY) {
    const pts = partPolygonPoints(p, offX, offY);
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = cylinderGradient(ctx, p.color || '#ccc',
      offX + (p.x||0), p.width);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }

  function drawShapes(ctx, comp, offX, offY) {
    if (!Array.isArray(comp.drawnShapes)) return;
    comp.drawnShapes.forEach(s => {
      ctx.lineWidth = s.width || 2;
      ctx.strokeStyle = '#000';
      ctx.setLineDash([]);
      if (s.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(offX + s.x1, offY + s.y1);
        ctx.lineTo(offX + s.x2, offY + s.y2);
        ctx.stroke();
      } else if (s.type === 'circle') {
        ctx.beginPath();
        ctx.arc(offX + s.cx, offY + s.cy, s.r, 0, Math.PI*2);
        ctx.stroke();
      } else if (s.type === 'curve') {
        ctx.beginPath();
        ctx.moveTo(offX + s.p0.x, offY + s.p0.y);
        ctx.quadraticCurveTo(offX + s.p1.x, offY + s.p1.y,
                             offX + s.p2.x, offY + s.p2.y);
        ctx.stroke();
      }
    });
  }

  function drawComponent(ctx, comp, x, y, flipped, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (flipped) {
      const b = getComponentBounds(comp);
      ctx.translate(b.width / 2, b.height / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-b.width / 2, -b.height / 2);
    }
    comp.parts.forEach(p => drawPart(ctx, p, 0, 0));
    drawShapes(ctx, comp, 0, 0);
    comp.parts.forEach(p => {
      const part = { x: (p.x || 0), y: (p.y || 0), width: p.width, height: p.height };
      if (p.topConnector && p.topConnector !== 'none')
        drawConnector(ctx, part, 'top', p.topConnector);
      if (p.bottomConnector && p.bottomConnector !== 'none')
        drawConnector(ctx, part, 'bottom', p.bottomConnector);
    });
    ctx.restore();
  }

  function getComponentBounds(comp) {
    if (comp._bounds) return comp._bounds;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    comp.parts.forEach(p => {
      partPolygonPoints(p, 0, 0).forEach(pt => {
        minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
      });
      if (CONNECTOR_TEMPLATE) {
        if (p.topConnector === 'PIN') {
          const scale = (p.width * 0.8) / CONNECTOR_TEMPLATE.width;
          minY = Math.min(minY, p.y - CONNECTOR_TEMPLATE.height * scale);
        }
        if (p.bottomConnector === 'PIN') {
          const scale = (p.width * 0.8) / CONNECTOR_TEMPLATE.width;
          maxY = Math.max(maxY, p.y + p.height + CONNECTOR_TEMPLATE.height * scale);
        }
      }
    });
    (comp.drawnShapes || []).forEach(s => {
      if (s.type === 'line') {
        minX = Math.min(minX, s.x1, s.x2);
        maxX = Math.max(maxX, s.x1, s.x2);
        minY = Math.min(minY, s.y1, s.y2);
        maxY = Math.max(maxY, s.y1, s.y2);
      } else if (s.type === 'circle') {
        minX = Math.min(minX, s.cx - s.r);
        maxX = Math.max(maxX, s.cx + s.r);
        minY = Math.min(minY, s.cy - s.r);
        maxY = Math.max(maxY, s.cy + s.r);
      } else if (s.type === 'curve') {
        [s.p0, s.p1, s.p2].forEach(pt => {
          minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
        });
      }
    });
    if (minX === Infinity) { minX = minY = 0; maxX = maxY = 0; }
    comp._bounds = {minX, minY, maxX, maxY, width:maxX-minX, height:maxY-minY};
    return comp._bounds;
  }

  function drawFrame() {
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    const margin = 20;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    if (assyObj.showBorder !== false) {
      ctx.strokeRect(0, 0, bhaCanvas.width, bhaCanvas.height);
      ctx.strokeRect(margin, margin, bhaCanvas.width - margin * 2, bhaCanvas.height - margin * 2);
    }
    if (pdfImg && pdfImg.complete) {
      ctx.drawImage(pdfImg, margin, margin, bhaCanvas.width - margin * 2, bhaCanvas.height - margin * 2);
    }

    if (assyObj.showTitle !== false) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#000';
      ctx.fillText(assyObj.name, margin + 4, margin + 24);
    }

    fieldRects.length = 0;
    const active = FIELD_DEFS.filter(d => fields[d.id] && fields[d.id].enabled);
    if (!active.length) return;
    const tbW = 320;
    const smallRow = 20;
    const titleCol = 100;
    const rowCount = active.reduce((a, d) => a + (d.double ? 2 : 1), 0);
    const tbH = smallRow * rowCount;
    const x = bhaCanvas.width - margin - tbW;
    const y = bhaCanvas.height - margin - tbH;
    ctx.strokeRect(x, y, tbW, tbH);

    let curY = y;
    active.forEach(def => {
      const rowH = smallRow * (def.double ? 2 : 1);
      ctx.beginPath();
      ctx.moveTo(x, curY + rowH);
      ctx.lineTo(x + tbW, curY + rowH);
      ctx.moveTo(x + titleCol, curY);
      ctx.lineTo(x + titleCol, curY + rowH);
      ctx.stroke();
      ctx.font = '12px sans-serif';
      ctx.fillText(def.label + ':', x + 4, curY + 14);
      if (def.double) {
        const lines = String(fields[def.id].value || '').split(/\n/);
        ctx.fillText(lines[0] || '', x + titleCol + 4, curY + 14);
        if (lines[1]) ctx.fillText(lines[1], x + titleCol + 4, curY + 14 + smallRow);
      } else {
        ctx.fillText(fields[def.id].value || '', x + titleCol + 4, curY + 14);
      }
      fieldRects.push({ id: def.id, x: x + titleCol, y: curY, w: tbW - titleCol, h: rowH });
      curY += rowH;
    });
  }

  function redraw() {
    ctx.clearRect(0, 0, bhaCanvas.width, bhaCanvas.height);
    drawFrame();
    placed.forEach(item => {
      drawComponent(ctx, item.comp, item.x, item.y, item.flipped, item.scale || 1);
      if (item === selectedItem) {
        const h = getHandlePos(item);
        ctx.fillStyle = '#007aff';
        ctx.beginPath();
        ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (lengthMode && lengthPoints.length === 1) {
      const p1 = localToCanvas(lengthPoints[0].item, lengthPoints[0].x, lengthPoints[0].y);
      ctx.strokeStyle = '#ff9500';
      ctx.fillStyle = '#ff9500';
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(previewMouseX, previewMouseY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(previewMouseX, previewMouseY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    dimensions.forEach(d => drawDimension(ctx, d));
    diameters.forEach(d => drawDiameter(ctx, d));
    textBoxes.forEach(t => drawTextBox(ctx, t));
  }

  if (assyObj.items) {
    placed = assyObj.items.map(it => ({
      comp: it.comp,
      x: it.x,
      y: it.y,
      flipped: it.flipped || false,
      scale: typeof it.scale === 'number' ? it.scale : 1,
      attachedTo: null,
      attachedChildren: []
    }));
    if (placed.length)
      builderScale = placed[0].scale / DEFAULT_SCALE;
    assyObj.items.forEach((it, i) => {
      if (typeof it.parentIndex === 'number') {
        const parent = placed[it.parentIndex];
        if (parent) {
          placed[i].attachedTo = parent;
          parent.attachedChildren.push(placed[i]);
        }
      }
    });
  }
  if (Array.isArray(assyObj.texts)) {
    assyObj.texts.forEach(t => {
      textBoxes.push({ text: t.text || '', x: t.x || 0, y: t.y || 0 });
    });
  }

  if (Array.isArray(assyObj.dimensions)) {
    assyObj.dimensions.forEach(d => {
      const p1 = placed[d.p1.itemIndex];
      const p2 = placed[d.p2.itemIndex];
      if (p1 && p2) {
        dimensions.push({
          p1: { item: p1, x: d.p1.x, y: d.p1.y },
          p2: { item: p2, x: d.p2.x, y: d.p2.y },
          offset: d.offset || 0,
          label: d.label != null ? d.label : null
        });
      }
    });
  }

  if (Array.isArray(assyObj.diameters)) {
    assyObj.diameters.forEach(di => {
      const it = placed[di.itemIndex];
      if (it) {
        diameters.push({
          item: it,
          y: di.y,
          offset: di.offset || 0,
          style: di.style || 'double'
        });
      }
    });
  }
  redraw();

  document.getElementById('scaleUpBtn').onclick = () => {
    builderScale *= 1 + SCALE_STEP;
    placed.forEach(p => { p.scale *= 1 + SCALE_STEP; });
    redraw();
  };

  document.getElementById('scaleDownBtn').onclick = () => {
    builderScale = Math.max(0.05 / DEFAULT_SCALE, builderScale * (1 - SCALE_STEP));
    placed.forEach(p => { p.scale = Math.max(0.05, p.scale * (1 - SCALE_STEP)); });
    redraw();
  };

  if (addLengthBtn) {
    addLengthBtn.onclick = () => {
      if (lengthMode) {
        lengthMode = false;
        lengthPoints = [];
        addLengthBtn.textContent = 'Add lengths';
        if (diameterMode && addDiameterBtn) {
          diameterMode = false;
          addDiameterBtn.textContent = 'Add diameter';
        }
      } else {
        diameterMode = false;
        if (addDiameterBtn) addDiameterBtn.textContent = 'Add diameter';
        lengthMode = true;
        lengthPoints = [];
        addLengthBtn.textContent = 'Select points';
      }
    };
  }

  if (addDiameterBtn) {
    addDiameterBtn.onclick = () => {
      if (diameterMode) {
        diameterMode = false;
        addDiameterBtn.textContent = 'Add diameter';
        if (lengthMode && addLengthBtn) {
          lengthMode = false;
          lengthPoints = [];
          addLengthBtn.textContent = 'Add lengths';
        }
      } else {
        lengthMode = false;
        lengthPoints = [];
        if (addLengthBtn) addLengthBtn.textContent = 'Add lengths';
        diameterMode = true;
        addDiameterBtn.textContent = 'Select point';
      }
    };
  }

  if (addTextBtn) {
    addTextBtn.onclick = () => {
      if (textMode) {
        textMode = false;
        addTextBtn.textContent = 'Add text';
      } else {
        textMode = true;
        if (addLengthBtn) { lengthMode = false; lengthPoints = []; addLengthBtn.textContent = 'Add lengths'; }
        if (addDiameterBtn) { diameterMode = false; addDiameterBtn.textContent = 'Add diameter'; }
        addTextBtn.textContent = 'Click location';
      }
    };
  }

  const toggleBorderBtn = document.getElementById('toggleBorderBtn');
  if (toggleBorderBtn) {
    const setTxt = () => {
      toggleBorderBtn.textContent = assyObj.showBorder ? 'Hide Border' : 'Show Border';
    };
    setTxt();
    toggleBorderBtn.onclick = () => {
      assyObj.showBorder = !assyObj.showBorder;
      setTxt();
      redraw();
      saveCurrentBha();
    };
  }

  const toggleTitleBtn = document.getElementById('toggleTitleBtn');
  if (toggleTitleBtn) {
    const setTxt = () => {
      toggleTitleBtn.textContent = assyObj.showTitle ? 'Hide Title' : 'Show Title';
    };
    setTxt();
    toggleTitleBtn.onclick = () => {
      assyObj.showTitle = !assyObj.showTitle;
      setTxt();
      redraw();
      saveCurrentBha();
    };
  }

  function renderForPrint(ctx, scale) {
    const width = bhaCanvas.width * scale;
    const height = bhaCanvas.height * scale;
    const margin = 20 * scale;
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = '#000';
    ctx.clearRect(0, 0, width, height);
    if (assyObj.showBorder !== false) {
      ctx.strokeRect(0, 0, width, height);
      ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
    }
    if (pdfImg && pdfImg.complete) {
      ctx.drawImage(pdfImg, margin, margin, width - margin * 2, height - margin * 2);
    }

    if (assyObj.showTitle !== false) {
      ctx.font = (24 * scale) + 'px sans-serif';
      ctx.fillStyle = '#000';
      ctx.fillText(assyObj.name, margin + 4 * scale, margin + 24 * scale);
    }

    const active = FIELD_DEFS.filter(d => fields[d.id] && fields[d.id].enabled);
    if (active.length) {
      const tbW = 320 * scale;
      const smallRow = 20 * scale;
      const titleCol = 100 * scale;
      const rowCount = active.reduce((a, d) => a + (d.double ? 2 : 1), 0);
      const tbH = smallRow * rowCount;
      const x = width - margin - tbW;
      const y = height - margin - tbH;
      ctx.strokeRect(x, y, tbW, tbH);

      let curY = y;
      active.forEach(def => {
        const rowH = smallRow * (def.double ? 2 : 1);
        ctx.beginPath();
        ctx.moveTo(x, curY + rowH);
        ctx.lineTo(x + tbW, curY + rowH);
        ctx.moveTo(x + titleCol, curY);
        ctx.lineTo(x + titleCol, curY + rowH);
        ctx.stroke();
        ctx.font = (12 * scale * PRINT_TEXT_SCALE) + 'px sans-serif';
        ctx.fillText(def.label + ':', x + 4 * scale, curY + 14 * scale);
        if (def.double) {
          const lines = String(fields[def.id].value || '').split(/\n/);
          ctx.fillText(lines[0] || '', x + titleCol + 4 * scale, curY + 14 * scale);
          if (lines[1]) ctx.fillText(lines[1], x + titleCol + 4 * scale, curY + 14 * scale + smallRow);
        } else {
          ctx.fillText(fields[def.id].value || '', x + titleCol + 4 * scale, curY + 14 * scale);
        }
        curY += rowH;
      });
    }

    placed.forEach(item => {
      ctx.save();
      ctx.scale(scale, scale);
      drawComponent(ctx, item.comp, item.x, item.y, item.flipped, item.scale || 1);
      ctx.restore();
    });
    dimensions.forEach(d => drawDimension(ctx, d, scale, PRINT_TEXT_SCALE));
    diameters.forEach(d => drawDiameter(ctx, d, scale, PRINT_TEXT_SCALE));
    textBoxes.forEach(t => drawTextBox(ctx, t, scale, PRINT_TEXT_SCALE));
  }

  document.getElementById('printPdfBtn').onclick = () => {
    const now = new Date();
    const stamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    const fileName = (assyObj.name || 'assembly') + '_' + stamp;

    const scale = 4; // roughly 400 DPI for A4
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
    doc.write('<style>@page{size:210mm 297mm;margin:0;}body{margin:0;}img{width:100%;height:auto;}</style>');
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
    const cleanItems = placed.map(p => ({
      comp: p.comp,
      x: p.x,
      y: p.y,
      flipped: !!p.flipped,
      scale: typeof p.scale === 'number' ? p.scale : 1,
      parentIndex: null
    }));
    const idxMap = new Map();
    cleanItems.forEach((_, i) => idxMap.set(placed[i], i));
    cleanItems.forEach((it, i) => {
      const parent = placed[i].attachedTo;
      if (parent && idxMap.has(parent)) it.parentIndex = idxMap.get(parent);
    });

    assyObj.items = cleanItems;
    assyObj.texts = textBoxes.map(t => ({ text: t.text, x: t.x, y: t.y }));
    assyObj.dimensions = dimensions.map(d => ({
      p1: { itemIndex: idxMap.get(d.p1.item), x: d.p1.x, y: d.p1.y },
      p2: { itemIndex: idxMap.get(d.p2.item), x: d.p2.x, y: d.p2.y },
      offset: d.offset || 0,
      label: d.label != null ? d.label : null
    }));
    assyObj.diameters = diameters.map(di => ({
      itemIndex: idxMap.get(di.item),
      y: di.y,
      offset: di.offset || 0,
      style: di.style || 'double'
    }));
    assyObj.fields = fields;
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

async function exportBha(name) {
  const item = localStorage.getItem('bha-' + name);
  if (!item) { alert('BHA not found'); return; }
  let obj;
  try { obj = JSON.parse(item); }
  catch { alert('Failed to export'); return; }
  const data = { name: obj.name, assemblies: obj.assemblies };
  const json = JSON.stringify(data, null, 2);
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: obj.name + '.json',
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
  a.download = obj.name + '.json';
  a.click();
  URL.revokeObjectURL(url);
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
    row.className = 'assy-row';
    row.dataset.index = idx;

    const num = document.createElement('span');
    num.className = 'assy-num';
    num.textContent = (idx + 1) + '.';

    const edit = document.createElement('button');
    edit.className = 'primary edit-btn';
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

    row.appendChild(num);
    row.appendChild(edit);
    row.appendChild(del);
    list.appendChild(row);
  });
}

// ───── Assembly Rendering Utilities ─────
const PREVIEW_DIAMETER_OFFSET = 20;
const PREVIEW_FIELD_DEFS = [
  { id: 'totalLength', label: 'Total L' },
  { id: 'maxOD', label: 'Max OD' },
  { id: 'minID', label: 'Minimum ID' },
  { id: 'fishNeckLength', label: 'Fish neck L' },
  { id: 'fishNeckOD', label: 'Fish neck OD' },
  { id: 'weight', label: 'Weight' },
  { id: 'basket', label: 'Basket' },
  { id: 'date', label: 'Date' },
  { id: 'comments', label: 'Comment', double: true }
];

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return [num >> 16, (num >> 8) & 255, num & 255];
}

function rgbToHex(r, g, b) {
  return (
    '#' + [r, g, b].map(v => {
      const h = v.toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('')
  );
}

function lightenColor(color, p) {
  const [r, g, b] = hexToRgb(color);
  const nr = Math.round(r + (255 - r) * p);
  const ng = Math.round(g + (255 - g) * p);
  const nb = Math.round(b + (255 - b) * p);
  return rgbToHex(nr, ng, nb);
}

function darkenColor(color, p) {
  const [r, g, b] = hexToRgb(color);
  const nr = Math.round(r * (1 - p));
  const ng = Math.round(g * (1 - p));
  const nb = Math.round(b * (1 - p));
  return rgbToHex(nr, ng, nb);
}

function cylinderGradient(ctx, color, x, w) {
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, darkenColor(color, 0.25));
  grad.addColorStop(0.25, lightenColor(color, 0.2));
  grad.addColorStop(0.5, lightenColor(color, 0.4));
  grad.addColorStop(0.75, lightenColor(color, 0.2));
  grad.addColorStop(1, darkenColor(color, 0.25));
  return grad;
}

function partPolygonPoints(p, offX, offY) {
  const x = offX + (p.x || 0);
  const y = offY + (p.y || 0);
  const w = p.width;
  const h = p.height;
  const verts = (p.symVertices || []).slice().sort((a,b)=>a.y-b.y);
  const pts = [];
  pts.push({x, y});
  pts.push({x:x+w, y});
  verts.forEach(v => pts.push({x:x+w+v.dx, y:y+v.y}));
  pts.push({x:x+w, y:y+h});
  pts.push({x, y:y+h});
  for(let i=verts.length-1;i>=0;i--) pts.push({x:x-verts[i].dx, y:y+verts[i].y});
  return pts;
}

function drawPart(ctx, p, offX, offY) {
  const pts = partPolygonPoints(p, offX, offY);
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = cylinderGradient(ctx, p.color || '#ccc', offX + (p.x||0), p.width);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();
}

function drawShapes(ctx, comp, offX, offY) {
  if (!Array.isArray(comp.drawnShapes)) return;
  comp.drawnShapes.forEach(s => {
    ctx.lineWidth = s.width || 2;
    ctx.strokeStyle = '#000';
    ctx.setLineDash([]);
    if (s.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(offX + s.x1, offY + s.y1);
      ctx.lineTo(offX + s.x2, offY + s.y2);
      ctx.stroke();
    } else if (s.type === 'circle') {
      ctx.beginPath();
      ctx.arc(offX + s.cx, offY + s.cy, s.r, 0, Math.PI*2);
      ctx.stroke();
    } else if (s.type === 'curve') {
      ctx.beginPath();
      ctx.moveTo(offX + s.p0.x, offY + s.p0.y);
      ctx.quadraticCurveTo(offX + s.p1.x, offY + s.p1.y, offX + s.p2.x, offY + s.p2.y);
      ctx.stroke();
    }
  });
}

function drawConnector(ctx, part, pos, type) {
  if (!CONNECTOR_TEMPLATE) return;
  const scale = (part.width * 0.8) / CONNECTOR_TEMPLATE.width;
  const w = CONNECTOR_TEMPLATE.width * scale;
  const h = CONNECTOR_TEMPLATE.height * scale;
  const flip = (pos === 'top' && type === 'PIN') || (pos === 'bottom' && type === 'BOX');
  const x0 = part.x + (part.width - w) / 2;
  let y0;
  if (pos === 'top') y0 = type === 'PIN' ? part.y - h : part.y;
  else y0 = type === 'PIN' ? part.y + part.height : part.y + part.height - h;

  ctx.save();
  ctx.translate(x0, y0);
  if (flip) {
    ctx.translate(0, h);
    ctx.scale(scale, -scale);
  } else {
    ctx.scale(scale, scale);
  }

  CONNECTOR_TEMPLATE.parts.forEach((p) => {
    const pts = p.points;
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    const baseColor = type === 'BOX' ? '#b3b3b3' : '#cccccc';
    ctx.fillStyle = cylinderGradient(ctx, baseColor, p.x, p.width);
    if (type === 'BOX') {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fill();
    }
  });

  CONNECTOR_TEMPLATE.lines.forEach((l) => {
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.strokeStyle = type === 'BOX' ? '#555' : '#000';
    ctx.lineWidth = 2;
    if (type === 'BOX') ctx.setLineDash([4, 2]);
    ctx.stroke();
    if (type === 'BOX') ctx.setLineDash([]);
  });

  ctx.restore();
}

function drawComponent(ctx, comp, x, y, flipped, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (flipped) {
    const b = getComponentBounds(comp);
    ctx.translate(b.width / 2, b.height / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-b.width / 2, -b.height / 2);
  }
  comp.parts.forEach(p => drawPart(ctx, p, 0, 0));
  drawShapes(ctx, comp, 0, 0);
  comp.parts.forEach(p => {
    const part = { x: (p.x || 0), y: (p.y || 0), width: p.width, height: p.height };
    if (p.topConnector && p.topConnector !== 'none')
      drawConnector(ctx, part, 'top', p.topConnector);
    if (p.bottomConnector && p.bottomConnector !== 'none')
      drawConnector(ctx, part, 'bottom', p.bottomConnector);
  });
  ctx.restore();
}

function getComponentBounds(comp) {
  if (comp._bounds) return comp._bounds;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  comp.parts.forEach(p => {
    partPolygonPoints(p, 0, 0).forEach(pt => {
      minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
    });
    if (CONNECTOR_TEMPLATE) {
      if (p.topConnector === 'PIN') {
        const scale = (p.width * 0.8) / CONNECTOR_TEMPLATE.width;
        minY = Math.min(minY, p.y - CONNECTOR_TEMPLATE.height * scale);
      }
      if (p.bottomConnector === 'PIN') {
        const scale = (p.width * 0.8) / CONNECTOR_TEMPLATE.width;
        maxY = Math.max(maxY, p.y + p.height + CONNECTOR_TEMPLATE.height * scale);
      }
    }
  });
  (comp.drawnShapes || []).forEach(s => {
    if (s.type === 'line') {
      minX = Math.min(minX, s.x1, s.x2);
      maxX = Math.max(maxX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2);
      maxY = Math.max(maxY, s.y1, s.y2);
    } else if (s.type === 'circle') {
      minX = Math.min(minX, s.cx - s.r);
      maxX = Math.max(maxX, s.cx + s.r);
      minY = Math.min(minY, s.cy - s.r);
      maxY = Math.max(maxY, s.cy + s.r);
    } else if (s.type === 'curve') {
      [s.p0, s.p1, s.p2].forEach(pt => {
        minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
      });
    }
  });
  if (minX === Infinity) { minX = minY = 0; maxX = maxY = 0; }
  comp._bounds = {minX, minY, maxX, maxY, width:maxX-minX, height:maxY-minY};
  return comp._bounds;
}

function localToCanvas(it, lx, ly) {
  const b = getComponentBounds(it.comp);
  if (it.flipped) {
    lx = b.width - lx;
    ly = b.height - ly;
  }
  return { x: it.x + lx * it.scale, y: it.y + ly * it.scale };
}

function drawDimension(ctx, dim, scale = 1, textScale = 1) {
  const p1 = localToCanvas(dim.p1.item, dim.p1.x, dim.p1.y);
  const p2 = localToCanvas(dim.p2.item, dim.p2.x, dim.p2.y);
  const baseX = Math.max(p1.x, p2.x) + 20;
  const x = (baseX + (dim.offset || 0)) * scale;
  const y1 = p1.y * scale;
  const y2 = p2.y * scale;
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const len = Math.abs(bottom - top);
  const label = dim.label !== null && dim.label !== undefined ? dim.label : len.toFixed(0);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(p1.x * scale, p1.y * scale);
  ctx.lineTo(x, p1.y * scale);
  ctx.moveTo(p2.x * scale, p2.y * scale);
  ctx.lineTo(x, p2.y * scale);
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();

  const a = 6 * scale;
  ctx.beginPath();
  ctx.moveTo(x - a, top + a);
  ctx.lineTo(x, top);
  ctx.lineTo(x + a, top + a);
  ctx.moveTo(x - a, bottom - a);
  ctx.lineTo(x, bottom);
  ctx.lineTo(x + a, bottom - a);
  ctx.stroke();

  ctx.fillStyle = '#000';
  ctx.font = (12 * scale * textScale) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, x, top - 4 * scale);
}

function formatTwelfthInches(val) {
  if (typeof val !== 'number' || isNaN(val)) return '';
  const sign = val < 0 ? -1 : 1;
  val = Math.abs(val);
  const whole = Math.floor(val);
  let frac = Math.round((val - whole) * 12);
  if (frac === 12) { frac = 0; return (sign < 0 ? '-' : '') + (whole + 1) + '"'; }
  if (frac === 0) return (sign < 0 ? '-' : '') + whole + '"';
  const g = gcd(frac, 12);
  frac /= g;
  const denom = 12 / g;
  const prefix = sign < 0 ? '-' : '';
  return prefix + (whole ? whole + ' ' : '') + frac + '/' + denom + '"';
}

function gcd(a, b) {
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

function drawDiameter(ctx, dia, scale = 1, textScale = 1) {
  const b = getComponentBounds(dia.item.comp);
  let ly = dia.y;
  if (dia.item.flipped) ly = b.height - ly;
  const y = (dia.item.y + (ly + (dia.offset || 0)) * dia.item.scale) * scale;
  const left = (dia.item.x + b.minX * dia.item.scale) * scale;
  const right = (dia.item.x + b.maxX * dia.item.scale) * scale;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1 * scale;
  const a = 6 * scale;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left + a, y - a);
  ctx.lineTo(left, y);
  ctx.lineTo(left + a, y + a);
  ctx.moveTo(right - a, y - a);
  ctx.lineTo(right, y);
  ctx.lineTo(right - a, y + a);
  ctx.stroke();

  ctx.fillStyle = '#000';
  ctx.font = (12 * scale * textScale) + 'px sans-serif';
  const displayVal = dia.item.comp.od !== undefined ? String(dia.item.comp.od) : '';
  const val = displayVal ? '\u00F8 ' + displayVal : '';
  if (val) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(val, left - PREVIEW_DIAMETER_OFFSET * scale - 4 * scale, y);
  }
}

function drawTextBox(ctx, tb, scale = 1, textScale = 1) {
  ctx.fillStyle = '#000';
  ctx.font = (16 * scale * textScale) + 'px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(tb.text, tb.x * scale, tb.y * scale);
}

function renderAssembly(ctx, assy, scale) {
  const width = 794 * scale;
  const height = 1123 * scale;
  const margin = 20 * scale;
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = '#000';
  ctx.clearRect(0, 0, width, height);
  if (assy.showBorder !== false) {
    ctx.strokeRect(0, 0, width, height);
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
  }
  if (assy.pdfImage) {
    if (!assy._pdfImg) {
      const img = new Image();
      img.src = assy.pdfImage;
      assy._pdfImg = img;
    }
    if (assy._pdfImg.complete) {
      ctx.drawImage(assy._pdfImg, margin, margin, width - margin * 2, height - margin * 2);
    }
  }

  if (assy.showTitle !== false) {
    ctx.font = (24 * scale) + 'px sans-serif';
    ctx.fillStyle = '#000';
    ctx.fillText(assy.name || '', margin + 4 * scale, margin + 24 * scale);
  }

  const fields = assy.fields || {};
  const active = PREVIEW_FIELD_DEFS.filter(d => fields[d.id] && fields[d.id].enabled);
  if (active.length) {
    const tbW = 320 * scale;
    const smallRow = 20 * scale;
    const titleCol = 100 * scale;
    const rowCount = active.reduce((a, d) => a + (d.double ? 2 : 1), 0);
    const tbH = smallRow * rowCount;
    const x = width - margin - tbW;
    const y = height - margin - tbH;
    ctx.strokeRect(x, y, tbW, tbH);

    let curY = y;
    active.forEach(def => {
      const rowH = smallRow * (def.double ? 2 : 1);
      ctx.beginPath();
      ctx.moveTo(x, curY + rowH);
      ctx.lineTo(x + tbW, curY + rowH);
      ctx.moveTo(x + titleCol, curY);
      ctx.lineTo(x + titleCol, curY + rowH);
      ctx.stroke();
      ctx.font = (12 * scale * 1.2) + 'px sans-serif';
      ctx.fillText(def.label + ':', x + 4 * scale, curY + 14 * scale);
      if (def.double) {
        const lines = String(fields[def.id].value || '').split(/\n/);
        ctx.fillText(lines[0] || '', x + titleCol + 4 * scale, curY + 14 * scale);
        if (lines[1]) ctx.fillText(lines[1], x + titleCol + 4 * scale, curY + 14 * scale + smallRow);
      } else {
        ctx.fillText(fields[def.id].value || '', x + titleCol + 4 * scale, curY + 14 * scale);
      }
      curY += rowH;
    });
  }

  const items = (assy.items || []).map(it => ({
    comp: it.comp,
    x: it.x,
    y: it.y,
    flipped: it.flipped || false,
    scale: typeof it.scale === 'number' ? it.scale : 1,
    attachedTo: null,
    attachedChildren: []
  }));
  if (Array.isArray(assy.items)) {
    assy.items.forEach((it, i) => {
      if (typeof it.parentIndex === 'number') {
        const parent = items[it.parentIndex];
        if (parent) {
          items[i].attachedTo = parent;
          parent.attachedChildren.push(items[i]);
        }
      }
    });
  }

  const dimensions = (assy.dimensions || []).map(d => ({
    p1: { item: items[d.p1.itemIndex], x: d.p1.x, y: d.p1.y },
    p2: { item: items[d.p2.itemIndex], x: d.p2.x, y: d.p2.y },
    offset: d.offset || 0,
    label: d.label != null ? d.label : null
  }));
  const diameters = (assy.diameters || []).map(di => ({
    item: items[di.itemIndex],
    y: di.y,
    offset: di.offset || 0,
    style: di.style || 'double'
  }));
  const textBoxes = (assy.texts || []).map(t => ({ text: t.text || '', x: t.x || 0, y: t.y || 0 }));

  items.forEach(item => {
    ctx.save();
    ctx.scale(scale, scale);
    drawComponent(ctx, item.comp, item.x, item.y, item.flipped, item.scale || 1);
    ctx.restore();
  });
  dimensions.forEach(d => drawDimension(ctx, d, scale, 1.2));
  diameters.forEach(d => drawDiameter(ctx, d, scale, 1.2));
  textBoxes.forEach(t => drawTextBox(ctx, t, scale, 1.2));
}

function generateAssemblyImage(assy, scale) {
  const c = document.createElement('canvas');
  c.width = 794 * scale;
  c.height = 1123 * scale;
  renderAssembly(c.getContext('2d'), assy, scale);
  return c.toDataURL('image/png');
}
