// Extracted application logic
// Dynamic datasets: state stores dataset data under state[<datasetName>]
var state = { active:'weapons', dirty:{}, selected:{}, palette:[], filters:{ category:'', flags:[] }, _datasets:[], collapsed:{}, rightTab:'attachments', pending:{ items:[] } };
// Helper to build endpoints for dynamic datasets
function endpoint(kind){ return '/api/'+kind; }

function markDirty(kind){ state.dirty[kind]=true; updateDirtyIndicator(); }
function updateDirtyIndicator(){ var el=document.getElementById('dataset-dirty-indicator'); var arr=[]; for(var k in state.dirty){ if(state.dirty[k]) arr.push(k); } el.textContent = arr.length? 'Alterações não salvas: '+arr.join(', '):''; }

function load(kind){ return axios.get(endpoint(kind)).then(function(r){ state[kind]=r.data; state.dirty[kind]=false; if(!(kind in state.selected)) state.selected[kind]=null; }); }
function refreshAll(){
  return axios.get('/api/datasets').then(function(res){
    var list = Array.isArray(res.data)? res.data:[];
    state._datasets = list;
    // Load all datasets in parallel
    return Promise.all(list.map(function(k){ return load(k); }));
  }).then(function(){
    // Load pending store
    return axios.get('/api/pending').then(function(r){ state.pending = r.data || {items:[]}; }).catch(function(){ state.pending={items:[]}; });
  }).then(function(){
    // Ensure there is an active dataset selected
    if(!state.active || state._datasets.indexOf(state.active)===-1){
      state.active = (state._datasets.indexOf('weapons')!==-1) ? 'weapons' : (state._datasets[0] || '');
    }
    renderDatasetChips(); renderCategoryChips(); renderFlagsChips(); buildPalette(); renderPending(); renderRightTab(); renderNav(); renderEditor(); updateDirtyIndicator(); applyTheme('dark');
  }).catch(function(err){ console.error('Falha ao carregar datasets', err); });
}

function setActive(tab){ state.active=tab; state.filters={ category:'', flags:[] }; renderDatasetChips(); renderCategoryChips(); renderFlagsChips(); renderNav(); renderEditor(); buildPalette(); }

function renderNav(){
  var kind=state.active; var host=document.getElementById('nav-pane'); var search=document.getElementById('search').value.trim().toLowerCase(); var html=''; var filterCat = state.filters.category; var sel=state.selected[kind];
  function renderOneDataset(dsName){ var data=state[dsName]; if(!data) return; var cats=data.Categories||{}; Object.keys(cats).forEach(function(cat){ if(filterCat && kind!=="_all" && cat!==filterCat) return; var isColl = !!(state.collapsed[dsName] && state.collapsed[dsName][cat]); var headerLabel = (kind==='_all'? (dsName+' · '+cat):cat); html+='<div class="nav-category relative border border-gray-600 bg-gray-800 rounded px-2 py-1 droppable" data-drop-type="category" data-category="'+cat+'" data-kind="'+dsName+'">'+
        '<div class="absolute left-2 inset-y-0 flex items-center gap-2">'+
          '<button class="text-gray-400 hover:text-gray-200" title="Expandir/Colapsar" data-action="toggle-category" data-category="'+cat+'" data-kind="'+dsName+'">'+
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 transform transition-transform '+(isColl?'rotate-180':'')+'">'+
              '<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.085l3.71-3.855a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z" clip-rule="evenodd" />'+
            '</svg>'+
          '</button>'+
          '<button class="p-0.5 rounded hover:bg-gray-700" title="Excluir categoria" data-action="remove-category" data-category="'+cat+'" data-kind="'+dsName+'">'+
            '<img src="/img/delete.png?v=1" alt="delete" class="w-4 h-4 opacity-90 hover:opacity-100" />'+
          '</button>'+
        '</div>'+
        '<div class="text-center text-gray-200 font-semibold tracking-wide"><button class="hover:underline" data-action="rename-category" data-category="'+cat+'" data-kind="'+dsName+'">'+headerLabel+'</button></div>'+
      '</div>'; var items=cats[cat]; if(isColl) return; Object.keys(items).forEach(function(cls){ if(search && cls.toLowerCase().indexOf(search)===-1) return; var item=items[cls]||{}; if(state.filters.flags.length){ var f=item.flags||[]; var ok=false; for(var i=0;i<state.filters.flags.length;i++){ if(f.indexOf(state.filters.flags[i])!==-1){ ok=true; break; } } if(!ok) return; } var isActive = false; if(kind==='_all'){ isActive = sel && sel.dataset===dsName && sel.category===cat && sel.classname===cls; } else { isActive = sel && sel.category===cat && sel.classname===cls; } var variants = Array.isArray(item.variants)? item.variants:[]; html+='<div class="nav-item '+(isActive?'active':'')+'" draggable="true" data-action="select-item" data-category="'+cat+'" data-classname="'+cls+'" data-kind="'+dsName+'">'+
      '<span>'+cls+'</span>'+
      (variants.length? ('<select class="variant-select text-xs border rounded px-1 py-0.5" data-category="'+cat+'" data-classname="'+cls+'" data-kind="'+dsName+'"><option value="">variante...</option>'+variants.map(function(v){return '<option value="'+v+'">'+v+'</option>';}).join('')+'</select>') : '')+
      ((isActive && state.dirty[dsName])?'<span class="dirty-dot"></span>':'')+
      '</div>'; }); }); }
  if(kind==='_all'){
    state._datasets.forEach(function(ds){ renderOneDataset(ds); });
  } else {
    var data=state[kind]; if(!data){ host.innerHTML='<p class="p-3 text-xs text-gray-500">Carregando...</p>'; return; }
    renderOneDataset(kind);
  }
  host.innerHTML = html || '<p class="p-3 text-xs text-gray-500">Sem itens.</p>';
}

