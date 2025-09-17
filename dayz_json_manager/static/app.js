// Extracted application logic
// Dynamic datasets: state stores dataset data under state[<datasetName>]
var state = { active:'weapons', dirty:{}, selected:{}, selectedVariant:{}, palette:[], filters:{ category:'', flags:[] }, _datasets:[], collapsed:{}, rightTab:'attachments', pending:{ items:[] }, trash:{ classes:[] }, _pendingSelection:{}, _history:[], _redo:[], collapsedItems:{}, locked:{} };
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
    // Load pending store and trash in parallel
    return Promise.all([
      axios.get('/api/pending').then(function(r){ state.pending = r.data || {items:[]}; }).catch(function(){ state.pending={items:[]}; }),
      axios.get('/api/trash').then(function(r){ state.trash = r.data || {classes:[]}; }).catch(function(){ state.trash={classes:[]}; })
    ]);
  }).then(function(){
    // Ensure there is an active dataset selected
    if(!state.active || state._datasets.indexOf(state.active)===-1){
      state.active = (state._datasets.indexOf('weapons')!==-1) ? 'weapons' : (state._datasets[0] || '');
    }
    renderDatasetChips(); renderCategoryChips(); renderFlagsChips(); buildPalette(); renderPending(); renderTrash(); renderRightTab(); renderNav(); renderEditor(); updateDirtyIndicator(); applyTheme('dark');
  }).catch(function(err){ console.error('Falha ao carregar datasets', err); });
}

function setActive(tab){ state.active=tab; state.filters={ category:'', flags:[] }; renderDatasetChips(); renderCategoryChips(); renderFlagsChips(); renderNav(); renderEditor(); buildPalette(); }

function renderNav(){
  var kind=state.active; var host=document.getElementById('nav-pane'); var search=document.getElementById('search').value.trim().toLowerCase(); var html=''; var filterCat = state.filters.category; var sel=state.selected[kind];
  function renderOneDataset(dsName){ var data=state[dsName]; if(!data) return; var cats=data.Categories||{}; Object.keys(cats).forEach(function(cat){ if(filterCat && kind!=="_all" && cat!==filterCat) return; var isColl = !!(state.collapsed[dsName] && state.collapsed[dsName][cat]); var headerLabel = (kind==='_all'? (dsName+' · '+cat):cat); 
      // Enhanced category header with better visual hierarchy
      html+='<div class="nav-category mb-3 border border-gray-600 bg-gradient-to-r from-gray-800 to-gray-750 rounded-lg shadow-sm droppable" data-drop-type="category" data-category="'+cat+'" data-kind="'+dsName+'">'+
        '<div class="flex items-center justify-between p-3">'+
          '<div class="flex items-center gap-3">'+
            '<button class="flex-shrink-0 text-gray-400 hover:text-blue-400 transition-colors duration-200" title="Expandir/Colapsar" data-action="toggle-category" data-category="'+cat+'" data-kind="'+dsName+'">'+
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 transform transition-transform duration-200 '+(isColl?'-rotate-90':'rotate-0')+'">'+
                '<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.085l3.71-3.855a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z" clip-rule="evenodd" />'+
              '</svg>'+
            '</button>'+
            '<div class="flex items-center gap-2">'+
              '<span class="text-blue-400 text-lg">📂</span>'+
              '<button class="text-gray-100 font-semibold text-sm hover:text-blue-300 transition-colors" data-action="rename-category" data-category="'+cat+'" data-kind="'+dsName+'">'+headerLabel+'</button>'+
            '</div>'+
          '</div>'+
          '<div class="flex items-center gap-2">'+
            '<span class="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">'+Object.keys(cats[cat]||{}).length+' items</span>'+
            '<button class="p-1.5 rounded-md hover:bg-red-600 hover:bg-opacity-20 transition-colors" title="Excluir categoria" data-action="remove-category" data-category="'+cat+'" data-kind="'+dsName+'">'+
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-red-400 hover:text-red-300">'+
                '<path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />'+
              '</svg>'+
            '</button>'+
          '</div>'+
        '</div>'+
      '</div>';
      
      var items=cats[cat]; if(isColl) return; 
      
      Object.keys(items).forEach(function(cls){ var item=items[cls]||{}; var variants = Array.isArray(item.variants)? item.variants: (item.variants && typeof item.variants==='object'? Object.keys(item.variants):[]);
      // Search allows classname or variant match
      if(search){ var sOk = cls.toLowerCase().indexOf(search)!==-1 || (variants||[]).some(function(v){return (v||'').toLowerCase().indexOf(search)!==-1;}); if(!sOk) return; }
      if(state.filters.flags.length){ var f=item.flags||[]; var ok=false; for(var i=0;i<state.filters.flags.length;i++){ if(f.indexOf(state.filters.flags[i])!==-1){ ok=true; break; } } if(!ok) return; }
      var isActive = false; if(kind==='_all'){ isActive = sel && sel.dataset===dsName && sel.category===cat && sel.classname===cls; } else { isActive = sel && sel.category===cat && sel.classname===cls; }
      var key = dsName+'|'+cat+'|'+cls; var vCollapsed = !!state.collapsedItems[key];
      var isLocked = !!state.locked[key];
      
      // Enhanced class item with better visual design
      html+='<div class="nav-item ml-4 mb-2 '+(isActive?'active':'')+' bg-gray-750 hover:bg-gray-700 border border-gray-600 rounded-lg transition-all duration-200" draggable="true" data-action="select-item" data-category="'+cat+'" data-classname="'+cls+'" data-kind="'+dsName+'">'+
        '<div class="flex items-center justify-between p-3">'+
          '<div class="flex items-center gap-3 min-w-0 flex-1">'+
            '<span class="text-green-400 text-base flex-shrink-0">🔧</span>'+
            '<div class="min-w-0 flex-1">'+
              '<div class="flex items-center gap-2">'+
                '<span class="font-medium text-gray-100 truncate">'+cls+'</span>'+
                ((isActive && state.dirty[dsName])?'<span class="dirty-dot bg-orange-400"></span>':'')+
                (variants && variants.length? '<span class="text-xs text-gray-400 bg-gray-600 px-1.5 py-0.5 rounded-full">'+variants.length+' var</span>' : '')+
              '</div>'+
              (item.tier? '<div class="text-xs text-gray-400 mt-0.5">Tier '+item.tier+'</div>' : '')+
            '</div>'+
          '</div>'+
          '<div class="flex items-center gap-2 flex-shrink-0">'+
            (isLocked? '<span class="text-amber-400 text-sm" title="Item travado (L para destravar)">🔒</span>' : '')+
            (variants && variants.length? '<button class="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-gray-200 transition-colors" title="Mostrar/ocultar variantes" data-action="toggle-variants" data-kind="'+dsName+'" data-category="'+cat+'" data-classname="'+cls+'">'+
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 transform transition-transform duration-200 '+(vCollapsed?'-rotate-90':'rotate-0')+'">'+
                '<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.085l3.71-3.855a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z" clip-rule="evenodd" />'+
              '</svg>'+
            '</button>' : '')+
          '</div>'+
        '</div>';
        
      // Enhanced variants section
      if(!vCollapsed && variants && variants.length){
        html+='<div class="border-t border-gray-600 bg-gray-800 bg-opacity-50 px-3 py-2">'+
          '<div class="space-y-1">';
        variants.forEach(function(vn){ 
          var hasOv = (item.variants && typeof item.variants==='object' && item.variants[vn] && Object.keys(item.variants[vn]).length>0); 
          var isVariantActive = false; 
          if(kind==='_all'){ 
            isVariantActive = sel && sel.dataset===dsName && sel.category===cat && sel.classname===cls && state.selectedVariant['_all']===vn; 
          } else { 
            isVariantActive = sel && sel.category===cat && sel.classname===cls && state.selectedVariant[kind]===vn; 
          } 
          html+='<div class="nav-variant flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-150 '+(isVariantActive?'bg-blue-600 bg-opacity-60 text-blue-100':'text-gray-300 hover:bg-gray-700 hover:bg-opacity-50')+'" data-kind="'+dsName+'" data-category="'+cat+'" data-classname="'+cls+'" data-variant="'+vn+'">'+
            '<span class="text-purple-400 text-sm flex-shrink-0">🔸</span>'+
            '<span class="text-sm font-medium truncate flex-1">'+vn+'</span>'+
            (hasOv? '<span class="text-amber-400 text-xs flex-shrink-0" title="Tem overrides customizados">●</span>' : '')+
          '</div>'; 
        });
        html+='</div></div>';
      }
      html+='</div>';
      }); }); }
  if(kind==='_all'){
    state._datasets.forEach(function(ds){ renderOneDataset(ds); });
  } else {
    var data=state[kind]; if(!data){ host.innerHTML='<p class="p-3 text-xs text-gray-500">Carregando...</p>'; return; }
    renderOneDataset(kind);
  }
  host.innerHTML = html || '<p class="p-3 text-xs text-gray-500">Sem itens.</p>';
}

