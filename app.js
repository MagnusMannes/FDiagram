/* ──────────  View Switching  ────────── */
const mainPage    = document.getElementById('main-page');
const builderPage = document.getElementById('builder-page');
let   currentName      = null;
let   currentAssembly  = [];
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

document.getElementById('newBtn').onclick = async () => {
  const name = prompt('Enter name for new BHA');
  if(!name) return;
  currentName = name.trim();
  currentAssembly = [];
  loadAssembly(currentAssembly);
  saveCurrentBha();
  await backupFile();
  mainPage.hidden    = true;
  builderPage.hidden = false;
};

document.getElementById('historyBtn').onclick = () => {
  const names = getBhaNames();
  if(!names.length){
    alert('No stored BHAs');
    return;
  }
  const choice = prompt('Stored BHAs:\n' + names.join('\n') + '\nEnter name to load:');
  if(!choice) return;
  const item = localStorage.getItem('bha-' + choice.trim());
  if(!item){
    alert('BHA not found');
    return;
  }
  try {
    const obj = JSON.parse(item);
    currentName = obj.name;
    currentAssembly = obj.assembly || [];
    loadAssembly(currentAssembly);
    mainPage.hidden    = true;
    builderPage.hidden = false;
  } catch(e){
    alert('Failed to load BHA');
  }
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
        currentAssembly = data;
        currentName = 'Imported BHA';
      }else{
        currentName = data.name || 'Imported BHA';
        currentAssembly = data.assembly || [];
      }
      loadAssembly(currentAssembly);
      mainPage.hidden    = true;
      builderPage.hidden = false;
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
  if(!currentName) return;
  const data = {name: currentName, assembly: currentAssembly, savedAt: Date.now()};
  localStorage.setItem('bha-' + currentName, JSON.stringify(data));
  const names = getBhaNames();
  if(!names.includes(currentName)){
    names.push(currentName);
    localStorage.setItem('bha-names', JSON.stringify(names));
  }
}

async function backupFile(){
  const data = {name: currentName, assembly: currentAssembly};
  const json = JSON.stringify(data, null, 2);
  if(window.showSaveFilePicker){
    try{
      const handle = await window.showSaveFilePicker({
        suggestedName: currentName + '.json',
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
  a.download = currentName + '.json';
  a.click();
  URL.revokeObjectURL(url);
}