function getSelected(){ var k=state.active; var sel=state.selected[k]; if(!sel) return null; if(k==='_all'){ return sel; } return { dataset:k, category:sel.category, classname:sel.classname }; }

function renderEditor(){ var pane=document.getElementById('editor-pane'); var sel=getSelected(); var kindActual = sel? sel.dataset : state.active; if(state.active==='_all' && !sel){ pane.innerHTML='<p class="text-sm text-gray-500">Selecione um item à esquerda.</p>'; return; } if(!state[kindActual]){ pane.innerHTML='<p class="text-sm text-gray-500">Carregando...</p>'; return; } if(!sel){ pane.innerHTML='<p class="text-sm text-gray-500">Selecione um item à esquerda.</p>'; return; } var category=sel.category, classname=sel.classname; var item = state[kindActual].Categories[category][classname]; if(!item){ pane.innerHTML='<p class="text-sm text-red-500">Item não encontrado.</p>'; return; }
  var isWeapon = kindActual==='weapons';
  function numInput(label, field, val){ return '<div><label class="editor-label">'+label+'</label><input data-field="'+field+'" type="number" value="'+(val==null?'':val)+'" class="mt-1 w-full border rounded px-2 py-1" /></div>'; }
  function textInput(label, field, val){ return '<div><label class="editor-label">'+label+'</label><input data-field="'+field+'" type="text" value="'+(val==null?'':val)+'" class="mt-1 w-full border rounded px-2 py-1" /></div>'; }
  function arrayEditor(label, field, arr){ arr = Array.isArray(arr)?arr:[]; var inner=''; for(var i=0;i<arr.length;i++){ inner+='<span class="pill" data-index="'+i+'" data-field="'+field+'">'+arr[i]+'<button data-action="remove-pill">×</button></span>'; } return '<div data-array-field="'+field+'"><label class="editor-label flex items-center justify-between">'+label+'<button data-action="add-pill" data-field="'+field+'" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button></label><div class="mt-1">'+inner+'</div></div>'; }
  function attachmentsEditor(){ if(isWeapon){ var att=(item.attachments && typeof item.attachments==='object')? item.attachments : {}; var html='<div data-field="attachments"><label class="editor-label flex items-center justify-between">Attachments <button data-action="add-attachment-slot" class="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded">+ Slot</button></label><div class="mt-2 space-y-2">'; Object.keys(att).forEach(function(slot){ var list=att[slot]||[]; html+='<div class="border rounded p-2 droppable" data-drop-type="attachment" data-slot="'+slot+'"><div class="flex items-center justify-between mb-1"><strong class="text-xs">'+slot+'</strong><div class="space-x-1"><button data-action="add-nested-pill" data-slot="'+slot+'" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button><button data-action="remove-attachment-slot" data-slot="'+slot+'" class="text-xs bg-red-500 text-white px-2 py-0.5 rounded">x</button></div></div>'; for(var i=0;i<list.length;i++){ html+='<span class="pill" data-index="'+i+'" data-slot="'+slot+'" data-field="attachments" data-nested="1">'+list[i]+'<button data-action="remove-pill">×</button></span>'; } html+='</div>'; }); html+='</div></div>'; return html; } else { var arr = Array.isArray(item.attachments)? item.attachments:[]; var inner=''; for(var i=0;i<arr.length;i++){ inner+='<span class="pill" data-index="'+i+'" data-field="attachments">'+arr[i]+'<button data-action="remove-pill">×</button></span>'; } return '<div data-array-field="attachments" class="droppable" data-drop-type="attachment"><label class="editor-label flex items-center justify-between">Attachments<button data-action="add-pill" data-field="attachments" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button></label><div class="mt-1">'+inner+'</div></div>'; } }
  var parts=[]; parts.push(textInput('Classname','_classname', classname)); parts.push(numInput('Tier','tier', item.tier)); parts.push(numInput('Value','value', item.value)); if(isWeapon){ parts.push(numInput('Chamber Size','chamber_size', item.chamber_size)); parts.push(arrayEditor('Ammo Types','ammo_types', item.ammo_types)); parts.push(arrayEditor('Magazines','magazines', item.magazines)); }
  parts.push(arrayEditor('Variants','variants', item.variants)); parts.push(attachmentsEditor()); parts.push(arrayEditor('Flags','flags', item.flags));
  pane.innerHTML = '<div class="editor-box space-y-4" data-kind="'+kindActual+'" data-category="'+category+'" data-classname="'+classname+'">'+parts.join('')+'</div>';
}