function getSelected(){ var k=state.active; var sel=state.selected[k]; if(!sel) return null; var variant = state.selectedVariant[k] || null; if(k==='_all'){ return Object.assign({}, sel, { variant: variant }); } return { dataset:k, category:sel.category, classname:sel.classname, variant: variant }; }

function renderEditor(){ var pane=document.getElementById('editor-pane'); var sel=getSelected(); var kindActual = sel? sel.dataset : state.active; if(state.active==='_all' && !sel){ pane.innerHTML='<p class="text-sm text-gray-500">Selecione um item à esquerda.</p>'; return; } if(!state[kindActual]){ pane.innerHTML='<p class="text-sm text-gray-500">Carregando...</p>'; return; } if(!sel){ pane.innerHTML='<p class="text-sm text-gray-500">Selecione um item à esquerda.</p>'; return; } var category=sel.category, classname=sel.classname, selectedVariant=sel.variant; var item = state[kindActual].Categories[category][classname]; if(!item){ pane.innerHTML='<p class="text-sm text-red-500">Item não encontrado.</p>'; return; }
  // Check if item is locked
  var lockKey = kindActual+'|'+category+'|'+classname;
  var isLocked = !!state.locked[lockKey];
  if(isLocked){
    pane.innerHTML='<div class="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded p-4 text-center"><h3 class="text-yellow-400 font-bold mb-2">🔒 Item Travado</h3><p class="text-yellow-200 mb-3">Este item está travado para edição.</p><p class="text-xs text-yellow-300">Pressione <kbd class="bg-yellow-800 px-1 rounded">L</kbd> para destravar</p></div>';
    return;
  }
  var isWeapon = kindActual==='weapons';
  function getVariantNames(it){ if(!it) return []; if(Array.isArray(it.variants)) return it.variants.slice(); if(it.variants && typeof it.variants==='object') return Object.keys(it.variants); return []; }
  function ensureVariantsObject(it){ if(!it) return {}; if(Array.isArray(it.variants)){ var obj={}; it.variants.forEach(function(n){ obj[n]={}; }); it.variants=obj; } else if(!it.variants || typeof it.variants!=='object'){ it.variants={}; } return it.variants; }
  function numInput(label, field, val){ return '<div><label class="editor-label">'+label+'</label><input data-field="'+field+'" type="number" value="'+(val==null?'':val)+'" class="mt-1 w-full border rounded px-2 py-1" /></div>'; }
  function textInput(label, field, val){ return '<div><label class="editor-label">'+label+'</label><input data-field="'+field+'" type="text" value="'+(val==null?'':val)+'" class="mt-1 w-full border rounded px-2 py-1" /></div>'; }
  function arrayEditor(label, field, arr){ arr = Array.isArray(arr)?arr:[]; var inner=''; for(var i=0;i<arr.length;i++){ inner+='<span class="pill" data-index="'+i+'" data-field="'+field+'">'+arr[i]+'<button data-action="remove-pill">×</button></span>'; } return '<div data-array-field="'+field+'"><label class="editor-label flex items-center justify-between">'+label+'<button data-action="add-pill" data-field="'+field+'" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button></label><div class="mt-1">'+inner+'</div></div>'; }
  // Variant-aware helpers
  function vNumInput(label, field, val, vn){ return '<div><label class="editor-label">'+label+'</label><input data-field="'+field+'" data-variant="'+vn+'" type="number" value="'+(val==null?'':val)+'" class="mt-1 w-full border rounded px-2 py-1" /></div>'; }
  function vTextInput(label, field, val, vn){ return '<div><label class="editor-label">'+label+'</label><input data-field="'+field+'" data-variant="'+vn+'" type="text" value="'+(val==null?'':val)+'" class="mt-1 w-full border rounded px-2 py-1" /></div>'; }
  function vArrayEditor(label, field, arr, vn){ arr = Array.isArray(arr)?arr:[]; var inner=''; for(var i=0;i<arr.length;i++){ inner+='<span class="pill" data-index="'+i+'" data-field="'+field+'" data-variant="'+vn+'">'+arr[i]+'<button data-action="remove-pill">×</button></span>'; } return '<div data-array-field="'+field+'" data-variant="'+vn+'"><label class="editor-label flex items-center justify-between">'+label+'<button data-action="add-pill" data-field="'+field+'" data-variant="'+vn+'" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button></label><div class="mt-1">'+inner+'</div></div>'; }
  function variantsEditor(){ var vnames = getVariantNames(item); ensureVariantsObject(item); var html='<div data-field="variants" class="droppable" data-drop-type="variants"><label class="editor-label flex items-center justify-between">Variants <button data-action="variant-add" class="text-xs p-1 rounded hover:bg-gray-700" title="Adicionar variante">➕</button></label><div class="mt-2 space-y-3">';
    vnames.forEach(function(vn){ var ov = (item.variants && typeof item.variants==='object' && item.variants[vn])? item.variants[vn] : {}; html+='<div class="border rounded p-2">'+
      '<div class="flex items-center justify-between mb-2">'+
        '<div class="text-xs font-semibold">'+vn+'</div>'+
        '<div class="space-x-1">'+
          '<button class="text-xs p-1 rounded hover:bg-gray-700" title="Editar overrides (JSON)" data-action="variant-edit" data-variant="'+vn+'">✏️</button>'+
          '<button class="text-xs p-1 rounded hover:bg-gray-700" title="Remover variante" data-action="variant-remove" data-variant="'+vn+'">🗑️</button>'+
        '</div>'+
      '</div>'+
      '<div class="grid grid-cols-2 gap-2">'+
        vNumInput('Tier','tier', ov.tier, vn)+
        vNumInput('Value','value', ov.value, vn)+
        (isWeapon? vNumInput('Chamber Size','chamber_size', ov.chamber_size, vn) : '')+
      '</div>'+
      (isWeapon? (
        vArrayEditor('Ammo Types','ammo_types', ov.ammo_types, vn)+
        vArrayEditor('Magazines','magazines', ov.magazines, vn)
      ) : '')+
      vArrayEditor('Flags','flags', ov.flags, vn)+
    '</div>'; });
    html+='</div><div class="text-xs text-gray-400 mt-2">Dica: arraste um classname do painel esquerdo ou dos Pendentes para adicionar como variante.</div></div>'; return html; }
  function attachmentsEditor(){ if(isWeapon){ var att=(item.attachments && typeof item.attachments==='object')? item.attachments : {}; var html='<div data-field="attachments"><label class="editor-label flex items-center justify-between">Attachments <button data-action="add-attachment-slot" class="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded">+ Slot</button></label><div class="mt-2 space-y-2">'; Object.keys(att).forEach(function(slot){ var list=att[slot]||[]; html+='<div class="border rounded p-2 droppable" data-drop-type="attachment" data-slot="'+slot+'"><div class="flex items-center justify-between mb-1"><strong class="text-xs">'+slot+'</strong><div class="space-x-1"><button data-action="add-nested-pill" data-slot="'+slot+'" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button><button data-action="remove-attachment-slot" data-slot="'+slot+'" class="text-xs bg-red-500 text-white px-2 py-0.5 rounded">x</button></div></div>'; for(var i=0;i<list.length;i++){ html+='<span class="pill" data-index="'+i+'" data-slot="'+slot+'" data-field="attachments" data-nested="1">'+list[i]+'<button data-action="remove-pill">×</button></span>'; } html+='</div>'; }); html+='</div></div>'; return html; } else { var arr = Array.isArray(item.attachments)? item.attachments:[]; var inner=''; for(var i=0;i<arr.length;i++){ inner+='<span class="pill" data-index="'+i+'" data-field="attachments">'+arr[i]+'<button data-action="remove-pill">×</button></span>'; } return '<div data-array-field="attachments" class="droppable" data-drop-type="attachment"><label class="editor-label flex items-center justify-between">Attachments<button data-action="add-pill" data-field="attachments" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button></label><div class="mt-1">'+inner+'</div></div>'; } }
  if(selectedVariant){ 
    // Editing a variant - show variant override editor
    ensureVariantsObject(item); var variant = item.variants[selectedVariant] || {}; var parts=[]; 
    parts.push('<div class="bg-blue-900 bg-opacity-30 border border-blue-600 rounded p-3 mb-4"><h3 class="text-blue-200 font-semibold mb-2">Editando Variante: '+selectedVariant+'</h3><p class="text-xs text-blue-300 mb-3">Base: '+classname+' | Categoria: '+category+' | Dataset: '+kindActual+'</p><div class="flex space-x-2 mb-2"><button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs flex items-center space-x-1" data-action="nav-variant-edit" data-kind="'+kindActual+'" data-category="'+category+'" data-classname="'+classname+'" data-variant="'+selectedVariant+'" title="Editar overrides (JSON)">✏️ <span>Editar JSON</span></button><button class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs flex items-center space-x-1" data-action="nav-variant-remove" data-kind="'+kindActual+'" data-category="'+category+'" data-classname="'+classname+'" data-variant="'+selectedVariant+'" title="Remover variante">🗑️ <span>Remover</span></button><button class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs flex items-center space-x-1" data-action="nav-variant-promote" data-kind="'+kindActual+'" data-category="'+category+'" data-classname="'+classname+'" data-variant="'+selectedVariant+'" title="Promover variante">⬆️ <span>Promover</span></button><button onclick="clearVariantSelection()" class="bg-gray-600 text-white px-3 py-1 text-xs rounded hover:bg-gray-500">← Voltar ao Item Base</button></div></div>');
    parts.push(textInput('Nome da Variante','_variant_name', selectedVariant)); parts.push(numInput('Tier Override','tier', variant.tier)); parts.push(numInput('Value Override','value', variant.value)); if(isWeapon){ parts.push(numInput('Chamber Size Override','chamber_size', variant.chamber_size)); parts.push(arrayEditor('Ammo Types Override','ammo_types', variant.ammo_types)); parts.push(arrayEditor('Magazines Override','magazines', variant.magazines)); }
    parts.push(arrayEditor('Flags Override','flags', variant.flags)); 
    if(isWeapon && variant.attachments){ parts.push('<div><label class="editor-label">Attachments Override</label><pre class="mt-1 p-2 bg-gray-800 rounded text-xs">'+JSON.stringify(variant.attachments, null, 2)+'</pre></div>'); }
    pane.innerHTML = '<div class="editor-box space-y-4" data-kind="'+kindActual+'" data-category="'+category+'" data-classname="'+classname+'" data-variant="'+selectedVariant+'">'+parts.join('')+'</div>';
  } else { 
    // Editing base item
    var parts=[]; parts.push(textInput('Classname','_classname', classname)); parts.push(numInput('Tier','tier', item.tier)); parts.push(numInput('Value','value', item.value)); if(isWeapon){ parts.push(numInput('Chamber Size','chamber_size', item.chamber_size)); parts.push(arrayEditor('Ammo Types','ammo_types', item.ammo_types)); parts.push(arrayEditor('Magazines','magazines', item.magazines)); }
    parts.push(variantsEditor()); parts.push(attachmentsEditor()); parts.push(arrayEditor('Flags','flags', item.flags));
    pane.innerHTML = '<div class="editor-box space-y-4" data-kind="'+kindActual+'" data-category="'+category+'" data-classname="'+classname+'">'+parts.join('')+'</div>';
  }
}

