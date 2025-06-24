// Page-based BHA tool logic
let currentBha = { name: '', assemblies: [] };
let currentAssembly = [];
let currentAssemblyIdx = 0;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

let CONNECTOR_TEMPLATE = null;

// load thread template used for PIN/BOX connectors
fetch('fdrawingv1/threads.json')
  .then(r => r.json())
  .then(d => {
    CONNECTOR_TEMPLATE = preprocessConnectorTemplate(d);
    if (typeof redraw === 'function') redraw();
  })
  .catch(() => {});

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
    const comp = normalizeComponent(JSON.parse(json));
    placed.push({ comp, x: ev.offsetX, y: ev.offsetY });
    redraw();
  });

  let dragObj = null;
  let dragOffX = 0;
  let dragOffY = 0;

  bhaCanvas.addEventListener('mousedown', e => {
    const rect = bhaCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (let i = placed.length - 1; i >= 0; i--) {
      const it = placed[i];
      const b = getComponentBounds(it.comp);
      if (x >= it.x + b.minX && x <= it.x + b.maxX &&
          y >= it.y + b.minY && y <= it.y + b.maxY) {
        dragObj = it;
        dragOffX = x - it.x;
        dragOffY = y - it.y;
        placed.splice(i, 1);
        placed.push(it);
        redraw();
        break;
      }
    }
  });

  window.addEventListener('mousemove', e => {
    if (!dragObj) return;
    const rect = bhaCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragObj.x = x - dragOffX;
    dragObj.y = y - dragOffY;
    redraw();
  });

  window.addEventListener('mouseup', () => {
    if (!dragObj) return;
    const b = getComponentBounds(dragObj.comp);
    if (dragObj.x + b.maxX < 0 || dragObj.x + b.minX > bhaCanvas.width ||
        dragObj.y + b.maxY < 0 || dragObj.y + b.minY > bhaCanvas.height) {
      placed = placed.filter(p => p !== dragObj);
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

  function drawConnector(part, pos, type) {
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
      ctx.fillStyle = type === 'BOX' ? '#b3b3b3' : '#cccccc';
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

  function drawPart(p, offX, offY) {
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

  function drawShapes(comp, offX, offY) {
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

  function drawComponent(comp, x, y) {
    comp.parts.forEach(p => drawPart(p, x, y));
    drawShapes(comp, x, y);
    comp.parts.forEach(p => {
      const part = { x: x + (p.x || 0), y: y + (p.y || 0), width: p.width, height: p.height };
      if (p.topConnector && p.topConnector !== 'none')
        drawConnector(part, 'top', p.topConnector);
      if (p.bottomConnector && p.bottomConnector !== 'none')
        drawConnector(part, 'bottom', p.bottomConnector);
    });
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
      ctx.save();
      ctx.scale(scale, scale);
      drawComponent(item.comp, item.x, item.y);
      ctx.restore();
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