function buildPalette(){ var all={}; if(state.active==='_all'){
  state._datasets.forEach(function(dsName){ var ds = state[dsName]; if(ds && ds.Categories){ Object.values(ds.Categories).forEach(function(items){ Object.values(items).forEach(function(it){ if(dsName==='weapons'){ var att=it.attachments; if(att && typeof att==='object'){ Object.values(att).forEach(function(arr){ (arr||[]).forEach(function(v){ all[v]=true; }); }); } } else { (it.attachments||[]).forEach(function(v){ all[v]=true; }); } }); }); } });
} else {
  var ds = state[state.active]; if(ds && ds.Categories){ Object.values(ds.Categories).forEach(function(items){ Object.values(items).forEach(function(it){ if(state.active==='weapons'){ var att=it.attachments; if(att && typeof att==='object'){ Object.values(att).forEach(function(arr){ (arr||[]).forEach(function(v){ all[v]=true; }); }); } } else { (it.attachments||[]).forEach(function(v){ all[v]=true; }); } }); }); }
}
 var list=Object.keys(all).sort(); state.palette=list; var filter=document.getElementById('palette-filter').value.trim().toLowerCase(); var html=''; list.forEach(function(p){ if(filter && p.toLowerCase().indexOf(filter)===-1) return; html+='<div class="palette-item" draggable="true" data-action="palette-add" data-value="'+p+'"><span>'+p+'</span><span class="text-gray-400 text-xs">+</span></div>'; }); document.getElementById('palette-list').innerHTML= html || '<p class="text-xs text-gray-500">Nenhum attachment.</p>'; document.getElementById('palette-count').textContent=list.length+' itens'; }

