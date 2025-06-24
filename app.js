/* ──────────  View Switching  ────────── */
const mainPage     = document.getElementById('main-page');
const assemblyPage = document.getElementById('assembly-page');
const loadPage     = document.getElementById('load-page');
const builderPage  = document.getElementById('builder-page');
const assemblyList = document.getElementById('assemblyList');
const loadList     = document.getElementById('loadList');
const assyTitle    = document.getElementById('assyTitle');
const bhaTitle     = document.getElementById('bhaTitle');

let   currentBha         = {name:'', assemblies:[]};
let   currentAssembly    = [];
let   currentAssemblyIdx = 0;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

document.getElementById('newBtn').onclick = async () => {
  const name = prompt('Enter name for new BHA');
  if(!name) return;
  currentBha = {name: name.trim(), assemblies: []};
  saveCurrentBha();
  await backupFile();
  renderAssemblyList();
  mainPage.hidden     = true;
  assemblyPage.hidden = false;
};

document.getElementById('historyBtn').onclick = () => {
  const names = getBhaNames();
  if(!names.length){
    alert('No stored BHAs');
    return;
  }
  loadList.innerHTML = '';
  names.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = name;
    btn.onclick = () => {
      const item = localStorage.getItem('bha-' + name);
      if(!item){ alert('BHA not found'); return; }
      try{
        const obj = JSON.parse(item);
        currentBha = {
          name: obj.name,
          assemblies: obj.assemblies || [obj.assembly || []]
        };
        renderAssemblyList();
        loadPage.hidden     = true;
        assemblyPage.hidden = false;
        mainPage.hidden     = true;
      }catch(e){ alert('Failed to load BHA'); }
    };
    loadList.appendChild(btn);
  });
  mainPage.hidden = true;
  loadPage.hidden = false;
};

document.getElementById('loadBtn').onclick = () =>
  document.getElementById('fileInput').click();

/* ──────────  File Import  ────────── */
document.getElementById('fileInput').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if(Array.isArray(data)){
        currentBha = {name:'Imported BHA', assemblies:[data]};
      }else{
        currentBha = {
          name: data.name || 'Imported BHA',
          assemblies: data.assemblies || [data.assembly || []]
        };
      }
      renderAssemblyList();
      mainPage.hidden     = true;
      assemblyPage.hidden = false;
    } catch(err){ alert('Invalid JSON'); }
  };
  reader.readAsText(file);
};

/* ──────────  Drag-and-Drop Logic  ────────── */
const dropZone = document.getElementById('dropZone');

document.querySelectorAll('.tool-item').forEach(item => {
  item.addEventListener('dragstart', ev => {
    ev.dataTransfer.setData('application/json', item.dataset.tool);
  });
});

dropZone.addEventListener('drop', ev => {
  ev.preventDefault();
  const json = ev.dataTransfer.getData('application/json');
  if (!json) return;
  const tool = JSON.parse(json);
  currentAssembly.push(tool);
  currentBha.assemblies[currentAssemblyIdx] = currentAssembly;
  addComponent(tool);
  saveCurrentBha();
});

/*  Helper: create a visual block in the assembly  */
function addComponent(tool){
  const div = document.createElement('div');
  div.className = 'bha-component';
  div.innerHTML = `
    <span>${tool.name}</span>
    <span class="dim">${tool.od}&quot; · ${tool.length} ft</span>
  `;
  dropZone.appendChild(div);
}

/*  Helper: rebuild the assembly from imported JSON list  */
function loadAssembly(arr){
  currentAssembly = Array.isArray(arr) ? [...arr] : [];
  dropZone.querySelectorAll('.bha-component').forEach(el => el.remove());
  currentAssembly.forEach(addComponent);
}

function getBhaNames(){
  let list;
  try{ list = JSON.parse(localStorage.getItem('bha-names') || '[]'); }
  catch{ list = []; }
  list = list.filter(name => {
    const item = localStorage.getItem('bha-' + name);
    if(!item) return false;
    try{
      const obj = JSON.parse(item);
      if(Date.now() - obj.savedAt > MONTH_MS){
        localStorage.removeItem('bha-' + name);
        return false;
      }
      return true;
    }catch{
      localStorage.removeItem('bha-' + name);
      return false;
    }
  });
  localStorage.setItem('bha-names', JSON.stringify(list));
  return list;
}

function saveCurrentBha(){
  if(!currentBha.name) return;
  const data = {name: currentBha.name, assemblies: currentBha.assemblies, savedAt: Date.now()};
  localStorage.setItem('bha-' + currentBha.name, JSON.stringify(data));
  const names = getBhaNames();
  if(!names.includes(currentBha.name)){
    names.push(currentBha.name);
    localStorage.setItem('bha-names', JSON.stringify(names));
  }
}

async function backupFile(){
  const data = {name: currentBha.name, assemblies: currentBha.assemblies};
  const json = JSON.stringify(data, null, 2);
  if(window.showSaveFilePicker){
    try{
      const handle = await window.showSaveFilePicker({
        suggestedName: currentBha.name + '.json',
        types:[{description:'JSON', accept:{'application/json':['.json']}}]
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    }catch(e){}
  }
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentBha.name + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

/* ──────────  Assembly Menu Helpers  ────────── */
function renderAssemblyList(){
  bhaTitle.textContent = currentBha.name;
  assemblyList.innerHTML = '';
  currentBha.assemblies.forEach((assy, idx) => {
    const row  = document.createElement('div');
    const edit = document.createElement('button');
    edit.className = 'primary';
    edit.textContent = 'Assy ' + (idx + 1);
    edit.onclick = () => {
      currentAssemblyIdx = idx;
      loadAssembly(assy);
      assyTitle.textContent = 'Assy ' + (idx + 1);
      assemblyPage.hidden = true;
      builderPage.hidden  = false;
    };
    const del  = document.createElement('button');
    del.className = 'secondary';
    del.textContent = 'Delete';
    del.onclick = () => {
      currentBha.assemblies.splice(idx,1);
      renderAssemblyList();
      saveCurrentBha();
    };
    row.appendChild(edit);
    row.appendChild(del);
    assemblyList.appendChild(row);
  });
}

document.getElementById('addAssyBtn').onclick = () => {
  currentAssemblyIdx = currentBha.assemblies.length;
  currentAssembly = [];
  loadAssembly(currentAssembly);
  assyTitle.textContent = 'Assy ' + (currentAssemblyIdx + 1);
  assemblyPage.hidden = true;
  builderPage.hidden  = false;
};

document.getElementById('backAssyBtn').onclick = () => {
  currentBha.assemblies[currentAssemblyIdx] = [...currentAssembly];
  saveCurrentBha();
  renderAssemblyList();
  builderPage.hidden  = true;
  assemblyPage.hidden = false;
};

document.getElementById('backMainBtn').onclick = () => {
  assemblyPage.hidden = true;
  mainPage.hidden     = false;
};

document.getElementById('loadBackBtn').onclick = () => {
  loadPage.hidden = true;
  mainPage.hidden = false;
};