function buildPalette(){ var all={}; if(state.active==='_all'){
  state._datasets.forEach(function(dsName){ var ds = state[dsName]; if(ds && ds.Categories){ Object.values(ds.Categories).forEach(function(items){ Object.values(items).forEach(function(it){ if(dsName==='weapons'){ var att=it.attachments; if(att && typeof att==='object'){ Object.values(att).forEach(function(arr){ (arr||[]).forEach(function(v){ all[v]=true; }); }); } } else { (it.attachments||[]).forEach(function(v){ all[v]=true; }); } }); }); } });
} else {
  var ds = state[state.active]; if(ds && ds.Categories){ Object.values(ds.Categories).forEach(function(items){ Object.values(items).forEach(function(it){ if(state.active==='weapons'){ var att=it.attachments; if(att && typeof att==='object'){ Object.values(att).forEach(function(arr){ (arr||[]).forEach(function(v){ all[v]=true; }); }); } } else { (it.attachments||[]).forEach(function(v){ all[v]=true; }); } }); }); }
}
 var list=Object.keys(all).sort(); state.palette=list; var filter=document.getElementById('palette-filter').value.trim().toLowerCase(); var html=''; list.forEach(function(p){ if(filter && p.toLowerCase().indexOf(filter)===-1) return; html+='<div class="palette-item" draggable="true" data-action="palette-add" data-value="'+p+'"><span>'+p+'</span><span class="text-gray-400 text-xs">+</span></div>'; }); document.getElementById('palette-list').innerHTML= html || '<p class="text-xs text-gray-500">Nenhum attachment.</p>'; document.getElementById('palette-count').textContent=list.length+' itens'; }