document.addEventListener('click', function(e){ var el=e.target.closest('button, .nav-item, .palette-item, .chip, select.variant-select, #btn-pending-add, #modal-close, #modal-cancel, #modal-apply, #btn-toggle-pending'); if(!el) return; var action=el.dataset.action; var kind=state.active;
  if(el.classList.contains('chip')){ if(el.dataset.type==='category'){ state.filters.category = (state.filters.category===el.dataset.category? '' : el.dataset.category); renderCategoryChips(); renderNav(); } else if(el.dataset.type==='flag'){ var flag=el.dataset.flag; var idx=state.filters.flags.indexOf(flag); if(idx===-1) state.filters.flags.push(flag); else state.filters.flags.splice(idx,1); renderFlagsChips(); renderNav(); } else if(el.dataset.type==='dataset'){ setActive(el.dataset.dataset); } return; }
  if(el.id==='btn-toggle-pending'){ state.rightTab = (state.rightTab==='attachments'?'pending':'attachments'); renderRightTab(); return; }
  if(el.id==='btn-pending-add'){ openPendingModal(); return; }
  if(el.id==='modal-close' || el.id==='modal-cancel'){ closePendingModal(); return; }
  if(el.id==='modal-apply'){ var txt=document.getElementById('modal-text').value||''; var lines = txt.split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean); if(!lines.length){ closePendingModal(); return; } var set = {}; (state.pending.items||[]).forEach(function(it){ var n=(typeof it==='string')? it : it.name; set[n]=true; }); lines.forEach(function(n){ set[n]=true; }); state.pending.items = Object.keys(set).sort().map(function(n){ return {name:n}; }); savePending(true); closePendingModal(); renderPending(); renderRightTab(); return; }
  if(action==='toggle-category'){ var dsT = el.dataset.kind || state.active; var catT = el.dataset.category; if(!state.collapsed[dsT]) state.collapsed[dsT]={}; state.collapsed[dsT][catT] = !state.collapsed[dsT][catT]; renderNav(); return; }
  if(action==='rename-category'){ var dsK = el.dataset.kind || state.active; var old = el.dataset.category; var data = state[dsK]; if(!data || !data.Categories || !data.Categories[old]) return; var nn = prompt('Renomear categoria:', old); if(!nn || nn===old) return; if(data.Categories[nn]){ alert('Categoria já existe.'); return; } data.Categories[nn]=data.Categories[old]; delete data.Categories[old]; if(state.collapsed[dsK] && state.collapsed[dsK][old]!=null){ state.collapsed[dsK][nn]=state.collapsed[dsK][old]; delete state.collapsed[dsK][old]; } if(state.filters.category===old) state.filters.category=nn; markDirty(dsK); renderCategoryChips(); renderNav(); return; }
  if(el.matches('select.variant-select')){ var cat=el.dataset.category; var cls=el.dataset.classname; var ds=el.dataset.kind || state.active; var v=el.value; if(v){ promoteVariant(ds, cat, cls, v); el.value=''; } return; }
  if(action==='select-item'){ var ds2=el.dataset.kind || kind; if(kind==='_all'){ state.selected['_all']={ dataset:ds2, category:el.dataset.category, classname:el.dataset.classname }; } else { state.selected[kind]={ category:el.dataset.category, classname:el.dataset.classname }; } state.rightTab='attachments'; renderRightTab(); renderNav(); renderEditor(); return; }
  if(action==='remove-category'){ var cat=el.dataset.category; var dsKey = el.dataset.kind || state.active; if(confirm('Remover categoria '+cat+'?')){ delete state[dsKey].Categories[cat]; if(state.collapsed[dsKey]){ delete state.collapsed[dsKey][cat]; } markDirty(dsKey); if(state.active==='_all'){ if(state.selected['_all'] && state.selected['_all'].dataset===dsKey && state.selected['_all'].category===cat) state.selected['_all']=null; } else { if(state.selected[dsKey] && state.selected[dsKey].category===cat) state.selected[dsKey]=null; } renderNav(); renderEditor(); renderCategoryChips(); } return; }
  if(action==='add-pill'){ var field=el.dataset.field; addArrayValue(field); return; }
  if(action==='remove-pill'){ removeArrayValue(el); return; }
  if(action==='add-attachment-slot'){ var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; var name=prompt('Nome do slot:'); if(!name) return; if(!item.attachments || typeof item.attachments!=='object') item.attachments={}; if(!item.attachments[name]) item.attachments[name]=[]; markDirty(ds); renderEditor(); buildPalette(); return; }
  if(action==='add-nested-pill'){ var slot=el.dataset.slot; var val=prompt('Novo attachment:'); if(!val) return; var sel2=getSelected(); if(!sel2) return; var ds2=sel2.dataset; var item2=state[ds2].Categories[sel2.category][sel2.classname]; item2.attachments[slot].push(val.trim()); markDirty(ds2); renderEditor(); buildPalette(); return; }
  if(action==='remove-attachment-slot'){ var slot2=el.dataset.slot; var sel3=getSelected(); if(!sel3) return; var ds3=sel3.dataset; var item3=state[ds3].Categories[sel3.category][sel3.classname]; delete item3.attachments[slot2]; markDirty(ds3); renderEditor(); buildPalette(); return; }
  if(action==='palette-add'){ paletteAdd(el.dataset.value); return; }
  if(action==='pending-remove'){ var idx=parseInt(el.dataset.index,10); state.pending.items.splice(idx,1); savePending(true); renderPending(); return; }
  if(action==='pending-find-variants'){ var name=el.dataset.name; findAndFocusVariant(name); return; }
});

// Drag & Drop
document.addEventListener('dragstart', function(e){ var p=e.target.closest('.palette-item'); if(p && p.dataset.value){ e.dataTransfer.setData('text/attachment', p.dataset.value); e.dataTransfer.effectAllowed='copy'; }
  var n=e.target.closest('.nav-item'); if(n){ e.dataTransfer.setData('text/move-item', JSON.stringify({dataset:n.dataset.kind || state.active, category:n.dataset.category, classname:n.dataset.classname})); e.dataTransfer.effectAllowed='move'; }
  var pend=e.target.closest('.pending-item'); if(pend){ e.dataTransfer.setData('text/pending', JSON.stringify({ name: pend.dataset.name })); e.dataTransfer.effectAllowed='copy'; }
});
document.addEventListener('dragover', function(e){ var t=e.target.closest('[data-drop-type]'); if(!t) return; var type=t.dataset.dropType; var types = (e.dataTransfer && e.dataTransfer.types)? Array.from(e.dataTransfer.types):[]; if(type==='attachment' && types.indexOf('text/attachment')!==-1){ e.preventDefault(); t.classList.add('drag-over'); }
  if(type==='category' && (types.indexOf('text/move-item')!==-1 || types.indexOf('text/pending')!==-1)){ e.preventDefault(); t.classList.add('drag-over'); }
});
document.addEventListener('dragleave', function(e){ var t=e.target.closest('[data-drop-type]'); if(!t) return; t.classList.remove('drag-over'); });
document.addEventListener('drop', function(e){ var t=e.target.closest('[data-drop-type]'); if(!t) return; var type=t.dataset.dropType; if(type==='attachment' && e.dataTransfer.getData('text/attachment')){ e.preventDefault(); t.classList.remove('drag-over'); var val=e.dataTransfer.getData('text/attachment'); var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; if(ds==='weapons'){ var slot=t.dataset.slot; if(!slot){ slot=prompt('Slot destino:'); if(!slot) return; } if(!item.attachments||typeof item.attachments!=='object') item.attachments={}; if(!item.attachments[slot]) item.attachments[slot]=[]; if(item.attachments[slot].indexOf(val)===-1) item.attachments[slot].push(val); } else { if(!Array.isArray(item.attachments)) item.attachments=[]; if(item.attachments.indexOf(val)===-1) item.attachments.push(val); } markDirty(ds); renderEditor(); buildPalette(); }
  if(type==='category'){
    if(e.dataTransfer.getData('text/move-item')){ e.preventDefault(); t.classList.remove('drag-over'); var info=JSON.parse(e.dataTransfer.getData('text/move-item')); var targetCat=t.dataset.category; var targetDs=t.dataset.kind || info.dataset || state.active; moveItemToCategory(targetDs, info.category, info.classname, targetCat); return; }
    if(e.dataTransfer.getData('text/pending')){ e.preventDefault(); t.classList.remove('drag-over'); var pinfo=JSON.parse(e.dataTransfer.getData('text/pending')); var targetCat2=t.dataset.category; var targetDs2=t.dataset.kind || state.active; createItemFromPending(pinfo.name, targetCat2, targetDs2); return; }
  }
});

function addArrayValue(field){ var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; var val=prompt('Novo valor:'); if(!val) return; if(field==='attachments' && ds==='weapons'){ alert('Use slots para armas.'); return; } if(!Array.isArray(item[field])) item[field]=[]; if(item[field].indexOf(val.trim())===-1) item[field].push(val.trim()); markDirty(ds); renderEditor(); buildPalette(); }
function removeArrayValue(el){ var pill=el.closest('.pill'); var index=parseInt(pill.dataset.index,10); var field=pill.dataset.field; var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; if(field==='attachments' && ds==='weapons' && pill.dataset.nested){ var slot=pill.dataset.slot; item.attachments[slot].splice(index,1); } else { item[field].splice(index,1); } markDirty(ds); renderEditor(); buildPalette(); }
function paletteAdd(value){ var sel=getSelected(); if(!sel) return alert('Selecione um item.'); var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; if(ds==='weapons'){ var slot=prompt('Slot destino:'); if(!slot) return; if(!item.attachments || typeof item.attachments!=='object') item.attachments={}; if(!item.attachments[slot]) item.attachments[slot]=[]; if(item.attachments[slot].indexOf(value)===-1) item.attachments[slot].push(value); } else { if(!Array.isArray(item.attachments)) item.attachments=[]; if(item.attachments.indexOf(value)===-1) item.attachments.push(value); } markDirty(ds); renderEditor(); buildPalette(); }