// --- Undo/Redo: snapshot-based history ---
function takeSnapshot(){
  var snap = {
    active: state.active,
    dirty: JSON.parse(JSON.stringify(state.dirty || {})),
    selected: JSON.parse(JSON.stringify(state.selected || {})),
    selectedVariant: JSON.parse(JSON.stringify(state.selectedVariant || {})),
    collapsed: JSON.parse(JSON.stringify(state.collapsed || {})),
    collapsedItems: JSON.parse(JSON.stringify(state.collapsedItems || {})),
    filters: JSON.parse(JSON.stringify(state.filters || {})),
    rightTab: state.rightTab,
    pending: JSON.parse(JSON.stringify(state.pending || {items:[]})),
    trash: JSON.parse(JSON.stringify(state.trash || {classes:[]})),
    datasets: {}
  };
  (state._datasets||[]).forEach(function(ds){ snap.datasets[ds] = JSON.parse(JSON.stringify(state[ds] || {})); });
  return snap;
}
function applySnapshot(snap){
  if(!snap) return;
  state.active = snap.active;
  state.dirty = JSON.parse(JSON.stringify(snap.dirty||{}));
  state.selected = JSON.parse(JSON.stringify(snap.selected||{}));
  state.selectedVariant = JSON.parse(JSON.stringify(snap.selectedVariant||{}));
  state.collapsed = JSON.parse(JSON.stringify(snap.collapsed||{}));
  state.collapsedItems = JSON.parse(JSON.stringify(snap.collapsedItems||{}));
  state.filters = JSON.parse(JSON.stringify(snap.filters||{}));
  state.rightTab = snap.rightTab;
  state.pending = JSON.parse(JSON.stringify(snap.pending||{items:[]}));
  state.trash = JSON.parse(JSON.stringify(snap.trash||{classes:[]}));
  Object.keys(snap.datasets||{}).forEach(function(ds){ state[ds] = JSON.parse(JSON.stringify(snap.datasets[ds])); });
  // Re-render everything to reflect restored state
  renderDatasetChips(); renderCategoryChips(); renderFlagsChips(); buildPalette(); renderPending(); renderTrash(); renderRightTab(); renderNav(); renderEditor(); updateDirtyIndicator();
}
function pushHistory(){
  try{
    var snap = takeSnapshot();
    state._history = state._history || [];
    state._history.push(snap);
    if(state._history.length > 50) state._history.shift();
    // any new mutation invalidates redo stack
    state._redo = [];
  } catch(_e){ /* ignore snapshot errors */ }
}
function undo(){
  if(!state._history || state._history.length===0) return;
  try {
    var current = takeSnapshot();
    var prev = state._history.pop();
    state._redo = state._redo || [];
    state._redo.push(current);
    if(state._redo.length>50) state._redo.shift();
    applySnapshot(prev);
  } catch(_e){ /* ignore */ }
}
function redo(){
  if(!state._redo || state._redo.length===0) return;
  try {
    var current = takeSnapshot();
    var next = state._redo.pop();
    state._history = state._history || [];
    state._history.push(current);
    if(state._history.length>50) state._history.shift();
    applySnapshot(next);
  } catch(_e){ /* ignore */ }
}