document.addEventListener('blur', function(e){ var input=e.target; if(!input.matches('[data-field]')) return; var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var category=sel.category, oldClass=sel.classname; var item=state[ds].Categories[category][oldClass]; var field=input.dataset.field; if(field==='_classname'){ var newName=input.value.trim(); if(newName && newName!==oldClass){ if(state[ds].Categories[category][newName]){ alert('Classname já existe.'); input.value=oldClass; return; } state[ds].Categories[category][newName]=item; delete state[ds].Categories[category][oldClass]; if(state.active==='_all'){ state.selected['_all']={ dataset:ds, category:category, classname:newName }; } else { state.selected[ds]={category:category, classname:newName}; }
      }
    } else { if(input.type==='number'){ var num = input.value===''?null:Number(input.value); item[field]= (isNaN(num)? null : num); } else { item[field]=input.value; } }
  markDirty(ds); renderNav(); }, true);

document.getElementById('btn-add-item').addEventListener('click', function(){ var ds = state.active==='_all' ? (prompt('Dataset destino ('+state._datasets.join(', ')+'):', (state._datasets.indexOf('weapons')!==-1?'weapons':state._datasets[0]||''))||'').trim().toLowerCase() : state.active; if(!ds || !state[ds]) return; var data=state[ds]; var category=prompt('Categoria:'); if(!category) return; var classname=prompt('Classname:'); if(!classname) return; if(!data.Categories[category]) data.Categories[category]={}; if(data.Categories[category][classname]) return alert('Já existe.'); var base = ds==='weapons'? { tier:null,value:null,ammo_types:[],chamber_size:1,magazines:[],variants:[],attachments:{},flags:[] } : { tier:null,value:null,variants:[],attachments:[],flags:[] }; data.Categories[category][classname]=base; if(state.active==='_all'){ state.selected['_all']={ dataset:ds, category:category, classname:classname }; } else { state.selected[ds]={category:category, classname:classname}; } markDirty(ds); renderNav(); renderEditor(); });
document.getElementById('btn-add-category').addEventListener('click', function(){
  // Repurpose: create a NEW dataset (.json) instead of a category
  createDatasetFlow();
});
// Top bar: + Novo .json
var btnAddDs = document.getElementById('btn-add-dataset');
if(btnAddDs){
  btnAddDs.addEventListener('click', function(){ createDatasetFlow(); });
}
document.getElementById('search').addEventListener('input', function(){ renderNav(); });
document.getElementById('palette-filter').addEventListener('input', function(){ buildPalette(); });
// Right pane tabs and pending modal
function renderRightTab(){ var att=document.getElementById('attachments-pane'); var pend=document.getElementById('pending-pane'); var addBtn=document.getElementById('btn-pending-add'); var title=document.getElementById('palette-title'); if(state.rightTab==='attachments'){ att.classList.remove('hidden'); pend.classList.add('hidden'); if(addBtn) addBtn.classList.add('hidden'); if(title) title.textContent='Attachments'; } else { att.classList.add('hidden'); pend.classList.remove('hidden'); if(addBtn) addBtn.classList.remove('hidden'); if(title) title.textContent='Pendentes'; } }
function renderPending(){ var host=document.getElementById('pending-list'); if(!host) return; var html=''; (state.pending.items||[]).forEach(function(it, idx){ var name = (typeof it==='string')? it : it.name; html+='<div class="pending-item palette-item" draggable="true" data-name="'+name+'"><span>'+name+'</span><div class="flex items-center gap-1"><button class="text-xs" data-action="pending-find-variants" data-name="'+name+'">🔎</button><button class="text-xs" data-action="pending-remove" data-index="'+idx+'">🗑️</button></div></div>'; }); host.innerHTML = html || '<p class="text-xs text-gray-500">Sem pendências.</p>'; }
function openPendingModal(){ document.getElementById('modal-text').value=''; document.getElementById('modal-overlay').classList.remove('hidden'); document.getElementById('modal-overlay').classList.add('flex'); }
function closePendingModal(){ var m=document.getElementById('modal-overlay'); m.classList.add('hidden'); m.classList.remove('flex'); }
function savePending(silent){ return axios.put('/api/pending', { items: state.pending.items }).then(function(){ if(!silent) alert('Pendentes salvos'); }).catch(function(){ if(!silent) alert('Erro salvando pendentes'); }); }
function findAndFocusVariant(name){ // simple search by exact classname across datasets
  for(var i=0;i<state._datasets.length;i++){ var ds=state._datasets[i]; var data=state[ds]; if(!data||!data.Categories) continue; var cats=data.Categories; var keys=Object.keys(cats); for(var j=0;j<keys.length;j++){ var cat=keys[j]; var items=cats[cat]; if(items[name]){ state.active = ds; state.selected[ds] = { category: cat, classname: name }; renderDatasetChips(); renderCategoryChips(); renderNav(); renderEditor(); return; } // check variants
        var inames=Object.keys(items);
        for(var k=0;k<inames.length;k++){ var cls=inames[k]; var item=items[cls]; var vars = Array.isArray(item.variants)? item.variants:[]; if(vars.indexOf(name)!==-1){ state.active = ds; state.selected[ds] = { category: cat, classname: cls }; renderDatasetChips(); renderCategoryChips(); renderNav(); renderEditor(); return; } }
      }
    }
  alert('Não encontrado: '+name);
}
function createItemFromPending(name, targetCategory, targetDataset){ var ds = targetDataset || (state.active==='_all'? (prompt('Dataset destino ('+state._datasets.join(', ')+'):', (state._datasets.indexOf('weapons')!==-1?'weapons':state._datasets[0]||''))||'').trim().toLowerCase() : state.active); if(!ds||!state[ds]) return; var data=state[ds]; if(!data.Categories[targetCategory]) data.Categories[targetCategory]={}; if(data.Categories[targetCategory][name]){ alert('Já existe um item '+name+' em '+targetCategory); return; }
  var base = ds==='weapons'? { tier:null,value:null,ammo_types:[],chamber_size:1,magazines:[],variants:[],attachments:{},flags:[] } : { tier:null,value:null,variants:[],attachments:[],flags:[] };
  data.Categories[targetCategory][name]=base; markDirty(ds); renderNav(); renderEditor(); // remove from pending list
  var idx = (state.pending.items||[]).findIndex(function(it){ return (typeof it==='string'?it:it.name)===name; }); if(idx!==-1){ state.pending.items.splice(idx,1); savePending(true); renderPending(); }
}
// dataset chips click handled via document click
document.getElementById('btn-refresh').addEventListener('click', refreshAll);
document.getElementById('btn-save-active').addEventListener('click', function(){
  if(state.active==='_all'){
    var list = state._datasets.slice();
    var chain = Promise.resolve();
    list.forEach(function(k){ chain = chain.then(function(){ return save(k); }); });
    chain.then(function(){ alert('Salvo'); });
  } else {
    save(state.active);
  }
});
document.getElementById('btn-save-all').addEventListener('click', function(){
  var list = state._datasets.slice();
  var chain = Promise.resolve();
  list.forEach(function(k){ chain = chain.then(function(){ return save(k); }); });
  chain.then(function(){ alert('Salvo'); });
});
// theme button removed; forced dark applied on init