document.addEventListener('click', function(e){ 
  console.log('Click detectado em:', e.target, 'Classes:', e.target.className);
  var el=e.target.closest('button, .nav-item, .palette-item, .chip, select.variant-select, #btn-pending-add, #modal-close, #modal-cancel, #modal-apply, #btn-toggle-pending, #btn-toggle-trash, .pending-item, .trash-item'); 
  
  // Verificar se clicou numa variante antes de verificar outros elementos
  var vRow = e.target.closest('.nav-variant');
  if(vRow) {
    console.log('Clique em variante detectado primeiro!');
    var action = e.target.closest('[data-action]') ? e.target.closest('[data-action]').dataset.action : null;
    if(!action) {
      console.log('Processando clique na variante (sem ação específica)');
      var kind = state.active;
      var dsV = vRow.dataset.kind || kind; 
      var catV = vRow.dataset.category; 
      var clsV = vRow.dataset.classname; 
      var vnV = vRow.dataset.variant;
      
      console.log('Selecionando variante:', { dataset: dsV, category: catV, classname: clsV, variant: vnV });
      
      if(kind==='_all'){ 
        state.selected['_all'] = { dataset: dsV, category: catV, classname: clsV }; 
        state.selectedVariant['_all'] = vnV; 
      } else { 
        state.selected[kind] = { category: catV, classname: clsV }; 
        state.selectedVariant[kind] = vnV; 
      }
      
      state.rightTab = 'attachments';
      renderRightTab(); 
      renderNav(); 
      renderEditor();
      return;
    }
  }
  
  if(!el) return; var action=el.dataset.action; var kind=state.active;
  if(el.classList.contains('chip')){ if(el.dataset.type==='category'){ state.filters.category = (state.filters.category===el.dataset.category? '' : el.dataset.category); renderCategoryChips(); renderNav(); } else if(el.dataset.type==='flag'){ var flag=el.dataset.flag; var idx=state.filters.flags.indexOf(flag); if(idx===-1) state.filters.flags.push(flag); else state.filters.flags.splice(idx,1); renderFlagsChips(); renderNav(); } else if(el.dataset.type==='dataset'){ setActive(el.dataset.dataset); } return; }
  if(el.id==='btn-toggle-pending'){ state.rightTab = (state.rightTab==='pending'?'attachments':'pending'); renderRightTab(); return; }
  if(el.id==='btn-toggle-trash'){ state.rightTab = (state.rightTab==='trash'?'attachments':'trash'); renderRightTab(); return; }
  if(el.id==='btn-pending-add'){ openPendingModal(); return; }
  if(el.id==='modal-close' || el.id==='modal-cancel'){ closePendingModal(); return; }
  if(el.id==='modal-apply'){ var txt=document.getElementById('modal-text').value||''; var lines = txt.split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean); if(!lines.length){ closePendingModal(); return; }
    var pendingSet = {}; (state.pending.items||[]).forEach(function(it){ var n=(typeof it==='string')? it : it.name; pendingSet[n]=true; });
    var trashAdd = [];
    lines.forEach(function(n){ if(/_Base|ColorBase/i.test(n)){ trashAdd.push(n); } else { pendingSet[n]=true; } });
    pushHistory();
    state.pending.items = Object.keys(pendingSet).sort().map(function(n){ return {name:n}; });
    var after = Promise.resolve();
    if(trashAdd.length){ after = axios.post('/api/trash', { classes: trashAdd }).catch(function(){}); }
    after.then(function(){ savePending(true); closePendingModal(); renderPending(); renderRightTab(); });
    return; }
  if(action==='toggle-category'){ var dsT = el.dataset.kind || state.active; var catT = el.dataset.category; if(!state.collapsed[dsT]) state.collapsed[dsT]={}; state.collapsed[dsT][catT] = !state.collapsed[dsT][catT]; renderNav(); return; }
  if(action==='toggle-variants'){ var dsTV=el.dataset.kind || state.active; var catTV=el.dataset.category; var clsTV=el.dataset.classname; var keyTV=dsTV+'|'+catTV+'|'+clsTV; state.collapsedItems[keyTV] = !state.collapsedItems[keyTV]; renderNav(); return; }
  if(action==='rename-category'){ var dsK = el.dataset.kind || state.active; var old = el.dataset.category; var data = state[dsK]; if(!data || !data.Categories || !data.Categories[old]) return; var nn = prompt('Renomear categoria:', old); if(!nn || nn===old) return; if(data.Categories[nn]){ alert('Categoria já existe.'); return; } pushHistory(); data.Categories[nn]=data.Categories[old]; delete data.Categories[old]; if(state.collapsed[dsK] && state.collapsed[dsK][old]!=null){ state.collapsed[dsK][nn]=state.collapsed[dsK][old]; delete state.collapsed[dsK][old]; } if(state.filters.category===old) state.filters.category=nn; markDirty(dsK); renderCategoryChips(); renderNav(); return; }
  if(action==='variant-add'){ var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var it=state[ds].Categories[sel.category][sel.classname]; var vname=prompt('Nome da variante (ex: _black):'); if(!vname) return; if(Array.isArray(it.variants)){ it.variants = it.variants.reduce(function(acc,n){ acc[n]={}; return acc; },{}); }
    if(!it.variants || typeof it.variants!=='object') it.variants={}; if(it.variants[vname]){ alert('Variante já existe'); return; } pushHistory(); it.variants[vname]={}; markDirty(ds); renderEditor(); renderNav(); return; }
  if(action==='nav-variant-edit'){ var dsN=el.dataset.kind || state.active; var catN=el.dataset.category; var clsN=el.dataset.classname; var vnN=el.dataset.variant; var itN = state[dsN] && state[dsN].Categories && state[dsN].Categories[catN] && state[dsN].Categories[catN][clsN]; if(!itN) return; if(!itN.variants || typeof itN.variants!=='object'){ itN.variants={}; } var curN = itN.variants[vnN] || {}; var txtN = prompt('Overrides (JSON) para '+vnN+':', JSON.stringify(curN)); if(txtN==null) return; try{ var objN = JSON.parse(txtN); }catch(eN){ alert('JSON inválido'); return; } pushHistory(); itN.variants[vnN]=objN; markDirty(dsN); renderEditor(); renderNav(); return; }
  if(action==='nav-variant-promote'){ var dsP=el.dataset.kind || state.active; var catP=el.dataset.category; var clsP=el.dataset.classname; var vnP=el.dataset.variant; promoteVariant(dsP, catP, clsP, vnP); renderEditor(); return; }
  if(action==='nav-variant-remove'){ var dsR=el.dataset.kind || state.active; var catR=el.dataset.category; var clsR=el.dataset.classname; var vnR=el.dataset.variant; var itR = state[dsR] && state[dsR].Categories && state[dsR].Categories[catR] && state[dsR].Categories[catR][clsR]; if(!itR || !itR.variants || typeof itR.variants!=='object') return; pushHistory(); delete itR.variants[vnR]; markDirty(dsR); renderEditor(); renderNav(); return; }
  if(action==='variant-remove'){ var sel2=getSelected(); if(!sel2) return; var ds2=sel2.dataset; var it2=state[ds2].Categories[sel2.category][sel2.classname]; var vname2=el.dataset.variant; if(!vname2) return; if(!it2.variants || typeof it2.variants!=='object') return; pushHistory(); delete it2.variants[vname2]; markDirty(ds2); renderEditor(); renderNav(); return; }
  if(action==='variant-edit'){ var sel3=getSelected(); if(!sel3) return; var ds3=sel3.dataset; var it3=state[ds3].Categories[sel3.category][sel3.classname]; var vname3=el.dataset.variant; if(!vname3) return; if(!it3.variants || typeof it3.variants!=='object'){ it3.variants={}; }
    var cur = it3.variants[vname3] || {}; var txt = prompt('Overrides (JSON). Campos suportados: tier, value, attachments, flags, ammo_types, chamber_size, magazines', JSON.stringify(cur)); if(txt==null) return; try{ var obj=JSON.parse(txt); }catch(e2){ alert('JSON inválido'); return; } pushHistory(); it3.variants[vname3]=obj; markDirty(ds3); renderEditor(); renderNav(); return; }
  if(action==='select-item'){ var ds2=el.dataset.kind || kind; if(kind==='_all'){ state.selected['_all']={ dataset:ds2, category:el.dataset.category, classname:el.dataset.classname }; state.selectedVariant['_all'] = null; } else { state.selected[kind]={ category:el.dataset.category, classname:el.dataset.classname }; state.selectedVariant[kind] = null; } state.rightTab='attachments'; renderRightTab(); renderNav(); renderEditor(); return; }

  if(action==='remove-category'){ var cat=el.dataset.category; var dsKey = el.dataset.kind || state.active; if(confirm('Remover categoria '+cat+'?')){ var names = Object.keys((state[dsKey] && state[dsKey].Categories && state[dsKey].Categories[cat])||{}); if(names.length){ axios.post('/api/trash', { classes: names }).catch(function(){}); } pushHistory(); delete state[dsKey].Categories[cat]; if(state.collapsed[dsKey]){ delete state.collapsed[dsKey][cat]; } markDirty(dsKey); if(state.active==='_all'){ if(state.selected['_all'] && state.selected['_all'].dataset===dsKey && state.selected['_all'].category===cat) state.selected['_all']=null; } else { if(state.selected[dsKey] && state.selected[dsKey].category===cat) state.selected[dsKey]=null; } renderNav(); renderEditor(); renderCategoryChips(); } return; }
  if(action==='add-pill'){ var field=el.dataset.field; var vn=el.dataset.variant; addArrayValue(field, vn); return; }
  if(action==='remove-pill'){ removeArrayValue(el); return; }
  if(action==='add-attachment-slot'){ var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; var name=prompt('Nome do slot:'); if(!name) return; pushHistory(); if(!item.attachments || typeof item.attachments!=='object') item.attachments={}; if(!item.attachments[name]) item.attachments[name]=[]; markDirty(ds); renderEditor(); buildPalette(); return; }
  if(action==='add-nested-pill'){ var slot=el.dataset.slot; var val=prompt('Novo attachment:'); if(!val) return; var sel2=getSelected(); if(!sel2) return; var ds2=sel2.dataset; var item2=state[ds2].Categories[sel2.category][sel2.classname]; pushHistory(); item2.attachments[slot].push(val.trim()); markDirty(ds2); renderEditor(); buildPalette(); return; }
  if(action==='remove-attachment-slot'){ var slot2=el.dataset.slot; var sel3=getSelected(); if(!sel3) return; var ds3=sel3.dataset; var item3=state[ds3].Categories[sel3.category][sel3.classname]; pushHistory(); delete item3.attachments[slot2]; markDirty(ds3); renderEditor(); buildPalette(); return; }
  if(action==='palette-add'){ paletteAdd(el.dataset.value); return; }
  if(action==='pending-remove'){ var idx=parseInt(el.dataset.index,10); pushHistory(); state.pending.items.splice(idx,1); savePending(true); renderPending(); return; }
  if(action==='pending-find-variants'){ var name=el.dataset.name; findAndFocusVariant(name); return; }
  // Pending multi-select toggle
  var pEl = e.target.closest('.pending-item');
  if(pEl && !action){ var nm=pEl.dataset.name; if(!nm) return; state._pendingSelection[nm] = !state._pendingSelection[nm]; renderPending(); return; }
  // Trash actions
  if(action==='trash-remove'){ var name=el.dataset.name; if(!name) return; var arr=state.trash.classes||[]; var idx=arr.indexOf(name); if(idx!==-1){ pushHistory(); arr.splice(idx,1); saveTrash(true).then(renderTrash); } return; }
});

// Drag & Drop
document.addEventListener('dragstart', function(e){ var p=e.target.closest('.palette-item'); if(p && p.dataset.value){ e.dataTransfer.setData('text/attachment', p.dataset.value); e.dataTransfer.effectAllowed='copy'; }
  var n=e.target.closest('.nav-item'); if(n){ e.dataTransfer.setData('text/move-item', JSON.stringify({dataset:n.dataset.kind || state.active, category:n.dataset.category, classname:n.dataset.classname})); e.dataTransfer.effectAllowed='move'; }
  var pend=e.target.closest('.pending-item'); if(pend){
    var selected = Object.keys(state._pendingSelection||{}).filter(function(k){ return !!state._pendingSelection[k]; });
    if(selected.length>1){ e.dataTransfer.setData('text/pending-multi', JSON.stringify(selected)); }
    e.dataTransfer.setData('text/pending', JSON.stringify({ name: pend.dataset.name })); e.dataTransfer.effectAllowed='copy';
  }
  var tr=e.target.closest('.trash-item'); if(tr){ e.dataTransfer.setData('text/trash', JSON.stringify({ name: tr.dataset.name })); e.dataTransfer.effectAllowed='copy'; }
});
document.addEventListener('dragover', function(e){ var t=e.target.closest('[data-drop-type]'); if(!t) return; var type=t.dataset.dropType; var types = (e.dataTransfer && e.dataTransfer.types)? Array.from(e.dataTransfer.types):[]; if(type==='attachment' && types.indexOf('text/attachment')!==-1){ e.preventDefault(); t.classList.add('drag-over'); }
  if(type==='category' && (types.indexOf('text/move-item')!==-1 || types.indexOf('text/pending')!==-1 || types.indexOf('text/pending-multi')!==-1 || types.indexOf('text/trash')!==-1)){ e.preventDefault(); t.classList.add('drag-over'); }
  if(type==='variants' && (types.indexOf('text/move-item')!==-1 || types.indexOf('text/pending')!==-1)){ e.preventDefault(); t.classList.add('drag-over'); }
  if(type==='pending-target' && (types.indexOf('text/move-item')!==-1)){ e.preventDefault(); t.classList.add('drag-over'); }
});
document.addEventListener('dragleave', function(e){ var t=e.target.closest('[data-drop-type]'); if(!t) return; t.classList.remove('drag-over'); });
document.addEventListener('drop', function(e){ var t=e.target.closest('[data-drop-type]'); if(!t) return; var type=t.dataset.dropType; if(type==='attachment' && e.dataTransfer.getData('text/attachment')){ e.preventDefault(); t.classList.remove('drag-over'); var val=e.dataTransfer.getData('text/attachment'); var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; if(ds==='weapons'){ var slot=t.dataset.slot; if(!slot){ slot=prompt('Slot destino:'); if(!slot) return; } pushHistory(); if(!item.attachments||typeof item.attachments!=='object') item.attachments={}; if(!item.attachments[slot]) item.attachments[slot]=[]; if(item.attachments[slot].indexOf(val)===-1) item.attachments[slot].push(val); } else { pushHistory(); if(!Array.isArray(item.attachments)) item.attachments=[]; if(item.attachments.indexOf(val)===-1) item.attachments.push(val); } markDirty(ds); renderEditor(); buildPalette(); }
  if(type==='category'){
    if(e.dataTransfer.getData('text/move-item')){ e.preventDefault(); t.classList.remove('drag-over'); var info=JSON.parse(e.dataTransfer.getData('text/move-item')); var targetCat=t.dataset.category; var targetDs=t.dataset.kind || info.dataset || state.active; moveItemToCategory(targetDs, info.category, info.classname, targetCat); return; }
    var targetCat2=t.dataset.category; var targetDs2=t.dataset.kind || state.active;
    var multi = e.dataTransfer.getData('text/pending-multi');
    if(multi){ e.preventDefault(); t.classList.remove('drag-over'); var arr=[]; try{ arr=JSON.parse(multi)||[]; }catch(_e){}
      var one = e.dataTransfer.getData('text/pending'); if(one){ try{ var o=JSON.parse(one); if(o && o.name && arr.indexOf(o.name)===-1) arr.unshift(o.name); }catch(_e){} }
      pushHistory();
      arr.forEach(function(nm){ createItemFromPending(nm, targetCat2, targetDs2); }); state._pendingSelection={}; renderPending(); return; }
  if(e.dataTransfer.getData('text/pending')){ e.preventDefault(); t.classList.remove('drag-over'); var pinfo=JSON.parse(e.dataTransfer.getData('text/pending')); pushHistory(); createItemFromPending(pinfo.name, targetCat2, targetDs2); return; }
    if(e.dataTransfer.getData('text/trash')){ e.preventDefault(); t.classList.remove('drag-over'); var trInfo=JSON.parse(e.dataTransfer.getData('text/trash')); pushHistory(); restoreFromTrash(trInfo.name, targetCat2, targetDs2); return; }
  }
  if(type==='variants'){
    var sel=getSelected(); if(!sel){ t.classList.remove('drag-over'); return; }
    var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; ensureVariantsObject(item);
    // Accept classnames dragged from nav or pending to add as variant name
    if(e.dataTransfer.getData('text/move-item')){ e.preventDefault(); t.classList.remove('drag-over'); var info=JSON.parse(e.dataTransfer.getData('text/move-item')); var vname=info.classname; if(vname && !item.variants[vname]){ pushHistory(); item.variants[vname]={}; markDirty(ds); renderEditor(); renderNav(); } return; }
    if(e.dataTransfer.getData('text/pending')){ e.preventDefault(); t.classList.remove('drag-over'); var pinfo=JSON.parse(e.dataTransfer.getData('text/pending')); var vname2=pinfo.name; if(vname2 && !item.variants[vname2]){ pushHistory(); item.variants[vname2]={}; markDirty(ds); renderEditor(); renderNav(); } return; }
  }
  if(type==='pending-target'){
    if(e.dataTransfer.getData('text/move-item')){ e.preventDefault(); t.classList.remove('drag-over'); var info=JSON.parse(e.dataTransfer.getData('text/move-item')); var nm=info.classname; if(!nm) return; var set={}; (state.pending.items||[]).forEach(function(it){ var n=(typeof it==='string')? it : it.name; set[n]=true; }); set[nm]=true; pushHistory(); state.pending.items = Object.keys(set).sort().map(function(n){ return {name:n}; }); savePending(true); renderPending(); state.rightTab='pending'; renderRightTab(); }
  }
});

function restoreFromTrash(name, targetCategory, targetDataset){ if(!name) return; var ds = targetDataset || state.active; if(!ds || !state[ds]) return; var data=state[ds]; if(!data.Categories[targetCategory]) data.Categories[targetCategory]={}; if(data.Categories[targetCategory][name]){ alert('Já existe '+name+' em '+targetCategory); return; }
  var base = ds==='weapons'? { tier:null,value:null,ammo_types:[],chamber_size:1,magazines:[],variants:[],attachments:{},flags:[] } : { tier:null,value:null,variants:[],attachments:[],flags:[] };
  data.Categories[targetCategory][name]=base; markDirty(ds); renderNav(); renderEditor();
  // remove from trash list locally and persist
  var arr = state.trash.classes||[]; var idx = arr.indexOf(name); if(idx!==-1){ arr.splice(idx,1); saveTrash(true).then(renderTrash); }
}