function save(kind){ if(!state[kind]) return Promise.resolve(); return axios.put(endpoint(kind), { data: state[kind] }).then(function(){ state.dirty[kind]=false; updateDirtyIndicator(); if(kind===state.active) alert('Salvo '+kind); }).catch(function(e){ console.error(e); alert('Erro salvando '+kind); }); }

refreshAll();

// Helpers for flags and categories chips
function renderCategoryChips(){ var host=document.getElementById('category-chips'); if(!host){ return; } if(state.active==='_all'){ host.innerHTML=''; return; } var ds=state[state.active]; if(!ds){ host.innerHTML=''; return; } var cats=Object.keys(ds.Categories||{}); var html=''; cats.forEach(function(c){ html+='<div class="chip'+(state.filters.category===c?' active':'')+' droppable" data-drop-type="category" data-type="category" data-category="'+c+'">'+c+'</div>'; }); host.innerHTML= html; }
function renderFlagsChips(){ var host=document.getElementById('flags-chips'); if(!host){ return; } var set={}; if(state.active==='_all'){
    state._datasets.forEach(function(dsName){ var ds=state[dsName]; if(ds && ds.Categories){ Object.values(ds.Categories).forEach(function(items){ Object.values(items).forEach(function(item){ (item.flags||[]).forEach(function(f){ set[f]=true; }); }); }); } });
  } else {
    var ds=state[state.active]; if(ds && ds.Categories){ Object.values(ds.Categories).forEach(function(items){ Object.values(items).forEach(function(item){ (item.flags||[]).forEach(function(f){ set[f]=true; }); }); }); }
  }
  var flags=Object.keys(set).sort(); var html=''; flags.forEach(function(f){ var active = state.filters.flags.indexOf(f)!==-1; html+='<div class="chip'+(active?' active':'')+'" data-type="flag" data-flag="'+f+'">'+f+'</div>'; }); host.innerHTML= html; }