function addArrayValue(field, variantName){ var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; var val=prompt('Novo valor:'); if(!val) return; var editingVariant = variantName || sel.variant; if(field==='attachments' && ds==='weapons' && !editingVariant){ alert('Use slots para armas.'); return; }
  pushHistory();
  if(editingVariant){ // ensure variants map exists
    if(Array.isArray(item.variants)){ item.variants = item.variants.reduce(function(acc,n){ acc[n]={}; return acc; },{}); }
    if(!item.variants || typeof item.variants!=='object') item.variants={};
    var ov = item.variants[editingVariant] || (item.variants[editingVariant]={});
    if(!Array.isArray(ov[field])) ov[field]=[];
    if(ov[field].indexOf(val.trim())===-1) ov[field].push(val.trim());
  } else {
    if(!Array.isArray(item[field])) item[field]=[];
    if(item[field].indexOf(val.trim())===-1) item[field].push(val.trim());
  }
  markDirty(ds); renderEditor(); buildPalette(); }
function removeArrayValue(el){ var pill=el.closest('.pill'); var index=parseInt(pill.dataset.index,10); var field=pill.dataset.field; var variantName=pill.dataset.variant; var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; var editingVariant = variantName || sel.variant; pushHistory(); if(field==='attachments' && ds==='weapons' && pill.dataset.nested && !editingVariant){ var slot=pill.dataset.slot; item.attachments[slot].splice(index,1); } else { if(editingVariant){ if(Array.isArray(item.variants)){ item.variants = item.variants.reduce(function(acc,n){ acc[n]={}; return acc; },{}); } if(!item.variants || typeof item.variants!=='object') item.variants={}; var ov=item.variants[editingVariant]||{}; if(Array.isArray(ov[field])) ov[field].splice(index,1); } else { if(Array.isArray(item[field])) item[field].splice(index,1); } }
  markDirty(ds); renderEditor(); buildPalette(); }
function paletteAdd(value){ var sel=getSelected(); if(!sel) return alert('Selecione um item.'); var ds=sel.dataset; var item=state[ds].Categories[sel.category][sel.classname]; if(ds==='weapons'){ var slot=prompt('Slot destino:'); if(!slot) return; pushHistory(); if(!item.attachments || typeof item.attachments!=='object') item.attachments={}; if(!item.attachments[slot]) item.attachments[slot]=[]; if(item.attachments[slot].indexOf(value)===-1) item.attachments[slot].push(value); } else { pushHistory(); if(!Array.isArray(item.attachments)) item.attachments=[]; if(item.attachments.indexOf(value)===-1) item.attachments.push(value); } markDirty(ds); renderEditor(); buildPalette(); }

document.addEventListener('blur', function(e){ var input=e.target; if(!input.matches('[data-field]')) return; var sel=getSelected(); if(!sel) return; var ds=sel.dataset; var category=sel.category, oldClass=sel.classname; var item=state[ds].Categories[category][oldClass]; var field=input.dataset.field; var vn=input.dataset.variant; var selectedVariant=sel.variant; if(field==='_variant_name' && selectedVariant){ var newVariantName=input.value.trim(); if(newVariantName && newVariantName!==selectedVariant){ if(Array.isArray(item.variants)){ item.variants = item.variants.reduce(function(acc,n){ acc[n]={}; return acc; },{}); } if(!item.variants || typeof item.variants!=='object') item.variants={}; if(item.variants[newVariantName]){ alert('Nome de variante já existe.'); input.value=selectedVariant; return; } pushHistory(); item.variants[newVariantName]=item.variants[selectedVariant]||{}; delete item.variants[selectedVariant]; state.selectedVariant[state.active] = newVariantName; markDirty(ds); renderNav(); renderEditor(); return; } } else if(field==='_classname'){ var newName=input.value.trim(); if(newName && newName!==oldClass){ if(state[ds].Categories[category][newName]){ alert('Classname já existe.'); input.value=oldClass; return; } pushHistory(); state[ds].Categories[category][newName]=item; delete state[ds].Categories[category][oldClass]; if(state.active==='_all'){ state.selected['_all']={ dataset:ds, category:category, classname:newName }; } else { state.selected[ds]={category:category, classname:newName}; }
      }
    } else {
      pushHistory();
      var editingVariant = vn || selectedVariant; // Use explicit variant attribute or selected variant
      if(editingVariant){ // variant override edit
        if(Array.isArray(item.variants)){ item.variants = item.variants.reduce(function(acc,n){ acc[n]={}; return acc; },{}); }
        if(!item.variants || typeof item.variants!=='object') item.variants={};
        var ov = item.variants[editingVariant] || (item.variants[editingVariant]={});
        if(input.type==='number'){
          var num = input.value===''?null:Number(input.value);
          if(num===null){ delete ov[field]; } else { ov[field] = (isNaN(num)? null : num); }
        } else {
          if(input.value===''){ delete ov[field]; } else { ov[field] = input.value; }
        }
      } else {
        if(input.type==='number'){
          var num2 = input.value===''?null:Number(input.value);
          item[field]= (isNaN(num2)? null : num2);
        } else {
          item[field]=input.value;
        }
      }
    }
  markDirty(ds); renderNav(); }, true);

document.getElementById('btn-add-item').addEventListener('click', function(){ state.rightTab='pending'; renderRightTab(); openPendingModal(); });
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
function renderRightTab(){ var att=document.getElementById('attachments-pane'); var pend=document.getElementById('pending-pane'); var trash=document.getElementById('trash-pane'); var addBtn=document.getElementById('btn-pending-add'); var title=document.getElementById('palette-title');
  var mode=state.rightTab;
  if(mode==='attachments'){ att.classList.remove('hidden'); pend.classList.add('hidden'); trash.classList.add('hidden'); if(addBtn) addBtn.classList.add('hidden'); if(title) title.textContent='Attachments'; }
  if(mode==='pending'){ att.classList.add('hidden'); pend.classList.remove('hidden'); trash.classList.add('hidden'); if(addBtn) addBtn.classList.remove('hidden'); if(title) title.textContent='Pendentes'; }
  if(mode==='trash'){ att.classList.add('hidden'); pend.classList.add('hidden'); trash.classList.remove('hidden'); if(addBtn) addBtn.classList.add('hidden'); if(title) title.textContent='Lixeira'; }
}
function renderPending(){ var host=document.getElementById('pending-list'); if(!host) return; var html=''; (state.pending.items||[]).forEach(function(it, idx){ var name = (typeof it==='string')? it : it.name; var sel = !!state._pendingSelection[name]; html+='<div class="pending-item palette-item'+(sel?' ring-2 ring-blue-500':'')+'" draggable="true" data-name="'+name+'"><span>'+name+'</span><div class="flex items-center gap-1"><button class="text-xs" data-action="pending-find-variants" data-name="'+name+'">🔎</button><button class="text-xs" data-action="pending-remove" data-index="'+idx+'">🗑️</button></div></div>'; }); host.innerHTML = html || '<p class="text-xs text-gray-500">Sem pendências.</p>'; }
function renderTrash(){ var host=document.getElementById('trash-list'); if(!host) return; var arr = (state.trash && Array.isArray(state.trash.classes))? state.trash.classes:[]; var html=''; arr.forEach(function(name){ html+='<div class="trash-item palette-item" draggable="true" data-name="'+name+'"><span>'+name+'</span><div class="flex items-center gap-1"><button class="text-xs" data-action="trash-remove" data-name="'+name+'">🗑️</button></div></div>'; }); host.innerHTML = html || '<p class="text-xs text-gray-500">Lixeira vazia.</p>'; }
function saveTrash(silent){ return axios.put('/api/trash', { classes: state.trash.classes||[] }).then(function(){ if(!silent) alert('Lixeira salva'); }).catch(function(){ if(!silent) alert('Erro salvando lixeira'); }); }
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

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', function(){
  refreshAll();
});

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

function deepMerge(target, src){ if(Array.isArray(src)) return src.slice(); if(src && typeof src==='object'){ var out = (target && typeof target==='object')? JSON.parse(JSON.stringify(target)) : {}; Object.keys(src).forEach(function(k){ out[k]=deepMerge(out[k], src[k]); }); return out; } return src; }
function promoteVariant(dsName, category, currentName, newName){ var ds=state[dsName]; var items=ds.Categories[category]; var item=items[currentName]; if(!item) return;
  pushHistory();
  // Ensure variants is object mapping name -> overrides
  if(Array.isArray(item.variants)){ var mapping={}; item.variants.forEach(function(n){ mapping[n]={}; }); item.variants=mapping; }
  var overrides = (item.variants && item.variants[newName]) ? item.variants[newName] : {};
  // Create clone with overrides applied
  var clone = JSON.parse(JSON.stringify(item));
  // Do not carry the full variants map to the clone; compute new variants for the rename
  delete clone.variants;
  // Apply overrides on clone
  clone = deepMerge(clone, overrides);
  // New item's variants: remove the promoted name and include old name as a variant (empty overrides), preserving rest
  var newVariants = {}; var keys = (item.variants && typeof item.variants==='object')? Object.keys(item.variants):[];
  keys.forEach(function(vn){ if(vn!==newName){ newVariants[vn]=item.variants[vn]; } });
  // Old name becomes a variant of newName with empty or swapped overrides
  newVariants[currentName] = newVariants[currentName] || {};
  // Move key
  items[newName]=clone; delete items[currentName]; items[newName].variants = newVariants;
  if(state.active==='_all'){ state.selected['_all']={ dataset:dsName, category:category, classname:newName }; } else { state.selected[dsName]={category:category, classname:newName}; }
  markDirty(dsName); renderNav(); }

function clearVariantSelection(){ var k=state.active; state.selectedVariant[k] = null; renderNav(); renderEditor(); }

// Make clearVariantSelection available globally
window.clearVariantSelection = clearVariantSelection;

function moveItemToCategory(dsName, fromCategory, classname, toCategory){ if(fromCategory===toCategory) return; var ds=state[dsName]; if(!ds) return; if(!ds.Categories[toCategory]) ds.Categories[toCategory]={}; var items=ds.Categories; if(items[toCategory][classname]){ alert('Já existe item com este classname na categoria destino.'); return; } pushHistory(); items[toCategory][classname]=items[fromCategory][classname]; delete items[fromCategory][classname]; if(state.active==='_all'){ if(state.selected['_all'] && state.selected['_all'].classname===classname){ state.selected['_all']={ dataset: dsName, category: toCategory, classname: classname }; } } else if(state.active===dsName){ if(state.selected[dsName] && state.selected[dsName].classname===classname){ state.selected[dsName]={category:toCategory, classname:classname}; } }
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
  var key = (e.key||'');
  // Undo/Redo keyboard shortcuts (ignore inside inputs/textareas)
  var ae = document.activeElement;
  var inField = ae && (ae.tagName==='INPUT' || ae.tagName==='TEXTAREA' || ae.isContentEditable);
  if(e.ctrlKey && !inField && (key.toLowerCase()==='z') && !e.shiftKey){ e.preventDefault(); undo(); return; }
  if((e.ctrlKey && !inField && (key.toLowerCase()==='y')) || (e.ctrlKey && e.shiftKey && !inField && (key.toLowerCase()==='z'))){ e.preventDefault(); redo(); return; }
  // Save shortcuts
  if(e.ctrlKey && !inField && key.toLowerCase()==='s' && !e.shiftKey){ 
    e.preventDefault(); 
    // Save current dataset (Ctrl+S)
    var ds = state.active;
    if(ds && ds !== '_all' && state[ds] && state.dirty[ds]){
      axios.post(endpoint(ds), state[ds]).then(function(){
        state.dirty[ds] = false;
        updateDirtyIndicator();
        console.log('Dataset '+ds+' salvo com sucesso');
      }).catch(function(err){
        alert('Erro ao salvar '+ds+': '+(err.response?.data?.error || err.message));
      });
    } else {
      alert('Nenhum dataset ativo ou nada para salvar');
    }
    return; 
  }
  if(e.ctrlKey && e.shiftKey && !inField && key.toLowerCase()==='s'){ 
    e.preventDefault(); 
    // Save all datasets (Ctrl+Shift+S)
    var promises = [];
    var hasChanges = false;
    for(var k in state.dirty){
      if(state.dirty[k] && state[k]){
        hasChanges = true;
        promises.push(
          axios.post(endpoint(k), state[k]).then(function(){ return k; })
        );
      }
    }
    if(hasChanges){
      Promise.all(promises).then(function(){
        for(var k in state.dirty) state.dirty[k] = false;
        updateDirtyIndicator();
        console.log('Todos os datasets salvos com sucesso');
      }).catch(function(err){
        alert('Erro ao salvar alguns datasets: '+(err.response?.data?.error || err.message));
      });
    } else {
      alert('Nenhuma alteração para salvar');
    }
    return; 
  }
  // Lock/Unlock with L key
  if(!inField && key.toLowerCase()==='l'){ 
    e.preventDefault(); 
    var sel = getSelected();
    if(!sel) return;
    var lockKey = sel.dataset+'|'+sel.category+'|'+sel.classname;
    state.locked[lockKey] = !state.locked[lockKey];
    renderNav(); 
    return; 
  }
  if(key !== 'Delete') return;
  if(inField) return; // don't interfere with typing
  var sel = getSelected();
  if(!sel) return;
  var ds = sel.dataset, cat = sel.category, cls = sel.classname;
  if(!ds || !state[ds] || !state[ds].Categories || !state[ds].Categories[cat] || !state[ds].Categories[cat][cls]) return;
  pushHistory();
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

// Floating FAB for adding new category to current dataset
var fab = document.getElementById('btn-add-category-fab');
if(fab){ fab.addEventListener('click', function(){ var ds = state.active==='_all' ? null : state.active; if(!ds || !state[ds]){ alert('Selecione um dataset para adicionar categoria.'); return; } var name = (prompt('Nome da nova categoria:')||'').trim(); if(!name) return; var data=state[ds]; if(!data.Categories[name]){ pushHistory(); data.Categories[name]={}; } else { alert('Categoria já existe.'); return; } markDirty(ds); renderNav(); renderCategoryChips(); }); }