function renderDatasetChips(){ var host=document.getElementById('dataset-chips'); if(!host) return; var html=''; if(state._datasets.length>1){ html+='<div class="chip'+(state.active==='_all'?' active':'')+'" data-type="dataset" data-dataset="_all">All</div>'; }
  state._datasets.forEach(function(ds){ var label = ds.charAt(0).toUpperCase()+ds.slice(1); html+='<div class="chip'+(state.active===ds?' active':'')+'" data-type="dataset" data-dataset="'+ds+'">'+label+'</div>'; });
  host.innerHTML=html || '<div class="text-xs text-gray-500">Nenhum dataset encontrado</div>';
}

function promoteVariant(dsName, category, currentName, newName){ var ds=state[dsName]; var items=ds.Categories[category]; var item=items[currentName]; if(!item) return; // simple rename approach
  // Update variants list: replace newName with currentName
  var v = Array.isArray(item.variants)? item.variants.slice():[]; var idx=v.indexOf(newName); if(idx!==-1) v.splice(idx,1); if(v.indexOf(currentName)===-1) v.unshift(currentName);
  // Move key
  items[newName]=item; delete items[currentName]; item.variants=v; if(state.active==='_all'){ state.selected['_all']={ dataset:dsName, category:category, classname:newName }; } else { state.selected[dsName]={category:category, classname:newName}; } markDirty(dsName); renderNav(); }

function moveItemToCategory(dsName, fromCategory, classname, toCategory){ if(fromCategory===toCategory) return; var ds=state[dsName]; if(!ds) return; if(!ds.Categories[toCategory]) ds.Categories[toCategory]={}; var items=ds.Categories; if(items[toCategory][classname]){ alert('Já existe item com este classname na categoria destino.'); return; } items[toCategory][classname]=items[fromCategory][classname]; delete items[fromCategory][classname]; if(state.active==='_all'){ if(state.selected['_all'] && state.selected['_all'].classname===classname){ state.selected['_all']={ dataset: dsName, category: toCategory, classname: classname }; } } else if(state.active===dsName){ if(state.selected[dsName] && state.selected[dsName].classname===classname){ state.selected[dsName]={category:toCategory, classname:classname}; } }
  markDirty(dsName); renderCategoryChips(); renderNav(); }

function applyTheme(mode){ var b=document.body; b.classList.add('theme-dark'); }

// Create dataset flow: prompt name, POST, refresh, activate
function createDatasetFlow(){
  var name = (prompt('Nome do novo dataset (.json):')||'').trim();
  if(!name) return;
  axios.post('/api/datasets', { name: name }).then(function(res){
    var ds = (res.data && res.data.dataset) ? String(res.data.dataset).toLowerCase() : (name.replace(/\s+/g,'')||name).toLowerCase();
    return refreshAll().then(function(){
      if(state._datasets.indexOf(ds)!==-1){ state.active = ds; }
      renderDatasetChips(); renderNav(); renderEditor(); buildPalette();
      alert('Criado dataset: '+ds);
    });
  }).catch(function(err){
    var msg = (err && err.response && err.response.data && err.response.data.detail) ? err.response.data.detail : 'Erro ao criar dataset';
    alert(msg);
  });
}

// Delete key -> move selected classname to Trash and remove from dataset (mark dirty)
document.addEventListener('keydown', function(e){
  if(e.key !== 'Delete') return;
  var ae = document.activeElement;
  if(ae && (ae.tagName==='INPUT' || ae.tagName==='TEXTAREA' || ae.isContentEditable)) return; // don't interfere with typing
  var sel = getSelected();
  if(!sel) return;
  var ds = sel.dataset, cat = sel.category, cls = sel.classname;
  if(!ds || !state[ds] || !state[ds].Categories || !state[ds].Categories[cat] || !state[ds].Categories[cat][cls]) return;
  // Remove item
  delete state[ds].Categories[cat][cls];
  // Clear selection
  if(state.active==='_all'){
    state.selected['_all'] = null;
  } else {
    state.selected[ds] = null;
  }
  markDirty(ds);
  renderNav(); renderEditor(); buildPalette();
  // Append to Trash (best-effort)
  axios.post('/api/trash', { classes: [cls] }).catch(function(){ /* ignore */ });
});
