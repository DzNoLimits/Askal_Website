// Extracted application logic
// Dynamic datasets: state stores dataset data under state[<datasetName>]
var state = { active: 'weapons', dirty: {}, selected: {}, selectedVariant: {}, palette: [], filters: { category: '', flags: [] }, _datasets: [], collapsed: {}, rightTab: 'attachments', pending: { items: [] }, trash: { classes: [] }, _pendingSelection: {}, _history: [], _redo: [], collapsedItems: {}, locked: {}, multiCategory: {}, _fvPlan: null, clipboard: [], globalLists: {} };
// Helper to build endpoints for dynamic datasets
function endpoint(kind) { return '/api/' + kind; }

function markDirty(kind) { state.dirty[kind] = true; updateDirtyIndicator(); }
function updateDirtyIndicator() { var el = document.getElementById('dataset-dirty-indicator'); var arr = []; for (var k in state.dirty) { if (state.dirty[k]) arr.push(k); } el.textContent = arr.length ? 'Alterações não salvas: ' + arr.join(', ') : ''; }

function load(kind) { return axios.get(endpoint(kind)).then(function (r) { state[kind] = r.data; state.dirty[kind] = false; if (!(kind in state.selected)) state.selected[kind] = null; validateDatasetIntegrity(kind); }); }

// --- Toast notifications ---
function showToast(message, type) {
  try {
    var root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      root.style.position = 'fixed';
      root.style.top = '12px';
      root.style.right = '12px';
      root.style.zIndex = '9999';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.gap = '8px';
      document.body.appendChild(root);
    }
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.minWidth = '240px';
    toast.style.maxWidth = '420px';
    toast.style.padding = '10px 12px';
    toast.style.borderRadius = '6px';
    toast.style.fontSize = '12px';
    toast.style.color = '#fff';
    toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    toast.style.transition = 'opacity .18s ease, transform .18s ease';
    var bg = '#374151';
    if (type === 'success') bg = '#16a34a';
    else if (type === 'error') bg = '#dc2626';
    else if (type === 'warning') bg = '#d97706';
    else if (type === 'info') bg = '#2563eb';
    toast.style.background = bg;
    toast.textContent = message;
    root.appendChild(toast);
    requestAnimationFrame(function () { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    setTimeout(function () { toast.style.opacity = '0'; toast.style.transform = 'translateY(-6px)'; setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 220); }, 3200);
  } catch (_e) {
    // Fallback
    console.log('[toast]', type || 'info', message);
  }

  // --- Global helpers used across editor and DnD ---
  function ensureVariantsObject(it) { if (!it) return {}; if (Array.isArray(it.variants)) { var obj = {}; it.variants.forEach(function (n) { obj[n] = {}; }); it.variants = obj; } else if (!it.variants || typeof it.variants !== 'object') { it.variants = {}; } return it.variants; }
  function validateUniqueClassname(classname, dataset, excludeCategory, excludeClass) {
    if (!classname || !dataset || !state[dataset] || !state[dataset].Categories) return { valid: true };
    var cats = state[dataset].Categories; var conflicts = [];
    Object.keys(cats).forEach(function (catName) {
      if (excludeCategory === catName && excludeClass) return; var items = cats[catName]; Object.keys(items).forEach(function (itemName) {
        if (excludeCategory === catName && excludeClass === itemName) return; if (itemName === classname) { conflicts.push({ type: 'item', category: catName, classname: itemName }); }
        var item = items[itemName]; if (item.variants && typeof item.variants === 'object') { Object.keys(item.variants).forEach(function (variantName) { if (variantName === classname) { conflicts.push({ type: 'variant', category: catName, classname: itemName, variant: variantName }); } }); }
      });
    });
    return { valid: conflicts.length === 0, conflicts: conflicts };
  }
  function generateUniqueClassname(baseName, dataset) { var counter = 1; var testName = baseName; while (!validateUniqueClassname(testName, dataset).valid) { counter++; testName = baseName + '_' + counter; } return testName; }

  // Validate dataset integrity and report conflicts
  function validateDatasetIntegrity(dataset) {
    if (!state[dataset] || !state[dataset].Categories) return;

    var allNames = {};
    var conflicts = [];
    var categories = state[dataset].Categories;

    // Collect all classnames and variant names
    Object.keys(categories).forEach(function (catName) {
      var items = categories[catName];
      Object.keys(items).forEach(function (itemName) {
        // Check main item name
        if (allNames[itemName]) {
          conflicts.push({
            name: itemName,
            existing: allNames[itemName],
            new: { type: 'item', category: catName, classname: itemName }
          });
        } else {
          allNames[itemName] = { type: 'item', category: catName, classname: itemName };
        }

        // Check variants
        var item = items[itemName];
        if (item.variants && typeof item.variants === 'object') {
          Object.keys(item.variants).forEach(function (variantName) {
            if (allNames[variantName]) {
              conflicts.push({
                name: variantName,
                existing: allNames[variantName],
                new: { type: 'variant', category: catName, classname: itemName, variant: variantName }
              });
            } else {
              allNames[variantName] = { type: 'variant', category: catName, classname: itemName, variant: variantName };
            }
          });
        }
      });
    });

    // Report conflicts if any
    if (conflicts.length > 0) {
      console.warn('🚨 Conflitos de classnames detectados em ' + dataset + ':');
      conflicts.forEach(function (conflict) {
        var existingDesc = conflict.existing.type === 'item'
          ? conflict.existing.category + '/' + conflict.existing.classname
          : conflict.existing.category + '/' + conflict.existing.classname + ' (variante: ' + conflict.existing.variant + ')';
        var newDesc = conflict.new.type === 'item'
          ? conflict.new.category + '/' + conflict.new.classname
          : conflict.new.category + '/' + conflict.new.classname + ' (variante: ' + conflict.new.variant + ')';
        console.warn('  ⚠️  "' + conflict.name + '": ' + existingDesc + ' ↔ ' + newDesc);
      });

      // Show user notification
      if (conflicts.length < 10) {
        var message = 'Detectados ' + conflicts.length + ' conflitos de nomes em ' + dataset + ':\n\n';
        conflicts.slice(0, 5).forEach(function (c) {
          message += '• "' + c.name + '"\n';
        });
        if (conflicts.length > 5) message += '• ... e mais ' + (conflicts.length - 5) + ' conflitos\n';
        message += '\nVerifique o console do navegador para detalhes.';
        alert(message);
      }
    } else {
      console.log('✅ Dataset ' + dataset + ' carregado sem conflitos de nomes');
    }
  }
  function refreshAll() {
    return axios.get('/api/datasets').then(function (res) {
      var list = Array.isArray(res.data) ? res.data : [];
      state._datasets = list;
      // Load all datasets in parallel
      return Promise.all(list.map(function (k) { return load(k); }));
    }).then(function () {
      // Load pending store and trash in parallel
      return Promise.all([
        axios.get('/api/pending').then(function (r) { state.pending = r.data || { items: [] }; }).catch(function () { state.pending = { items: [] }; }),
        axios.get('/api/trash').then(function (r) { state.trash = r.data || { classes: [] }; }).catch(function () { state.trash = { classes: [] }; })
      ]);
    }).then(function () {
      // Ensure there is an active dataset selected
      if (!state.active || state._datasets.indexOf(state.active) === -1) {
        state.active = (state._datasets.indexOf('weapons') !== -1) ? 'weapons' : (state._datasets[0] || '');
      }

      renderDatasetChips();
      renderCategoryChips();
      renderFlagsChips();
      buildPalette();
      renderPending();
      renderTrash();
      renderRightTab();

      // NOVO: Usar a nova função de pastas
      forceRenderFolders();

      renderNav();
      renderEditor();
      updateDirtyIndicator();
      applyTheme('dark');
    }).catch(function (err) {
      console.error('Falha ao carregar datasets', err);
    });
  }

  function setActive(tab) {
    console.log('=== SETACTIVE CALLED ===', tab);

    state.active = tab;
    state.filters = { category: '', flags: [] };
    state.multiCategory = {}; // Reset completo

    // Limpar seleções do dataset anterior
    if (state.selected[tab]) {
      state.selected[tab] = null;
    }
    state.selectedVariant[tab] = null;

    // Renderizar na ordem correta
    renderDatasetChips();
    renderCategoryChips();
    renderFlagsChips();

    // NOVO: Renderizar pastas de forma independente e forçada
    forceRenderFolders();

    renderNav();
    renderEditor();
    buildPalette();

    console.log('=== SETACTIVE COMPLETE ===');
  }

  // NOVA função independente para renderizar pastas
  function forceRenderFolders() {
    console.log('=== FORCE RENDER FOLDERS ===', state.active);

    var listEl = document.getElementById('folders-list');
    if (!listEl) {
      console.error('folders-list element not found');
      return;
    }

    // Limpar completamente
    listEl.innerHTML = '';

    // Verificar se temos um dataset válido
    if (state.active === '_all') {
      listEl.innerHTML = '<div class="text-xs text-gray-500 p-2">Modo "All" - selecione um dataset específico</div>';
      return;
    }

    if (!state.active || !state[state.active]) {
      listEl.innerHTML = '<div class="text-xs text-gray-500 p-2">Dataset não carregado</div>';
      return;
    }

    var currentDataset = state[state.active];
    if (!currentDataset.Categories) {
      listEl.innerHTML = '<div class="text-xs text-gray-500 p-2">Dataset sem categorias</div>';
      return;
    }

    var categories = Object.keys(currentDataset.Categories).sort();

    if (categories.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-gray-500 p-2">Nenhuma categoria encontrada</div>';
      return;
    }

    console.log('Rendering categories:', categories);

    // Construir HTML das categorias
    var html = '';
    categories.forEach(function (categoryName) {
      var itemCount = Object.keys(currentDataset.Categories[categoryName] || {}).length;
      var isSelected = !!state.multiCategory[categoryName];

      html += '<div class="folder-row flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ' +
        (isSelected ? 'bg-blue-600 bg-opacity-20 border border-blue-500' : 'hover:bg-gray-200') + '" ' +
        'data-category="' + categoryName + '" data-kind="' + state.active + '">' +
        '<div class="flex items-center gap-2">' +
        '<span class="text-sm font-medium">' + categoryName + '</span>' +
        '<span class="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">' + itemCount + '</span>' +
        '</div>' +
        '<div class="text-xs">' + (isSelected ? '●' : '') + '</div>' +
        '</div>';
    });

    listEl.innerHTML = html;
    console.log('Folders HTML updated, categories count:', categories.length);
  }

  // Substituir completamente a função renderFoldersPane
  function renderFoldersPane() {
    // Simplesmente chama a nova função
    forceRenderFolders();
  }

  // NOVO: Handler simplificado para cliques nas pastas
  document.addEventListener('click', function (e) {
    // ...existing code...

    // NOVO: Handler específico para folder-row
    var folderRow = e.target.closest('.folder-row');
    if (folderRow && folderRow.parentElement && folderRow.parentElement.id === 'folders-list') {
      console.log('Folder row clicked');

      var categoryName = folderRow.dataset.category;
      if (!categoryName) return;

      // Toggle da categoria
      if (state.multiCategory[categoryName]) {
        delete state.multiCategory[categoryName];
      } else {
        state.multiCategory[categoryName] = true;
      }

      console.log('MultiCategory state:', state.multiCategory);

      // Re-renderizar apenas as pastas e navegação
      forceRenderFolders();
      renderNav();
      return;
    }

    // ...existing code...

    if (el.classList.contains('chip')) {
      if (el.dataset.type === 'category') {
        state.filters.category = (state.filters.category === el.dataset.category ? '' : el.dataset.category);
        renderCategoryChips(); renderNav();
      } else if (el.dataset.type === 'category-all') {
        state.filters.category = ''; state.multiCategory = {}; forceRenderFolders(); renderCategoryChips(); renderNav();
      } else if (el.dataset.type === 'flag') {
        var flag = el.dataset.flag; var idx = state.filters.flags.indexOf(flag); if (idx === -1) state.filters.flags.push(flag); else state.filters.flags.splice(idx, 1); renderFlagsChips(); renderNav();
      } else if (el.dataset.type === 'dataset') {
        // CORREÇÃO: Simplificar completamente a troca de dataset
        var newDataset = el.dataset.dataset;
        console.log('Dataset chip clicked:', newDataset);

        // Apenas chamar setActive - ele já faz tudo
        setActive(newDataset);
      }
      return;
    }

    // ...existing code...
  });

  // CORREÇÃO: Simplificar botões das pastas
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'folders-select-all') {
      console.log('Select all folders');
      if (state.active === '_all' || !state[state.active]) return;

      var ds = state[state.active];
      var cats = Object.keys(ds.Categories || {});

      // Selecionar todas as categorias
      state.multiCategory = {};
      cats.forEach(function (c) {
        state.multiCategory[c] = true;
      });

      forceRenderFolders();
      renderNav();
      return;
    }

    if (e.target && e.target.id === 'folders-clear') {
      console.log('Clear all folders');
      state.multiCategory = {};
      forceRenderFolders();
      renderNav();
      return;
    }

    if (e.target && e.target.dataset && e.target.dataset.action === 'add-folder') {
      if (state.active === '_all' || !state[state.active]) {
        alert('Selecione um dataset específico primeiro.');
        return;
      }

      var ds = state[state.active];
      var name = (prompt('Nome da nova pasta:') || '').trim();
      if (!name) return;
      if (ds.Categories[name]) {
        alert('Já existe uma pasta com esse nome.');
        return;
      }

      pushHistory();
      ds.Categories[name] = {};
      markDirty(state.active);
      state.multiCategory[name] = true; // auto-select

      forceRenderFolders();
      renderCategoryChips();
      renderNav();
      showToast('Pasta criada: ' + name, 'success');
      return;
    }
  });

  // Row-click toggles inside folders list
  document.addEventListener('click', function (e) {
    var row = e.target && e.target.closest('.folder-row');
    if (row && row.parentElement && row.parentElement.id === 'folders-list') {
      // Ignore clicks on action buttons inside the row
      if (e.target.closest('button[data-action]')) return;
      var cat = row.dataset.category;
      if (!cat) return;
      if (state.multiCategory[cat]) { delete state.multiCategory[cat]; }
      else { state.multiCategory[cat] = true; }
      renderFoldersPane();
      renderNav();
    }
  });

  // Double-click folder row to open category editor
  document.addEventListener('dblclick', function (e) {
    var row = e.target && e.target.closest('.folder-row');
    if (row && row.parentElement && row.parentElement.id === 'folders-list') {
      var dsK = state.active; var cat = row.dataset.category; var data = state[dsK];
      if (!data || !data.Categories || !data.Categories[cat]) return;
      state.selected[dsK] = { category: cat, classname: '_CATEGORY_' };
      state.selectedVariant[dsK] = null;
      state.rightTab = 'attachments'; renderRightTab(); renderNav(); renderEditor();
    }
  });

  function deepMerge(target, src) { if (Array.isArray(src)) return src.slice(); if (src && typeof src === 'object') { var out = (target && typeof target === 'object') ? JSON.parse(JSON.stringify(target)) : {}; Object.keys(src).forEach(function (k) { out[k] = deepMerge(out[k], src[k]); }); return out; } return src; }
  function promoteVariant(dsName, category, currentName, newName) {
    var ds = state[dsName]; var items = ds.Categories[category]; var item = items[currentName]; if (!item) return;
    pushHistory();
    // Ensure variants is object mapping name -> overrides
    if (Array.isArray(item.variants)) { var mapping = {}; item.variants.forEach(function (n) { mapping[n] = {}; }); item.variants = mapping; }
    var overrides = (item.variants && item.variants[newName]) ? item.variants[newName] : {};
    // Create clone with overrides applied
    var clone = JSON.parse(JSON.stringify(item));
    // Do not carry the full variants map to the clone; compute new variants for the rename
    delete clone.variants;
    // Apply overrides on clone
    clone = deepMerge(clone, overrides);
    // New item's variants: remove the promoted name and include old name as a variant (empty overrides), preserving rest
    var newVariants = {}; var keys = (item.variants && typeof item.variants === 'object') ? Object.keys(item.variants) : [];
    keys.forEach(function (vn) { if (vn !== newName) { newVariants[vn] = item.variants[vn]; } });
    // Old name becomes a variant of newName with empty or swapped overrides
    newVariants[currentName] = newVariants[currentName] || {};
    // Move key
    items[newName] = clone; delete items[currentName]; items[newName].variants = newVariants;
    if (state.active === '_all') { state.selected['_all'] = { dataset: dsName, category: category, classname: newName }; } else { state.selected[dsName] = { category: category, classname: newName }; }
    markDirty(dsName); renderNav();
  }

  function clearVariantSelection() { var k = state.active; state.selectedVariant[k] = null; renderNav(); renderEditor(); }

  // Make clearVariantSelection available globally
  window.clearVariantSelection = clearVariantSelection;

  function moveItemToCategory(dsName, fromCategory, classname, toCategory) {
    if (fromCategory === toCategory) return; var ds = state[dsName]; if (!ds) return; if (!ds.Categories[toCategory]) ds.Categories[toCategory] = {}; var items = ds.Categories; if (items[toCategory][classname]) { alert('Já existe item com este classname na categoria destino.'); return; } pushHistory(); items[toCategory][classname] = items[fromCategory][classname]; delete items[fromCategory][classname]; if (state.active === '_all') { if (state.selected['_all'] && state.selected['_all'].classname === classname) { state.selected['_all'] = { dataset: dsName, category: toCategory, classname: classname }; } } else if (state.active === dsName) { if (state.selected[dsName] && state.selected[dsName].classname === classname) { state.selected[dsName] = { category: toCategory, classname: classname }; } }
    // If user is filtering by multiCategory and destination isn't visible, include it so moved item remains visible
    var activeFilters = Object.keys(state.multiCategory || {}).filter(function (c) { return !!state.multiCategory[c]; });
    if (activeFilters.length > 0 && !state.multiCategory[toCategory]) { state.multiCategory[toCategory] = true; renderFoldersPane(); }
    markDirty(dsName);
    renderFoldersPane(); // NOVO
    renderCategoryChips();
    renderNav();
  }

  // --- Debug and development tools ---
  function dumpState() {
    console.log('--- Estado atual ---');
    console.log(JSON.stringify(state, null, 2));
    console.log('-------------------');
  }
  function loadState(snap) {
    if (!snap) return;
    state = JSON.parse(JSON.stringify(snap));
    // Re-render everything to reflect restored state
    renderDatasetChips(); renderCategoryChips(); renderFlagsChips(); buildPalette(); renderPending(); renderTrash(); renderRightTab(); renderNav(); renderEditor(); updateDirtyIndicator();
  }
  // window.dumpState = dumpState;
  // window.loadState = loadState;

  function lifetimeSlider(val) {
    var presets = state.globalLists && state.globalLists.lifetimePresets ? state.globalLists.lifetimePresets : [
      { label: "0", seconds: 0 }, { label: "5m", seconds: 300 }, { label: "30m", seconds: 1800 },
      { label: "1h", seconds: 3600 }, { label: "2h", seconds: 7200 }, { label: "4h", seconds: 14400 },
      { label: "1d", seconds: 86400 }, { label: "3d", seconds: 259200 }, { label: "7d", seconds: 604800 }
    ];
    var idx = presets.findIndex(function (p) { return p.seconds == val; });
    if (idx === -1) idx = 0;
    var labels = presets.map(function (p) { return '<span>' + p.label + '</span>'; }).join('');
    return '<div><label class="editor-label">Lifetime</label>' +
      '<div class="flex items-center gap-2 mt-1">' +
      '<input data-field="lifetime" type="range" min="0" max="' + (presets.length - 1) + '" step="1" value="' + idx + '" class="flex-1" data-seconds="' + (presets[idx] ? presets[idx].seconds : 0) + '" onchange="var p=' + JSON.stringify(presets) + '[this.value]; if(p){ this.nextElementSibling.textContent=p.label; this.dataset.seconds=p.seconds; }" />' +
      '<span class="text-xs text-gray-300 min-w-[2rem]">' + (presets[idx] ? presets[idx].label : '0') + '</span>' +
      '</div>' +
      '<div class="flex justify-between mt-1 text-[10px] text-gray-400">' + labels + '</div></div>';
  }
  function arrayEditor(label, field, arr) {
    arr = Array.isArray(arr) ? arr : []; var inner = '';
    for (var i = 0; i < arr.length; i++) {
      inner += '<span class="pill" data-index="' + i + '" data-field="' + field + '">' + arr[i] + '<button data-action="remove-pill">×</button></span>';
    }
    // Add suggestions for certain fields based on global lists
    var suggestions = '';
    var globalSuggestions = [];
    if (field === 'tags' && state.globalLists && state.globalLists.tags) globalSuggestions = state.globalLists.tags;
    else if (field === 'usage' && state.globalLists && state.globalLists.usageflags) globalSuggestions = state.globalLists.usageflags;
    else if (field === 'values' && state.globalLists && state.globalLists.valueflags) globalSuggestions = state.globalLists.valueflags;
    if (globalSuggestions.length > 0) {
      suggestions = '<div class="text-[10px] text-gray-400 mt-1">Sugestões: ' + globalSuggestions.slice(0, 5).join(', ') + (globalSuggestions.length > 5 ? ' ...' : '') + '</div>';
    }
    return '<div data-array-field="' + field + '"><label class="editor-label flex items-center justify-between">' + label + '<button data-action="add-pill" data-field="' + field + '" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button></label><div class="mt-1">' + inner + '</div>' + suggestions + '</div>';
  }
  // Variant-aware helpers
  function vNumInput(label, field, val, vn) {
    return '<div><label class="editor-label">' + label + '</label>'
      + '<input data-field="' + field + '" data-variant="' + vn + '" type="number" value="' + (val == null ? '' : val) + '" class="mt-1 w-full border rounded px-2 py-1" />'
      + '</div>';
  }
  function vTextInput(label, field, val, vn) {
    return '<div><label class="editor-label">' + label + '</label>'
      + '<input data-field="' + field + '" data-variant="' + vn + '" type="text" value="' + (val == null ? '' : val) + '" class="mt-1 w-full border rounded px-2 py-1" />'
      + '</div>';
  }

  function vLifetimeSlider(val, vn) {
    var presets = state.globalLists && state.globalLists.lifetimePresets ? state.globalLists.lifetimePresets : [
      { label: "0", seconds: 0 }, { label: "5m", seconds: 300 }, { label: "30m", seconds: 1800 },
      { label: "1h", seconds: 3600 }, { label: "2h", seconds: 7200 }, { label: "4h", seconds: 14400 },
      { label: "1d", seconds: 86400 }, { label: "3d", seconds: 259200 }, { label: "7d", seconds: 604800 }
    ];
    var idx = presets.findIndex(function (p) { return p.seconds == val; });
    if (idx === -1) idx = 0;
    var labels = presets.map(function (p) { return '<span>' + p.label + '</span>'; }).join('');
    return '<div><label class="editor-label">Lifetime</label>' +
      '<div class="flex items-center gap-2 mt-1">' +
      '<input data-field="lifetime" data-variant="' + vn + '" type="range" min="0" max="' + (presets.length - 1) + '" step="1" value="' + idx + '" class="flex-1" data-seconds="' + (presets[idx] ? presets[idx].seconds : 0) + '" onchange="var p=' + JSON.stringify(presets) + '[this.value]; if(p){ this.nextElementSibling.textContent=p.label; this.dataset.seconds=p.seconds; }" />' +
      '<span class="text-xs text-gray-300 min-w-[2rem]">' + (presets[idx] ? presets[idx].label : '0') + '</span>' +
      '</div>' +
      '<div class="flex justify-between mt-1 text-[10px] text-gray-400">' + labels + '</div></div>';
  }
  function vArrayEditor(label, field, arr, vn) {
    arr = Array.isArray(arr) ? arr : []; var inner = '';
    for (var i = 0; i < arr.length; i++) {
      inner += '<span class="pill" data-index="' + i + '" data-field="' + field + '" data-variant="' + vn + '">' + arr[i] + '<button data-action="remove-pill">×</button></span>';
    }
    // Add suggestions for certain fields based on global lists
    var suggestions = '';
    var globalSuggestions = [];
    if (field === 'tags' && state.globalLists && state.globalLists.tags) globalSuggestions = state.globalLists.tags;
    else if (field === 'usage' && state.globalLists && state.globalLists.usageflags) globalSuggestions = state.globalLists.usageflags;
    else if (field === 'values' && state.globalLists && state.globalLists.valueflags) globalSuggestions = state.globalLists.valueflags;
    if (globalSuggestions.length > 0) {
      suggestions = '<div class="text-[10px] text-gray-400 mt-1">Sugestões: ' + globalSuggestions.slice(0, 5).join(', ') + (globalSuggestions.length > 5 ? ' ...' : '') + '</div>';
    }
    return '<div data-array-field="' + field + '" data-variant="' + vn + '"><label class="editor-label flex items-center justify-between">' + label + '<button data-action="add-pill" data-field="' + field + '" data-variant="' + vn + '" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button></label><div class="mt-1">' + inner + '</div>' + suggestions + '</div>';
  }
  function variantsEditor() {
    var vnames = getVariantNames(item); ensureVariantsObject(item); var html = '<div data-field="variants" class="droppable" data-drop-type="variants"><label class="editor-label flex items-center justify-between">Variants <button data-action="variant-add" class="text-xs p-1 rounded hover:bg-gray-700" title="Adicionar variante">➕</button></label><div class="mt-2 space-y-3">';
    vnames.forEach(function (vn) {
      var ov = (item.variants && typeof item.variants === 'object' && item.variants[vn]) ? item.variants[vn] : {}; html += '<div class="border rounded p-2">' +
        '<div class="flex items-center justify-between mb-2">' +
        '<div class="text-xs font-semibold">' + vn + '</div>' +
        '<div class="space-x-1">' +
        '<button class="text-xs p-1 rounded hover:bg-gray-700" title="Editar overrides (JSON)" data-action="variant-edit" data-variant="' + vn + '">✏️</button>' +
        '<button class="text-xs p-1 rounded hover:bg-gray-700" title="Remover variante" data-action="variant-remove" data-variant="' + vn + '">🗑️</button>' +
        '</div>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-2">' +
        vNumInput('Tier', 'tier', ov.tier, vn) +
        vNumInput('Value', 'value', ov.value, vn) +
        (isWeapon ? vNumInput('Chamber Size', 'chamber_size', ov.chamber_size, vn) : '') +
        '</div>' +
        '<div class="mt-2">' +
        '<h5 class="text-xs font-semibold mb-1 text-gray-400">CE Overrides</h5>' +
        '<div class="grid grid-cols-3 gap-2">' +
        vNumInput('Nominal', 'nominal', ov.nominal, vn) +
        vNumInput('Min', 'min', ov.min, vn) +
        vNumInput('QuantMin', 'quantmin', ov.quantmin, vn) +
        '</div>' +
        '<div class="grid grid-cols-3 gap-2 mt-1">' +
        vNumInput('QuantMax', 'quantmax', ov.quantmax, vn) +
        vNumInput('Restock', 'restock', ov.restock, vn) +
        vNumInput('Cost', 'cost', ov.cost, vn) +
        '</div>' +
        '<div class="mt-1">' +
        vLifetimeSlider(ov.lifetime, vn) +
        '</div>' +
        '</div>' +
        (isWeapon ? (
          vArrayEditor('Ammo Types', 'ammo_types', ov.ammo_types, vn) +
          vArrayEditor('Magazines', 'magazines', ov.magazines, vn)
        ) : '') +
        vArrayEditor('Flags', 'flags', ov.flags, vn) +
        '</div>';
    });
    html += '</div><div class="text-xs text-gray-400 mt-2">Dica: arraste um classname do painel esquerdo ou dos Pendentes para adicionar como variante.</div></div>'; return html;
  }
  function attachmentsEditor() { if (isWeapon) { var att = (item.attachments && typeof item.attachments === 'object') ? item.attachments : {}; var html = '<div data-field="attachments"><label class="editor-label flex items-center justify-between">Attachments <button data-action="add-attachment-slot" class="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded">+ Slot</button></label><div class="mt-2 space-y-2">'; Object.keys(att).forEach(function (slot) { var list = att[slot] || []; html += '<div class="border rounded p-2 droppable" data-drop-type="attachment" data-slot="' + slot + '"><div class="flex items-center justify-between mb-1"><strong class="text-xs">' + slot + '</strong><div class="space-x-1"><button data-action="add-nested-pill" data-slot="' + slot + '" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button><button data-action="remove-attachment-slot" data-slot="' + slot + '" class="text-xs bg-red-500 text-white px-2 py-0.5 rounded">x</button></div></div>'; for (var i = 0; i < list.length; i++) { html += '<span class="pill" data-index="' + i + '" data-slot="' + slot + '" data-field="attachments" data-nested="1">' + list[i] + '<button data-action="remove-pill">×</button></span>'; } html += '</div>'; }); html += '</div></div>'; return html; } else { var arr = Array.isArray(item.attachments) ? item.attachments : []; var inner = ''; for (var i = 0; i < arr.length; i++) { inner += '<span class="pill" data-index="' + i + '" data-field="attachments">' + arr[i] + '<button data-action="remove-pill">×</button></span>'; } return '<div data-array-field="attachments" class="droppable" data-drop-type="attachment"><label class="editor-label flex items-center justify-between">Attachments<button data-action="add-pill" data-field="attachments" class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">+</button></label><div class="mt-1">' + inner + '</div></div>'; } }
  if (selectedVariant) {
    // Editing a variant - show variant override editor
    ensureVariantsObject(item); var variant = item.variants[selectedVariant] || {}; var parts = [];
    parts.push('<div class="bg-blue-900 bg-opacity-30 border border-blue-600 rounded p-3 mb-4"><h3 class="text-blue-200 font-semibold mb-2">Editando Variante: ' + selectedVariant + '</h3><p class="text-xs text-blue-300 mb-3">Base: ' + classname + ' | Categoria: ' + category + ' | Dataset: ' + kindActual + '</p><div class="flex space-x-2 mb-2"><button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs flex items-center space-x-1" data-action="nav-variant-edit" data-kind="' + kindActual + '" data-category="' + category + '" data-classname="' + classname + '" data-variant="' + selectedVariant + '" title="Editar overrides (JSON)">✏️ <span>Editar JSON</span></button><button class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs flex items-center space-x-1" data-action="nav-variant-remove" data-kind="' + kindActual + '" data-category="' + category + '" data-classname="' + classname + '" data-variant="' + selectedVariant + '" title="Remover variante">🗑️ <span>Remover</span></button><button class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs flex items-center space-x-1" data-action="nav-variant-promote" data-kind="' + kindActual + '" data-category="' + category + '" data-classname="' + classname + '" data-variant="' + selectedVariant + '" title="Promover variante">⬆️ <span>Promover</span></button><button onclick="clearVariantSelection()" class="bg-gray-600 text-white px-3 py-1 text-xs rounded hover:bg-gray-500">← Voltar ao Item Base</button></div></div>');
    parts.push(textInput('Nome da Variante', '_variant_name', selectedVariant)); parts.push(numInput('Tier Override', 'tier', variant.tier)); parts.push(numInput('Value Override', 'value', variant.value)); parts.push(lifetimeSlider(variant.lifetime)); if (isWeapon) { parts.push(numInput('Chamber Size Override', 'chamber_size', variant.chamber_size)); parts.push(arrayEditor('Ammo Types Override', 'ammo_types', variant.ammo_types)); parts.push(arrayEditor('Magazines Override', 'magazines', variant.magazines)); }
    parts.push(arrayEditor('Flags Override', 'flags', variant.flags));
    if (isWeapon && variant.attachments) { parts.push('<div><label class="editor-label">Attachments Override</label><pre class="mt-1 p-2 bg-gray-800 rounded text-xs">' + JSON.stringify(variant.attachments, null, 2) + '</pre></div>'); }
    pane.innerHTML = '<div class="editor-box space-y-4" data-kind="' + kindActual + '" data-category="' + category + '" data-classname="' + classname + '" data-variant="' + selectedVariant + '">' + parts.join('') + '</div>';
  } else {
    // Editing base item with grouped / efficient layout
    var parts = [];

    // Compute inherited values with proper fallback
    var categoryDefaults = state[kindActual].CategoryDefaults && state[kindActual].CategoryDefaults[category] || {};
    var restockVal = item.restock != null ? item.restock : categoryDefaults.restock;
    var costVal = item.cost != null ? item.cost : categoryDefaults.cost;

    // INFO BLOCK
    var infoBlock = [];
    infoBlock.push(textInput('Classname', '_classname', classname));
    infoBlock.push(numInput('Tier', 'tier', item.tier));
    infoBlock.push(numInput('Value', 'value', item.value));
    parts.push('<div class="border border-gray-700 rounded p-3"><h4 class="text-xs uppercase tracking-wide text-gray-400 mb-2">Info</h4><div class="grid grid-cols-3 gap-2">' + infoBlock.join('') + '</div></div>');

    // CE BLOCK - Fix field rendering
    var ceBlock = [];
    ceBlock.push(numInput('Nominal', 'nominal', item.nominal));
    ceBlock.push(numInput('Min', 'min', item.min));
    ceBlock.push(lifetimeSlider(item.lifetime));
    ceBlock.push(numInput('QuantMin', 'quantmin', item.quantmin));
    ceBlock.push(numInput('QuantMax', 'quantmax', item.quantmax));
    // Make restock/cost editable at item level with inheritance indicator
    ceBlock.push('<div><label class="editor-label">Restock ' +
      (item.restock == null && categoryDefaults.restock != null ? '<span class="text-[10px] text-gray-400">(herdado: ' + categoryDefaults.restock + ')</span>' : '') +
      '</label><input data-field="restock" type="number" value="' + (item.restock != null ? item.restock : '') +
      '" placeholder="' + (categoryDefaults.restock != null ? categoryDefaults.restock : 'default') +
      '" class="mt-1 w-full border rounded px-2 py-1" /></div>');
    ceBlock.push('<div><label class="editor-label">Cost ' +
      (item.cost == null && categoryDefaults.cost != null ? '<span class="text-[10px] text-gray-400">(herdado: ' + categoryDefaults.cost + ')</span>' : '') +
      '</label><input data-field="cost" type="number" value="' + (item.cost != null ? item.cost : '') +
      '" placeholder="' + (categoryDefaults.cost != null ? categoryDefaults.cost : 'default') +
      '" class="mt-1 w-full border rounded px-2 py-1" /></div>');
    parts.push('<div class="border border-gray-700 rounded p-3"><h4 class="text-xs uppercase tracking-wide text-gray-400 mb-2">CE</h4><div class="grid grid-cols-4 gap-2">' + ceBlock.join('') + '</div></div>');

    // WEAPON EXTRA BLOCK
    if (isWeapon) {
      var weaponBlock = [];
      weaponBlock.push(numInput('Chamber Size', 'chamber_size', item.chamber_size));
      weaponBlock.push(arrayEditor('Ammo Types', 'ammo_types', item.ammo_types));
      weaponBlock.push(arrayEditor('Magazines', 'magazines', item.magazines));
      parts.push('<div class="border border-gray-700 rounded p-3"><h4 class="text-xs uppercase tracking-wide text-gray-400 mb-2">Weapon</h4><div class="grid grid-cols-3 gap-2">' + weaponBlock.join('') + '</div></div>');
    }

    // FLAGS BLOCK
    var flagKeys = Object.keys(item.flags || {}).filter(function (k) { return typeof item.flags[k] === 'boolean'; }).sort();
    var flagButtons = flagKeys.map(function (f) { var active = item.flags[f]; return '<button data-action="toggle-flag" data-flag="' + f + '" class="px-2 py-1 text-xs rounded border ' + (active ? 'bg-green-600 border-green-600 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 opacity-70 hover:opacity-100') + '">' + f + '</button>'; }).join(' ');
    var activeFlagList = flagKeys.filter(function (f) { return item.flags[f]; });
    parts.push('<div class="border border-gray-700 rounded p-3"><h4 class="text-xs uppercase tracking-wide text-gray-400 mb-2">Flags</h4><div class="flex flex-wrap gap-1" data-flags-row>' + flagButtons + '</div></div>');

    // META (Tags / Usage / Values)
    var metaBlock = [];
    metaBlock.push(arrayEditor('Tags', 'tags', item.tags));
    metaBlock.push(arrayEditor('Usage', 'usage', item.usage));
    metaBlock.push(arrayEditor('Values', 'values', item.values));
    parts.push('<div class="border border-gray-700 rounded p-3"><h4 class="text-xs uppercase tracking-wide text-gray-400 mb-2">Meta</h4><div class="grid md:grid-cols-3 gap-3">' + metaBlock.join('') + '</div></div>');

    // ATTACHMENTS & VARIANTS remain separate
    parts.push('<div class="border border-gray-700 rounded p-3"><h4 class="text-xs uppercase tracking-wide text-gray-400 mb-2">Attachments</h4>' + attachmentsEditor() + '</div>');
    parts.push('<div class="border border-gray-700 rounded p-3"><h4 class="text-xs uppercase tracking-wide text-gray-400 mb-2">Variants</h4>' + variantsEditor() + '</div>');

    pane.innerHTML = '<div class="editor-box space-y-4" data-kind="' + kindActual + '" data-category="' + category + '" data-classname="' + classname + '">' + parts.join('') + '</div>';
  }
}

function buildPalette() {
  var all = {}; if (state.active === '_all') {
    state._datasets.forEach(function (dsName) { var ds = state[dsName]; if (ds && ds.Categories) { Object.values(ds.Categories).forEach(function (items) { Object.values(items).forEach(function (it) { if (dsName === 'weapons') { var att = it.attachments; if (att && typeof att === 'object') { Object.values(att).forEach(function (arr) { (arr || []).forEach(function (v) { all[v] = true; }); }); } } else { (it.attachments || []).forEach(function (v) { all[v] = true; }); } }); }); } });
  } else {
    var ds = state[state.active]; if (ds && ds.Categories) { Object.values(ds.Categories).forEach(function (items) { Object.values(items).forEach(function (it) { if (state.active === 'weapons') { var att = it.attachments; if (att && typeof att === 'object') { Object.values(att).forEach(function (arr) { (arr || []).forEach(function (v) { all[v] = true; }); }); } } else { (it.attachments || []).forEach(function (v) { all[v] = true; }); } }); }); }
  }
  var list = Object.keys(all).sort(); state.palette = list; var filter = document.getElementById('palette-filter').value.trim().toLowerCase(); var html = ''; list.forEach(function (p) { if (filter && p.toLowerCase().indexOf(filter) === -1) return; html += '<div class="palette-item" draggable="true" data-action="palette-add" data-value="' + p + '"><span>' + p + '</span><span class="text-gray-400 text-xs">+</span></div>'; }); document.getElementById('palette-list').innerHTML = html || '<p class="text-xs text-gray-500">Nenhum attachment.</p>'; document.getElementById('palette-count').textContent = list.length + ' itens';
}

// --- Undo/Redo: snapshot-based history ---
function takeSnapshot() {
  var snap = {
    active: state.active,
    dirty: JSON.parse(JSON.stringify(state.dirty || {})),
    selected: JSON.parse(JSON.stringify(state.selected || {})),
    selectedVariant: JSON.parse(JSON.stringify(state.selectedVariant || {})),
    collapsed: JSON.parse(JSON.stringify(state.collapsed || {})),
    collapsedItems: JSON.parse(JSON.stringify(state.collapsedItems || {})),
    filters: JSON.parse(JSON.stringify(state.filters || {})),
    rightTab: state.rightTab,
    pending: JSON.parse(JSON.stringify(state.pending || { items: [] })),
    trash: JSON.parse(JSON.stringify(state.trash || { classes: [] })),
    datasets: {}
  };
  (state._datasets || []).forEach(function (ds) { snap.datasets[ds] = JSON.parse(JSON.stringify(state[ds] || {})); });
  return snap;
}
function applySnapshot(snap) {
  if (!snap) return;
  state.active = snap.active;
  state.dirty = JSON.parse(JSON.stringify(snap.dirty || {}));
  state.selected = JSON.parse(JSON.stringify(snap.selected || {}));
  state.selectedVariant = JSON.parse(JSON.stringify(snap.selectedVariant || {}));
  state.collapsed = JSON.parse(JSON.stringify(snap.collapsed || {}));
  state.collapsedItems = JSON.parse(JSON.stringify(snap.collapsedItems || {}));
  state.filters = JSON.parse(JSON.stringify(snap.filters || {}));
  state.rightTab = snap.rightTab;
  state.pending = JSON.parse(JSON.stringify(snap.pending || { items: [] }));
  state.trash = JSON.parse(JSON.stringify(snap.trash || { classes: [] }));
  Object.keys(snap.datasets || {}).forEach(function (ds) { state[ds] = JSON.parse(JSON.stringify(snap.datasets[ds])); });
  // Re-render everything to reflect restored state
  renderDatasetChips(); renderCategoryChips(); renderFlagsChips(); buildPalette(); renderPending(); renderTrash(); renderRightTab(); renderNav(); renderEditor(); updateDirtyIndicator();
}
function pushHistory() {
  try {
    var snap = takeSnapshot();
    state._history = state._history || [];
    state._history.push(snap);
    if (state._history.length > 50) state._history.shift();
    // any new mutation invalidates redo stack
    state._redo = [];
  } catch (_e) { /* ignore snapshot errors */ }
}
function undo() {
  if (!state._history || state._history.length === 0) return;
  try {
    var current = takeSnapshot();
    var prev = state._history.pop();
    state._redo = state._redo || [];
    state._redo.push(current);
    if (state._redo.length > 50) state._redo.shift();
    applySnapshot(prev);
  } catch (_e) { /* ignore */ }
}
function redo() {
  if (!state._redo || state._redo.length === 0) return;
  try {
    var current = takeSnapshot();
    var next = state._redo.pop();
    state._history = state._history || [];
    state._history.push(current);
    if (state._history.length > 50) state._history.shift();
    applySnapshot(next);
  } catch (_e) { /* ignore */ }
}

document.addEventListener('click', function (e) {
  console.log('Click detectado em:', e.target, 'Classes:', e.target.className);
  var el = e.target.closest('button, .nav-item, .palette-item, .chip, select.variant-select, #btn-pending-add, #modal-close, #modal-cancel, #modal-apply, #btn-toggle-pending, #btn-toggle-trash, .pending-item, .trash-item');

  // Verificar se clicou numa variante antes de verificar outros elementos
  var vRow = e.target.closest('.nav-variant');
  if (vRow) {
    console.log('Clique em variante detectado primeiro!');
    var action = e.target.closest('[data-action]') ? e.target.closest('[data-action]').dataset.action : null;
    if (!action) {
      console.log('Processando clique na variante (sem ação específica)');
      var kind = state.active;
      var dsV = vRow.dataset.kind || kind;
      var catV = vRow.dataset.category;
      var clsV = vRow.dataset.classname;
      var vnV = vRow.dataset.variant;

      console.log('Selecionando variante:', { dataset: dsV, category: catV, classname: clsV, variant: vnV });

      if (kind === '_all') {
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

  if (!el) return; var action = el.dataset.action; var kind = state.active;
  // Handle flag toggle (item editor base)
  if (action === 'toggle-flag') {
    var flagName = el.dataset.flag;
    // Determine current selection context
    var sel = (kind === '_all') ? state.selected['_all'] : state.selected[kind];
    if (sel && sel.category && sel.classname) {
      var dataSetName = (kind === '_all') ? sel.dataset || kind : kind;
      var ds = dataSetName;
      if (state[ds] && state[ds].Categories && state[ds].Categories[sel.category] && state[ds].Categories[sel.category][sel.classname]) {
        var itm = state[ds].Categories[sel.category][sel.classname];
        if (!itm.flags || typeof itm.flags !== 'object') itm.flags = {};
        var current = !!itm.flags[flagName];
        itm.flags[flagName] = !current;
        // Re-render only the editor (not full navigation) to update button styles
        renderEditor();
        return; // stop further processing for this click
      }
    }
  }
  if (el.classList.contains('chip')) {
    if (el.dataset.type === 'category') {
      state.filters.category = (state.filters.category === el.dataset.category ? '' : el.dataset.category);
      renderCategoryChips(); renderNav();
    } else if (el.dataset.type === 'category-all') {
      state.filters.category = ''; state.multiCategory = {}; renderFoldersPane(); renderCategoryChips(); renderNav();
    } else if (el.dataset.type === 'flag') {
      var flag = el.dataset.flag; var idx = state.filters.flags.indexOf(flag); if (idx === -1) state.filters.flags.push(flag); else state.filters.flags.splice(idx, 1); renderFlagsChips(); renderNav();
    } else if (el.dataset.type === 'dataset') {
      // CORREÇÃO: Melhorar a troca de dataset
      var newDataset = el.dataset.dataset;
      console.log('Switching to dataset:', newDataset);

      // Forçar reset completo do estado visual
      state.multiCategory = {};

      setActive(newDataset);

      // NOVO: Garantir que a interface seja completamente atualizada
      setTimeout(function () {
        renderFoldersPane();
        renderNav();
      }, 100);
    }
    return;
  }
  if (el.id === 'btn-toggle-pending') { state.rightTab = (state.rightTab === 'pending' ? 'attachments' : 'pending'); renderRightTab(); return; }
  if (el.id === 'btn-toggle-trash') { state.rightTab = (state.rightTab === 'trash' ? 'attachments' : 'trash'); renderRightTab(); return; }
  if (el.id === 'btn-pending-add') { openPendingModal(); return; }
  if (el.id === 'modal-close' || el.id === 'modal-cancel') { closePendingModal(); return; }
  if (el.id === 'modal-apply') {
    var txt = document.getElementById('modal-text').value || ''; var lines = txt.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); if (!lines.length) { closePendingModal(); return; }
    var pendingSet = {}; (state.pending.items || []).forEach(function (it) { var n = (typeof it === 'string') ? it : it.name; pendingSet[n] = true; });
    var trashAdd = [];
    lines.forEach(function (n) { if (/_Base|ColorBase/i.test(n)) { trashAdd.push(n); } else { pendingSet[n] = true; } });
    pushHistory();
    state.pending.items = Object.keys(pendingSet).sort().map(function (n) { return { name: n }; });
    var after = Promise.resolve();
    if (trashAdd.length) { after = axios.post('/api/trash', { classes: trashAdd }).catch(function () { }); }
    after.then(function () { savePending(true); closePendingModal(); renderPending(); renderRightTab(); });
    return;
  }
  if (action === 'toggle-category') { var dsT = el.dataset.kind || state.active; var catT = el.dataset.category; if (!state.collapsed[dsT]) state.collapsed[dsT] = {}; state.collapsed[dsT][catT] = !state.collapsed[dsT][catT]; renderNav(); return; }
  if (action === 'toggle-variants') { var dsTV = el.dataset.kind || state.active; var catTV = el.dataset.category; var clsTV = el.dataset.classname; var keyTV = dsTV + '|' + catTV + '|' + clsTV; var cur = (state.collapsedItems[keyTV] !== undefined) ? !!state.collapsedItems[keyTV] : true; state.collapsedItems[keyTV] = !cur; renderNav(); return; }
  // edit-category moved to left pane (double-click on folder row)
  if (action === 'rename-category') { // inline rename (secondary)
    var dsK = el.dataset.kind || state.active; var old = el.dataset.category; var data = state[dsK]; if (!data || !data.Categories || !data.Categories[old]) return; var nn = prompt('Renomear categoria:', old); if (!nn || nn === old) return; if (data.Categories[nn]) { alert('Categoria já existe.'); return; } pushHistory(); data.Categories[nn] = data.Categories[old]; delete data.Categories[old]; if (state.collapsed[dsK] && state.collapsed[dsK][old] != null) { state.collapsed[dsK][nn] = state.collapsed[dsK][old]; delete state.collapsed[dsK][old]; } if (state.filters.category === old) state.filters.category = nn; markDirty(dsK); renderFoldersPane(); renderNav(); return;
  }
  if (action === 'edit-category-presets') { // open category presets editor in right pane
    var dsE = el.dataset.kind || state.active; var catE = el.dataset.category; if (!state[dsE] || !state[dsE].Categories || !state[dsE].Categories[catE]) return; // select first item of category to anchor editor
    var firstItem = Object.keys(state[dsE].Categories[catE])[0]; if (firstItem) { state.selected[dsE] = { category: catE, classname: firstItem }; }
    state.rightTab = 'attachments'; // ensure editor shows
    renderEditor(); // existing category editor accessible via nav? we force item editor + could add a dedicated tab later
    // Additionally inject category editor pane if layout supports a dedicated container
    var catPane = document.getElementById('category-editor-pane'); if (catPane) { renderCategoryEditor(catPane, dsE, catE); setTimeout(function () { catPane.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); }
    showToast && showToast('Editando presets da categoria ' + catE, 'info');
    return;
  }
  if (action === 'hide-category-editor') { var cep = document.getElementById('category-editor-pane'); if (cep) { cep.classList.add('hidden'); } return; }
  if (action === 'save-category-defaults') { var dsS = el.dataset.kind || state.active; var catS = el.dataset.category; var cPane = document.getElementById('category-editor-pane'); if (!cPane) return; var dsObj = state[dsS]; if (!dsObj || !dsObj.Categories || !dsObj.Categories[catS]) return; var restockInput = cPane.querySelector('input[data-field="restock"]'); var costInput = cPane.querySelector('input[data-field="cost"]'); var restockVal = restockInput && restockInput.value !== '' ? parseInt(restockInput.value, 10) : null; var costVal = costInput && costInput.value !== '' ? parseInt(costInput.value, 10) : null; if (!dsObj.CategoryDefaults) dsObj.CategoryDefaults = {}; if (!dsObj.CategoryDefaults[catS]) dsObj.CategoryDefaults[catS] = {}; pushHistory(); if (restockVal == null) { delete dsObj.CategoryDefaults[catS].restock; } else { dsObj.CategoryDefaults[catS].restock = restockVal; } if (costVal == null) { delete dsObj.CategoryDefaults[catS].cost; } else { dsObj.CategoryDefaults[catS].cost = costVal; } markDirty(dsS); showToast && showToast('Presets salvos.', 'success'); renderCategoryEditor('category-editor-pane', dsS, catS); return; }
  if (action === 'clear-category-defaults') { var dsC = el.dataset.kind || state.active; var catC = el.dataset.category; var dsObjC = state[dsC]; if (!dsObjC || !dsObjC.CategoryDefaults || !dsObjC.CategoryDefaults[catC]) return; pushHistory(); delete dsObjC.CategoryDefaults[catC]; markDirty(dsC); showToast && showToast('Overrides limpos.', 'info'); renderCategoryEditor('category-editor-pane', dsC, catC); return; }
  if (action === 'apply-defaults-to-items') { var dsA = el.dataset.kind || state.active; var catA = el.dataset.category; var dsObjA = state[dsA]; if (!dsObjA || !dsObjA.Categories || !dsObjA.Categories[catA]) return; var defaults = (dsObjA.CategoryDefaults && dsObjA.CategoryDefaults[catA]) || {}; if (!Object.keys(defaults).length) { showToast && showToast('Nenhum preset definido para aplicar.', 'warn'); return; } if (!confirm('Aplicar presets a todos os itens da categoria? Isso sobrescreverá valores existentes.')) return; pushHistory(); Object.keys(dsObjA.Categories[catA]).forEach(function (cls) { var it = dsObjA.Categories[catA][cls]; if (defaults.restock != null) it.restock = defaults.restock; if (defaults.cost != null) it.cost = defaults.cost; }); markDirty(dsA); showToast && showToast('Aplicado a todos os itens.', 'success'); renderEditor(); return; }
  if (action === 'variant-add') {
    var sel = getSelected(); if (!sel) return; var ds = sel.dataset; var it = state[ds].Categories[sel.category][sel.classname]; var vname = prompt('Nome da variante (ex: _black):'); if (!vname) return; if (Array.isArray(it.variants)) { it.variants = it.variants.reduce(function (acc, n) { acc[n] = {}; return acc; }, {}); }
    if (!it.variants || typeof it.variants !== 'object') it.variants = {};

    // Check for unique variant name across entire dataset (excluding the item being moved)
    var validation = validateUniqueClassname(vname, ds);
    if (!validation.valid) {
      var conflictDetails = validation.conflicts.map(function (c) {
        if (c.type === 'item') return c.category + '/' + c.classname;
        return c.category + '/' + c.classname + ' (variante: ' + c.variant + ')';
      }).join(', ');

      var uniqueName = generateUniqueClassname(vname, ds);
      if (confirm('Nome "' + vname + '" já existe em: ' + conflictDetails + '.\n\nDeseja usar "' + uniqueName + '" no lugar?')) {
        vname = uniqueName;
      } else {
        return;
      }
    }

    if (it.variants[vname]) { alert('Variante já existe neste item'); return; } pushHistory(); it.variants[vname] = {}; markDirty(ds); renderEditor(); renderNav(); return;
  }
  if (action === 'nav-variant-edit') { var dsN = el.dataset.kind || state.active; var catN = el.dataset.category; var clsN = el.dataset.classname; var vnN = el.dataset.variant; var itN = state[dsN] && state[dsN].Categories && state[dsN].Categories[catN] && state[dsN].Categories[catN][clsN]; if (!itN) return; if (!itN.variants || typeof itN.variants !== 'object') { itN.variants = {}; } var curN = itN.variants[vnN] || {}; var txtN = prompt('Overrides (JSON) para ' + vnN + ':', JSON.stringify(curN)); if (txtN == null) return; try { var objN = JSON.parse(txtN); } catch (eN) { alert('JSON inválido'); return; } pushHistory(); itN.variants[vnN] = objN; markDirty(dsN); renderEditor(); renderNav(); return; }
  if (action === 'nav-variant-promote') { var dsP = el.dataset.kind || state.active; var catP = el.dataset.category; var clsP = el.dataset.classname; var vnP = el.dataset.variant; promoteVariant(dsP, catP, clsP, vnP); renderEditor(); return; }
  if (action === 'nav-variant-remove') { var dsR = el.dataset.kind || state.active; var catR = el.dataset.category; var clsR = el.dataset.classname; var vnR = el.dataset.variant; var itR = state[dsR] && state[dsR].Categories && state[dsR].Categories[catR] && state[dsR].Categories[catR][clsR]; if (!itR || !itR.variants || typeof itR.variants !== 'object') return; pushHistory(); delete itR.variants[vnR]; markDirty(dsR); renderEditor(); renderNav(); return; }
  if (action === 'variant-remove') { var sel2 = getSelected(); if (!sel2) return; var ds2 = sel2.dataset; var it2 = state[ds2].Categories[sel2.category][sel2.classname]; var vname2 = el.dataset.variant; if (!vname2) return; if (!it2.variants || typeof it2.variants !== 'object') return; pushHistory(); delete it2.variants[vname2]; markDirty(ds2); renderEditor(); renderNav(); return; }
  if (action === 'variant-edit') {
    var sel3 = getSelected(); if (!sel3) return; var ds3 = sel3.dataset; var it3 = state[ds3].Categories[sel3.category][sel3.classname]; var vname3 = el.dataset.variant; if (!vname3) return; if (!it3.variants || typeof it3.variants !== 'object') { it3.variants = {}; }
    var cur = it3.variants[vname3] || {}; var txt = prompt('Overrides (JSON). Campos suportados: tier, value, attachments, flags, ammo_types, chamber_size, magazines', JSON.stringify(cur)); if (txt == null) return; try { var obj = JSON.parse(txt); } catch (e2) { alert('JSON inválido'); return; } pushHistory(); it3.variants[vname3] = obj; markDirty(ds3); renderEditor(); renderNav(); return;
  }
  if (action === 'select-item') {
    var ds2 = el.dataset.kind || kind;
    if (kind === '_all') {
      state.selected['_all'] = { dataset: ds2, category: el.dataset.category, classname: el.dataset.classname };
      state.selectedVariant['_all'] = null;
    } else {
      state.selected[kind] = { category: el.dataset.category, classname: el.dataset.classname };
      state.selectedVariant[kind] = null;
      // NOVO: sincronizar folders-pane com a categoria selecionada se não há multi-seleção ativa
      var activeCats = Object.keys(state.multiCategory || {}).filter(function (c) { return !!state.multiCategory[c]; });
      if (activeCats.length === 0 || (activeCats.length === 1 && activeCats[0] !== el.dataset.category)) {
        state.multiCategory = {};
        state.multiCategory[el.dataset.category] = true;
      }
    }
    state.rightTab = 'attachments';
    renderRightTab();
    renderNav();
    renderEditor();
    renderFoldersPane();
    return;
  }

  if (action === 'remove-category') { var cat = el.dataset.category; var dsKey = el.dataset.kind || state.active; if (confirm('Remover categoria ' + cat + '?')) { var names = Object.keys((state[dsKey] && state[dsKey].Categories && state[dsKey].Categories[cat]) || {}); if (names.length) { axios.post('/api/trash', { classes: names }).catch(function () { }); } pushHistory(); delete state[dsKey].Categories[cat]; if (state.collapsed[dsKey]) { delete state.collapsed[dsKey][cat]; } markDirty(dsKey); if (state.active === '_all') { if (state.selected['_all'] && state.selected['_all'].dataset === dsKey && state.selected['_all'].category === cat) state.selected['_all'] = null; } else { if (state.selected[dsKey] && state.selected[dsKey].category === cat) state.selected[dsK] = null; } renderNav(); renderEditor(); renderCategoryChips(); renderFoldersPane(); } return; }
  if (action === 'add-pill') { var field = el.dataset.field; var vn = el.dataset.variant; addArrayValue(field, vn); return; }
  if (action === 'remove-pill') { removeArrayValue(el); return; }
  if (action === 'add-attachment-slot') {
    var sel = getSelected();
    if (!sel) return;
    var ds = sel.dataset;
    var item = state[ds].Categories[sel.category][sel.classname];
    var name = prompt('Nome do slot:');
    if (!name) return;
    pushHistory();
    if (!item.attachments || typeof item.attachments !== 'object') item.attachments = {};
    if (!item.attachments[name]) item.attachments[name] = [];
    // Apenas cria o slot; não adiciona attachment aqui
    markDirty(ds);
    renderEditor();
    buildPalette();
    return;
  }
  if (action === 'add-nested-pill') { var slot = el.dataset.slot; var val = prompt('Novo attachment:'); if (!val) return; var sel2 = getSelected(); if (!sel2) return; var ds2 = sel2.dataset; var item2 = state[ds2].Categories[sel2.category][sel2.classname]; pushHistory(); item2.attachments[slot].push(val.trim()); markDirty(ds2); renderEditor(); buildPalette(); return; }
  if (action === 'remove-attachment-slot') { var slot2 = el.dataset.slot; var sel3 = getSelected(); if (!sel3) return; var ds3 = sel3.dataset; var item3 = state[ds3].Categories[sel3.category][sel3.classname]; pushHistory(); delete item3.attachments[slot2]; markDirty(ds3); renderEditor(); buildPalette(); return; }
  if (action === 'palette-add') { paletteAdd(el.dataset.value); return; }
  if (action === 'pending-remove') { var idx = parseInt(el.dataset.index, 10); pushHistory(); state.pending.items.splice(idx, 1); savePending(true); renderPending(); return; }
  if (action === 'pending-find-variants') { var name = el.dataset.name; findAndFocusVariant(name); return; }
  // Pending multi-select toggle
  var pEl = e.target.closest('.pending-item');
  if (pEl && !action) { var nm = pEl.dataset.name; if (!nm) return; state._pendingSelection[nm] = !state._pendingSelection[nm]; renderPending(); return; }
  // Trash actions
  if (action === 'trash-remove') { var name = el.dataset.name; if (!name) return; var arr = state.trash.classes || []; var idx = arr.indexOf(name); if (idx !== -1) { pushHistory(); arr.splice(idx, 1); saveTrash(true).then(renderTrash); } return; }
});

// Drag & Drop helpers for robust parsing
function _parsePlainDT(e) {
  try {
    var s = e.dataTransfer && e.dataTransfer.getData ? (e.dataTransfer.getData('text/plain') || '') : '';
    if (!s || s[0] !== '{') return null;
    var obj = JSON.parse(s);
    if (obj && obj.__type) return obj;
  } catch (_e) { }
  return null;
}
function _hasDragType(e, type) {
  try {
    var types = e.dataTransfer && e.dataTransfer.types ? Array.from(e.dataTransfer.types) : [];
    if (types.indexOf('text/' + type) !== -1) return true;
    var plain = _parsePlainDT(e);
    if (plain && plain.__type === type) return true;
  } catch (_e) { }
  return false;
}
function _getDragObject(e, type) {
  try {
    var raw = e.dataTransfer.getData('text/' + type);
    if (raw) { try { return JSON.parse(raw); } catch (_e) { /* ignore */ } }
  } catch (_e) { }
  var plain = _parsePlainDT(e);
  if (plain && plain.__type === type) { return plain.data || null; }
  return null;
}

// Drag & Drop
document.addEventListener('dragstart', function (e) {
  try { document.body.classList.add('dnd-mode'); } catch (_e) { }
  // Show clipboard drawer and trash dropbar on any drag start
  try {
    var drawer = document.getElementById('clipboard-drawer');
    if (drawer) { drawer.classList.remove('translate-x-full'); drawer.setAttribute('data-open', 'true'); var btn = document.getElementById('clipboard-toggle'); if (btn) { btn.textContent = '◀'; } }
    var bar = document.getElementById('trash-dropbar'); if (bar) { bar.classList.remove('hidden'); bar.classList.add('flex'); }
  } catch (_e) { }
  var p = e.target.closest('.palette-item');
  if (p && p.dataset.value) {
    e.dataTransfer.setData('text/attachment', p.dataset.value);
    // Plain fallback
    e.dataTransfer.setData('text/plain', JSON.stringify({ __type: 'attachment', data: p.dataset.value }));
    e.dataTransfer.effectAllowed = 'copy';
  }
  var n = e.target.closest('.nav-item');
  if (n) {
    var movePayload = { dataset: n.dataset.kind || state.active, category: n.dataset.category, classname: n.dataset.classname };
    e.dataTransfer.setData('text/move-item', JSON.stringify(movePayload));
    // Plain fallback
    e.dataTransfer.setData('text/plain', JSON.stringify({ __type: 'move-item', data: movePayload }));
    e.dataTransfer.effectAllowed = 'move';
  }
  var pend = e.target.closest('.pending-item');
  if (pend) {
    var selected = Object.keys(state._pendingSelection || {}).filter(function (k) { return !!state._pendingSelection[k]; });
    if (selected.length > 1) {
      e.dataTransfer.setData('text/pending-multi', JSON.stringify(selected));
      e.dataTransfer.setData('text/plain', JSON.stringify({ __type: 'pending-multi', data: selected }));
    } else {
      var pObj = { name: pend.dataset.name };
      e.dataTransfer.setData('text/pending', JSON.stringify(pObj));
      e.dataTransfer.setData('text/plain', JSON.stringify({ __type: 'pending', data: pObj }));
    }
    e.dataTransfer.effectAllowed = 'copy';
  }
  var tr = e.target.closest('.trash-item');
  if (tr) {
    var tObj = { name: tr.dataset.name };
    e.dataTransfer.setData('text/trash', JSON.stringify(tObj));
    e.dataTransfer.setData('text/plain', JSON.stringify({ __type: 'trash', data: tObj }));
    e.dataTransfer.effectAllowed = 'copy';
  }
});
document.addEventListener('dragend', function () { try { document.body.classList.remove('dnd-mode'); } catch (_e) { } });
document.addEventListener('drop', function () { try { document.body.classList.remove('dnd-mode'); } catch (_e) { } });
document.addEventListener('dragend', function () {
  // Hide trash dropbar when drag ends
  var bar = document.getElementById('trash-dropbar'); if (bar) { bar.classList.add('hidden'); bar.classList.remove('flex'); }
});
document.addEventListener('dragover', function (e) {
  // Check for item-to-item drop (create variant) first
  var navItem = e.target.closest('.nav-item');
  if (navItem) {
    e.preventDefault();
    navItem.classList.add('drag-over-variant');
    return; // prevent other zones from stealing hover state
  }

  // Check for drop zones
  var t = e.target.closest('[data-drop-type]');
  if (t) {
    e.preventDefault();
    t.classList.add('drag-over');
  }
});
document.addEventListener('dragleave', function (e) {
  var t = e.target.closest('[data-drop-type]');
  if (t) { t.classList.remove('drag-over'); }

  var navItem = e.target.closest('.nav-item');
  if (navItem) { navItem.classList.remove('drag-over-variant'); }
});
document.addEventListener('drop', function (e) {
  console.log('Drop event triggered on:', e.target);
  try { console.log('DataTransfer types:', e.dataTransfer && e.dataTransfer.types ? Array.from(e.dataTransfer.types) : []); } catch (_e) { }

  // Handle item-to-item drop first (create variant) - highest priority
  var navItem = e.target.closest('.nav-item');
  var draggedInfo = _getDragObject(e, 'move-item');
  if (navItem && draggedInfo) {
    console.log('Processing item-to-item drop');
    e.preventDefault();
    e.stopPropagation();
    navItem.classList.remove('drag-over-variant');

    var targetDs = navItem.dataset.kind || state.active;
    var targetCat = navItem.dataset.category;
    var targetCls = navItem.dataset.classname;

    // Don't allow dropping on self
    if (draggedInfo.dataset === targetDs && draggedInfo.category === targetCat && draggedInfo.classname === targetCls) {
      return;
    }

    // Get target item and make dragged item a variant
    var targetItem = state[targetDs] && state[targetDs].Categories && state[targetDs].Categories[targetCat] && state[targetDs].Categories[targetCat][targetCls];
    if (!targetItem) return;

    ensureVariantsObject(targetItem);
    var variantName = draggedInfo.classname;

    if (targetItem.variants[variantName]) {
      showToast('Variante "' + variantName + '" já existe em ' + targetCls, 'warning');
      return;
    }

    // Check for unique classname across entire dataset (excluding the item being moved)
    var validation = validateUniqueClassname(variantName, targetDs, targetCat, targetCls);
    if (!validation.valid) {
      var conflictDetails = validation.conflicts.map(function (c) {
        if (c.type === 'item') return c.category + '/' + c.classname;
        return c.category + '/' + c.classname + ' (variante: ' + c.variant + ')';
      }).join(', ');

      showToast('Nome "' + variantName + '" já existe em: ' + conflictDetails + '. Não é possível criar a variante com este nome.', 'error');
      return;
    }

    // Confirm action
    if (confirm('Transformar "' + draggedInfo.classname + '" em variante de "' + targetCls + '"?')) {
      pushHistory();

      // Copy source item properties as variant overrides
      var sourceItem = state[draggedInfo.dataset] && state[draggedInfo.dataset].Categories && state[draggedInfo.dataset].Categories[draggedInfo.category] && state[draggedInfo.dataset].Categories[draggedInfo.category][draggedInfo.classname];
      var variantOverrides = {};
      if (sourceItem) {
        if (sourceItem.tier !== targetItem.tier) variantOverrides.tier = sourceItem.tier;
        if (sourceItem.value !== targetItem.value) variantOverrides.value = sourceItem.value;
        if (sourceItem.flags && JSON.stringify(sourceItem.flags) !== JSON.stringify(targetItem.flags)) variantOverrides.flags = sourceItem.flags;
        if (sourceItem.chamber_size !== targetItem.chamber_size) variantOverrides.chamber_size = sourceItem.chamber_size;
        if (sourceItem.ammo_types && JSON.stringify(sourceItem.ammo_types) !== JSON.stringify(targetItem.ammo_types)) variantOverrides.ammo_types = sourceItem.ammo_types;
        if (sourceItem.magazines && JSON.stringify(sourceItem.magazines) !== JSON.stringify(targetItem.magazines)) variantOverrides.magazines = sourceItem.magazines;
      }

      targetItem.variants[variantName] = variantOverrides;

      // Remove source item
      if (state[draggedInfo.dataset] && state[draggedInfo.dataset].Categories && state[draggedInfo.dataset].Categories[draggedInfo.category]) {
        delete state[draggedInfo.dataset].Categories[draggedInfo.category][draggedInfo.classname];
      }

      markDirty(targetDs);
      markDirty(draggedInfo.dataset);
      renderNav();
      renderEditor();
      showToast('Variante "' + variantName + '" criada em "' + targetCls + '"', 'success');
    }
    return;
  }

  var t = e.target.closest('[data-drop-type]'); if (!t) return; var type = t.dataset.dropType;
  if (type === 'clipboard') {
    e.preventDefault(); t.classList.remove('drag-over');
    // Accept move-item, pending, or trash to add to clipboard list (structured)
    var mv = _getDragObject(e, 'move-item');
    var pn = _getDragObject(e, 'pending');
    var tr = _getDragObject(e, 'trash');
    var entry = null;
    if (mv) { entry = { kind: 'move-item', payload: mv, label: (mv.dataset || '') + ':' + mv.category + '/' + mv.classname }; }
    else if (pn) { entry = { kind: 'pending', payload: pn, label: pn.name }; }
    else if (tr) { entry = { kind: 'trash', payload: tr, label: tr.name }; }
    if (entry) {
      var exists = state.clipboard.some(function (x) { return x.kind === entry.kind && JSON.stringify(x.payload) === JSON.stringify(entry.payload); });
      if (!exists) { state.clipboard.push(entry); renderClipboard(); showToast('Adicionado à área de transferência', 'success'); }
    }
    return;
  }
  if (type === 'trashbar') {
    e.preventDefault(); t.classList.remove('drag-over');
    // Accept move-item to delete and send to trash
    var mv4 = _getDragObject(e, 'move-item');
    if (mv4) {
      var ds = mv4.dataset, cat = mv4.category, cls = mv4.classname; if (state[ds] && state[ds].Categories && state[ds].Categories[cat] && state[ds].Categories[cat][cls]) {
        pushHistory(); delete state[ds].Categories[cat][cls]; markDirty(ds); renderNav(); renderEditor(); axios.post('/api/trash', { classes: [cls] }).catch(function () { }); showToast('Movido para Lixeira', 'info');
      }
      // Hide the bar immediately after drop
      var bar = document.getElementById('trash-dropbar'); if (bar) { bar.classList.add('hidden'); bar.classList.remove('flex'); }
      return;
    }
    // Also accept pending to move its name to trash list
    var pn4 = _getDragObject(e, 'pending');
    if (pn4 && pn4.name) {
      axios.post('/api/trash', { classes: [pn4.name] }).catch(function () { }); showToast('Classe adicionada à Lixeira', 'info'); var idx = (state.pending.items || []).findIndex(function (it) { return (typeof it === 'string' ? it : it.name) === pn4.name; }); if (idx !== -1) { state.pending.items.splice(idx, 1); savePending(true); renderPending(); }
      var bar2 = document.getElementById('trash-dropbar'); if (bar2) { bar2.classList.add('hidden'); bar2.classList.remove('flex'); }
      return;
    }
    return;
  }
  if (type === 'attachment') {
    var attVal = _getDragObject(e, 'attachment');
    if (attVal) { e.preventDefault(); t.classList.remove('drag-over'); var val = attVal; var sel = getSelected(); if (!sel) return; var ds = sel.dataset; var item = state[ds].Categories[sel.category][sel.classname]; if (ds === 'weapons') { var slot = t.dataset.slot; if (!slot) { slot = prompt('Slot destino:'); if (!slot) return; } pushHistory(); if (!item.attachments || typeof item.attachments !== 'object') item.attachments = {}; if (!item.attachments[slot]) item.attachments[slot] = []; if (item.attachments[slot].indexOf(val) === -1) item.attachments[slot].push(val); } else { pushHistory(); if (!Array.isArray(item.attachments)) item.attachments = []; if (item.attachments.indexOf(val) === -1) item.attachments.push(val); } markDirty(ds); renderEditor(); buildPalette(); }
  }
  if (type === 'category') {
    var mvInfo = _getDragObject(e, 'move-item');
    if (mvInfo) { e.preventDefault(); t.classList.remove('drag-over'); var targetCat = t.dataset.category; var targetDs = t.dataset.kind || mvInfo.dataset || state.active; moveItemToCategory(targetDs, mvInfo.category, mvInfo.classname, targetCat); showToast('Item movido para ' + targetCat, 'success'); return; }
    var targetCat2 = t.dataset.category; var targetDs2 = t.dataset.kind || state.active;
    var multiObj = _getDragObject(e, 'pending-multi');
    if (multiObj) {
      e.preventDefault(); t.classList.remove('drag-over'); var arr = Array.isArray(multiObj) ? multiObj : [];
      var one = e.dataTransfer.getData('text/pending'); if (one) { try { var o = JSON.parse(one); if (o && o.name && arr.indexOf(o.name) === -1) arr.unshift(o.name); } catch (_e) { } }
      pushHistory();
      arr.forEach(function (nm) { createItemFromPending(nm, targetCat2, targetDs2); }); state._pendingSelection = {}; renderPending(); return;
    }
    var pObj = _getDragObject(e, 'pending');
    if (pObj) { e.preventDefault(); t.classList.remove('drag-over'); pushHistory(); createItemFromPending(pObj.name, targetCat2, targetDs2); return; }
    var trObj = _getDragObject(e, 'trash');
    if (trObj) { e.preventDefault(); t.classList.remove('drag-over'); pushHistory(); restoreFromTrash(trObj.name, targetCat2, targetDs2); return; }
  }
  if (type === 'variants') {
    var sel = getSelected(); if (!sel) { t.classList.remove('drag-over'); return; }
    var ds = sel.dataset; var item = state[ds].Categories[sel.category][sel.classname]; ensureVariantsObject(item);
    // Accept classnames dragged from nav or pending to add as variant name
    var mvInfo2 = _getDragObject(e, 'move-item');
    if (mvInfo2) {
      e.preventDefault(); t.classList.remove('drag-over'); var vname = mvInfo2.classname;
      if (vname && !item.variants[vname]) {
        var validation = validateUniqueClassname(vname, ds, sel.category, sel.classname);
        if (!validation.valid) {
          var conflictDetails = validation.conflicts.map(function (c) {
            if (c.type === 'item') return c.category + '/' + c.classname;
            return c.category + '/' + c.classname + ' (variante: ' + c.variant + ')';
          }).join(', ');
          showToast('Nome "' + vname + '" já existe em: ' + conflictDetails + '. Escolha um nome único para a variante.', 'error');
          return;
        }
        pushHistory(); item.variants[vname] = {}; markDirty(ds); renderEditor(); renderNav();
      } return;
    }
    var pinfo2 = _getDragObject(e, 'pending');
    if (pinfo2) {
      e.preventDefault(); t.classList.remove('drag-over'); var vname2 = pinfo2.name;
      if (vname2 && !item.variants[vname2]) {
        var validation2 = validateUniqueClassname(vname2, ds, sel.category, sel.classname);
        if (!validation2.valid) {
          var conflictDetails2 = validation2.conflicts.map(function (c) {
            if (c.type === 'item') return c.category + '/' + c.classname;
            return c.category + '/' + c.classname + ' (variante: ' + c.variant + ')';
          }).join(', ');
          showToast('Nome "' + vname2 + '" já existe em: ' + conflictDetails2 + '. Escolha um nome único para a variante.', 'error');
          return;
        }
        pushHistory(); item.variants[vname2] = {}; markDirty(ds); renderEditor(); renderNav();
      } return;
    }
  }
  if (type === 'pending-target') {
    var mvInfo3 = _getDragObject(e, 'move-item');
    if (mvInfo3) { e.preventDefault(); t.classList.remove('drag-over'); var nm = mvInfo3.classname; if (!nm) return; var set = {}; (state.pending.items || []).forEach(function (it) { var n = (typeof it === 'string' ? it : it.name); set[n] = true; }); set[nm] = true; pushHistory(); state.pending.items = Object.keys(set).sort().map(function (n) { return { name: n }; }); savePending(true); renderPending(); state.rightTab = 'pending'; renderRightTab(); }
  }
});

function restoreFromTrash(name, targetCategory, targetDataset) {
  if (!name) return; var ds = targetDataset || state.active; if (!ds || !state[ds]) return; var data = state[ds]; if (!data.Categories[targetCategory]) data.Categories[targetCategory] = {};

  // Check for unique classname across entire dataset
  var validation = validateUniqueClassname(name, ds);
  if (!validation.valid) {
    var conflictDetails = validation.conflicts.map(function (c) {
      if (c.type === 'item') return c.category + '/' + c.classname;
      return c.category + '/' + c.classname + ' (variante: ' + c.variant + ')';
    }).join(', ');

    var uniqueName = generateUniqueClassname(name, ds);
    if (confirm('Classname "' + name + '" já existe em: ' + conflictDetails + '.\n\nDeseja restaurar como "' + uniqueName + '"?')) {
      name = uniqueName;
    } else {
      return;
    }
  }
  var base = ds === 'weapons' ? { tier: null, value: null, ammo_types: [], chamber_size: 1, magazines: [], variants: [], attachments: {}, flags: [] } : { tier: null, value: null, variants: [], attachments: [], flags: [] };
  data.Categories[targetCategory][name] = base;
  markDirty(ds);
  renderNav();
  renderEditor();
  renderFoldersPane(); // NOVO: garantir atualização das pastas
  // remove from trash list locally and persist
  var arr = state.trash.classes || []; var idx = arr.indexOf(name); if (idx !== -1) { arr.splice(idx, 1); saveTrash(true).then(renderTrash); }
}

function addArrayValue(field, variantName) {
  var sel = getSelected(); if (!sel) return; var ds = sel.dataset; var item = state[ds].Categories[sel.category][sel.classname]; var val = prompt('Novo valor:'); if (!val) return; var editingVariant = variantName || sel.variant; if (field === 'attachments' && ds === 'weapons' && !editingVariant) { alert('Use slots para armas.'); return; }
  pushHistory();
  if (editingVariant) { // ensure variants map exists
    if (Array.isArray(item.variants)) { item.variants = item.variants.reduce(function (acc, n) { acc[n] = {}; return acc; }, {}); }
    if (!item.variants || typeof item.variants !== 'object') item.variants = {};
    var ov = item.variants[editingVariant] || (item.variants[editingVariant] = {});
    if (!Array.isArray(ov[field])) ov[field] = [];
    if (ov[field].indexOf(val.trim()) === -1) ov[field].push(val.trim());
  } else {
    if (!Array.isArray(item[field])) item[field] = [];
    if (item[field].indexOf(val.trim()) === -1) item[field].push(val.trim());
  }
  markDirty(ds); renderEditor(); buildPalette();
}
function removeArrayValue(el) {
  var pill = el.closest('.pill'); var index = parseInt(pill.dataset.index, 10); var field = pill.dataset.field; var variantName = pill.dataset.variant; var sel = getSelected(); if (!sel) return; var ds = sel.dataset; var item = state[ds].Categories[sel.category][sel.classname]; var editingVariant = variantName || sel.variant; pushHistory(); if (field === 'attachments' && ds === 'weapons' && pill.dataset.nested && !editingVariant) { var slot = pill.dataset.slot; item.attachments[slot].splice(index, 1); } else { if (editingVariant) { if (Array.isArray(item.variants)) { item.variants = item.variants.reduce(function (acc, n) { acc[n] = {}; return acc; }, {}); } if (!item.variants || typeof item.variants !== 'object') item.variants = {}; var ov = item.variants[editingVariant] || {}; if (Array.isArray(ov[field])) ov[field].splice(index, 1); } else { if (Array.isArray(item[field])) item[field].splice(index, 1); } }
  markDirty(ds); renderEditor(); buildPalette();
}
function paletteAdd(value) { var sel = getSelected(); if (!sel) return alert('Selecione um item.'); var ds = sel.dataset; var item = state[ds].Categories[sel.category][sel.classname]; if (ds === 'weapons') { var slot = prompt('Slot destino:'); if (!slot) return; pushHistory(); if (!item.attachments || typeof item.attachments !== 'object') item.attachments = {}; if (!item.attachments[slot]) item.attachments[slot] = []; if (item.attachments[slot].indexOf(value) === -1) item.attachments[slot].push(value); } else { pushHistory(); if (!Array.isArray(item.attachments)) item.attachments = []; if (item.attachments.indexOf(value) === -1) item.attachments.push(value); } markDirty(ds); renderEditor(); buildPalette(); }

document.addEventListener('blur', function (e) {
  var input = e.target; if (!input.matches('[data-field]')) return; var sel = getSelected(); if (!sel) return; var ds = sel.dataset; var category = sel.category, oldClass = sel.classname; var item = state[ds].Categories[category][oldClass]; var field = input.dataset.field; var vn = input.dataset.variant; var selectedVariant = sel.variant; if (field === '_variant_name' && selectedVariant) {
    var newVariantName = input.value.trim(); if (newVariantName && newVariantName !== selectedVariant) {
      if (Array.isArray(item.variants)) { item.variants = item.variants.reduce(function (acc, n) { acc[n] = {}; return acc; }, {}); }
      if (!item.variants || typeof item.variants !== 'object') item.variants = {};

      // Check for unique variant name across entire dataset (excluding current variant)
      var validation = validateUniqueClassname(newVariantName, ds);
      if (!validation.valid) {
        var conflictDetails = validation.conflicts.map(function (c) {
          if (c.type === 'item') return c.category + '/' + c.classname;
          return c.category + '/' + c.classname + ' (variante: ' + c.variant + ')';
        }).join(', ');

        alert('Nome "' + newVariantName + '" já existe em: ' + conflictDetails + '.\n\nEscolha um nome único para a variante.');
        input.value = selectedVariant;
        return;
      }

      if (item.variants[newVariantName]) { alert('Nome de variante já existe neste item'); input.value = selectedVariant; return; } pushHistory(); item.variants[newVariantName] = item.variants[selectedVariant] || {}; delete item.variants[selectedVariant]; state.selectedVariant[state.active] = newVariantName; markDirty(ds); renderNav(); renderEditor(); return;
    }
  } else if (field === '_classname') {
    var newName = input.value.trim(); if (newName && newName !== oldClass) {
      // Check for unique classname across entire dataset (excluding current item)
      var validation = validateUniqueClassname(newName, ds, category, oldClass);
      if (!validation.valid) {
        var conflictDetails = validation.conflicts.map(function (c) {
          if (c.type === 'item') return c.category + '/' + c.classname;
          return c.category + '/' + c.classname + ' (variante: ' + c.variant + ')';
        }).join(', ');
        alert('Classname "' + newName + '" já existe em: ' + conflictDetails + '.\n\nEscolha um nome único.');
        input.value = oldClass;
        return;
      }
      pushHistory(); state[ds].Categories[category][newName] = item; delete state[ds].Categories[category][oldClass]; if (state.active === '_all') { state.selected['_all'] = { dataset: ds, category: category, classname: newName }; } else { state.selected[ds] = { category: category, classname: newName }; }
    }
  } else {
    pushHistory();
    var editingVariant = vn || selectedVariant; // Use explicit variant attribute or selected variant
    if (editingVariant) { // variant override edit
      if (Array.isArray(item.variants)) { item.variants = item.variants.reduce(function (acc, n) { acc[n] = {}; return acc; }, {}); }
      if (!item.variants || typeof item.variants !== 'object') item.variants = {};
      var ov = item.variants[editingVariant] || (item.variants[editingVariant] = {});
      if (input.type === 'range' && field === 'lifetime') {
        // Handle lifetime slider for variants - use data-seconds attribute
        var seconds = input.dataset.seconds ? Number(input.dataset.seconds) : 0;
        if (seconds === item[field]) { delete ov[field]; } else { ov[field] = seconds; }
      } else if (input.type === 'number') {
        var num = input.value === '' ? null : Number(input.value);
        if (num === null) { delete ov[field]; } else { ov[field] = (isNaN(num) ? null : num); }
      } else {
        if (input.value === '') { delete ov[field]; } else { ov[field] = input.value; }
      }
    } else {
      if (input.type === 'range' && field === 'lifetime') {
        // Handle lifetime slider - use data-seconds attribute
        var seconds = input.dataset.seconds ? Number(input.dataset.seconds) : 0;
        item[field] = seconds;
      } else if (input.type === 'number') {
        var num2 = input.value === '' ? null : Number(input.value);
        item[field] = (isNaN(num2) ? null : num2);
      } else {
        item[field] = input.value;
      }
    }
  }
  markDirty(ds); renderNav();
}, true);

document.getElementById('btn-add-item').addEventListener('click', function () { state.rightTab = 'pending'; renderRightTab(); openPendingModal(); });
document.getElementById('btn-add-category').addEventListener('click', function () {
  // Repurpose: create a NEW dataset (.json) instead of a category
  createDatasetFlow();
});
// Find Variants button wiring
var btnFindVar = document.getElementById('btn-find-variants');
if (btnFindVar) {
  btnFindVar.addEventListener('click', function () { openFindVariantsModal(); });
}
// Top bar: + Novo .json
var btnAddDs = document.getElementById('btn-add-dataset');
if (btnAddDs) {
  btnAddDs.addEventListener('click', function () { createDatasetFlow(); });
}
document.getElementById('search').addEventListener('input', function () { renderNav(); });
document.getElementById('palette-filter').addEventListener('input', function () { buildPalette(); });
// Right pane tabs and pending modal
function renderRightTab() {
  var att = document.getElementById('attachments-pane'); var pend = document.getElementById('pending-pane'); var trash = document.getElementById('trash-pane'); var addBtn = document.getElementById('btn-pending-add'); var title = document.getElementById('palette-title');
  var mode = state.rightTab;
  if (mode === 'attachments') { att.classList.remove('hidden'); pend.classList.add('hidden'); trash.classList.add('hidden'); if (addBtn) addBtn.classList.add('hidden'); if (title) title.textContent = 'Attachments'; }
  if (mode === 'pending') { att.classList.add('hidden'); pend.classList.remove('hidden'); trash.classList.add('hidden'); if (addBtn) addBtn.classList.remove('hidden'); if (title) title.textContent = 'Pendentes'; }
  if (mode === 'trash') { att.classList.add('hidden'); pend.classList.add('hidden'); trash.classList.remove('hidden'); if (addBtn) addBtn.classList.add('hidden'); if (title) title.textContent = 'Lixeira'; }
}
function renderPending() { var host = document.getElementById('pending-list'); if (!host) return; var html = ''; (state.pending.items || []).forEach(function (it, idx) { var name = (typeof it === 'string') ? it : it.name; var sel = !!state._pendingSelection[name]; html += '<div class="pending-item palette-item' + (sel ? ' ring-2 ring-blue-500' : '') + '" draggable="true" data-name="' + name + '"><span>' + name + '</span><div class="flex items-center gap-1"><button class="text-xs" data-action="pending-find-variants" data-name="' + name + '">🔎</button><button class="text-xs" data-action="pending-remove" data-index="' + idx + '">🗑️</button></div></div>'; }); host.innerHTML = html || '<p class="text-xs text-gray-500">Sem pendências.</p>'; }
function renderTrash() { var host = document.getElementById('trash-list'); if (!host) return; var arr = (state.trash && Array.isArray(state.trash.classes)) ? state.trash.classes : []; var html = ''; arr.forEach(function (name) { html += '<div class="trash-item palette-item" draggable="true" data-name="' + name + '"><span>' + name + '</span><div class="flex items-center gap-1"><button class="text-xs" data-action="trash-remove" data-name="' + name + '">🗑️</button></div></div>'; }); host.innerHTML = html || '<p class="text-xs text-gray-500">Lixeira vazia.</p>'; }
function saveTrash(silent) { return axios.put('/api/trash', { classes: state.trash.classes || [] }).then(function () { if (!silent) alert('Lixeira salva'); }).catch(function () { if (!silent) alert('Erro salvando lixeira'); }); }
function openPendingModal() { document.getElementById('modal-text').value = ''; document.getElementById('modal-overlay').classList.remove('hidden'); document.getElementById('modal-overlay').classList.add('flex'); }
function closePendingModal() { var m = document.getElementById('modal-overlay'); m.classList.add('hidden'); m.classList.remove('flex'); }
function savePending(silent) { return axios.put('/api/pending', { items: state.pending.items }).then(function () { if (!silent) alert('Pendentes salvos'); }).catch(function () { if (!silent) alert('Erro salvando pendentes'); }); }
function findAndFocusVariant(name) { // simple search by exact classname across datasets
  for (var i = 0; i < state._datasets.length; i++) {
    var ds = state._datasets[i]; var data = state[ds]; if (!data || !data.Categories) continue; var cats = data.Categories; var keys = Object.keys(cats); for (var j = 0; j < keys.length; j++) {
      var cat = keys[j]; var items = cats[cat]; if (items[name]) { state.active = ds; state.selected[ds] = { category: cat, classname: name }; renderDatasetChips(); renderCategoryChips(); renderNav(); renderEditor(); return; } // check variants
      var inames = Object.keys(items);
      for (var k = 0; k < inames.length; k++) { var cls = inames[k]; var item = items[cls]; var vars = Array.isArray(item.variants) ? item.variants : []; if (vars.indexOf(name) !== -1) { state.active = ds; state.selected[ds] = { category: cat, classname: cls }; renderDatasetChips(); renderCategoryChips(); renderNav(); renderEditor(); return; } }
    }
  }
  alert('Não encontrado: ' + name);
}
function createItemFromPending(name, targetCategory, targetDataset) {
  var ds = targetDataset || (state.active === '_all' ? (prompt('Dataset destino (' + state._datasets.join(', ') + '):', (state._datasets.indexOf('weapons') !== -1 ? 'weapons' : state._datasets[0] || '')) || '').trim().toLowerCase() : state.active); if (!ds || !state[ds]) return; var data = state[ds]; if (!data.Categories[targetCategory]) data.Categories[targetCategory] = {};

  // Check for unique classname across entire dataset
  var validation = validateUniqueClassname(name, ds);
  if (!validation.valid) {
    var conflictDetails = validation.conflicts.map(function (c) {
      if (c.type === 'item') return c.category + '/' + c.classname;
      return c.category + '/' + c.classname + ' (variante: ' + c.variant + ')';
    }).join(', ');

    var uniqueName = generateUniqueClassname(name, ds);
    if (confirm('Classname "' + name + '" já existe em: ' + conflictDetails + '.\n\nDeseja usar "' + uniqueName + '" no lugar?')) {
      name = uniqueName;
    } else {
      return;
    }
  }
  var base = ds === 'weapons' ? { tier: null, value: null, ammo_types: [], chamber_size: 1, magazines: [], variants: [], attachments: {}, flags: [] } : { tier: null, value: null, variants: [], attachments: [], flags: [] };
  data.Categories[targetCategory][name] = base;
  markDirty(ds);
  renderNav();
  renderEditor();
  renderFoldersPane();
}

// --- Global shortcuts and commands ---
// dataset chips click handled via document click
document.getElementById('btn-refresh').addEventListener('click', refreshAll);
document.getElementById('btn-save-active').addEventListener('click', function () {
  if (state.active === '_all') {
    var list = state._datasets.slice();
    var chain = Promise.resolve();
    list.forEach(function (k) { chain = chain.then(function () { return save(k); }); });
    chain.then(function () { alert('Salvo'); });
  } else {
    save(state.active);
  }
});
document.getElementById('btn-save-all').addEventListener('click', function () {
  var list = state._datasets.slice();

  var chain = Promise.resolve();
  list.forEach(function (k) { chain = chain.then(function () { return save(k); }); });
  chain.then(function () { alert('Salvo'); });
});
// theme button removed; forced dark applied on init

function save(kind) { if (!state[kind]) return Promise.resolve(); return axios.put(endpoint(kind), { data: state[kind] }).then(function () { state.dirty[kind] = false; updateDirtyIndicator(); if (kind === state.active) alert('Salvo ' + kind); }).catch(function (e) { console.error(e); alert('Erro salvando ' + kind); }); }

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  // Load global lists first
  axios.get('./definitions/lists.json').then(function (r) {
    state.globalLists = r.data || {};
  }).catch(function (e) {
    console.warn('Could not load global lists:', e);
    state.globalLists = { tags: [], usageflags: [], valueflags: [] };
  }).finally(function () {
    refreshAll();
  });
});

// Delete category via Delete key when a category is selected (no modal focused)
document.addEventListener('keydown', function (e) {
  if (e.key === 'Delete' && !e.target.closest('input,textarea')) {
    var kind = state.active;
    if (!kind || kind === '_all') return;
    var sel = state.selected[kind];
    if (sel && sel.category && !sel.classname) { // category row selected (assuming selection model sets classname null when category only)
      if (confirm('Remover categoria ' + sel.category + '? Itens serão perdidos deste dataset (sem enviar para Trash).')) {
        var data = state[kind]; if (data && data.Categories && data.Categories[sel.category]) {
          pushHistory(); delete data.Categories[sel.category]; markDirty(kind); state.selected[kind] = null; renderFoldersPane(); renderNav(); renderEditor();
        }
      }
    }
  }
});

// Helpers for flags and categories chips
// Category chips disabled (using only folders pane for category navigation)
function renderCategoryChips() { var host = document.getElementById('category-chips'); if (host) host.innerHTML = ''; }
function renderFlagsChips() {
  var host = document.getElementById('flags-chips'); if (!host) { return; } var set = {}; if (state.active === '_all') {
    state._datasets.forEach(function (dsName) { var ds = state[dsName]; if (ds && ds.Categories) { Object.values(ds.Categories).forEach(function (items) { Object.values(items).forEach(function (item) { (item.flags || []).forEach(function (f) { set[f] = true; }); }); }); } });
  } else {
    var ds = state[state.active]; if (ds && ds.Categories) { Object.values(ds.Categories).forEach(function (items) { Object.values(items).forEach(function (item) { (item.flags || []).forEach(function (f) { set[f] = true; }); }); }); }
  }
  var flags = Object.keys(set).sort(); var html = ''; flags.forEach(function (f) { var active = state.filters.flags.indexOf(f) !== -1; html += '<div class="chip' + (active ? ' active' : '') + '" data-type="flag" data-flag="' + f + '">' + f + '</div>'; }); host.innerHTML = html;
}
function renderDatasetChips() {
  var host = document.getElementById('dataset-chips'); if (!host) return; var html = ''; if (state._datasets.length > 1) { html += '<div class="chip' + (state.active === '_all' ? ' active' : '') + '" data-type="dataset" data-dataset="_all">All</div>'; }
  state._datasets.forEach(function (ds) { var label = ds.charAt(0).toUpperCase() + ds.slice(1); html += '<div class="chip' + (state.active === ds ? ' active' : '') + '" data-type="dataset" data-dataset="' + ds + '">' + label + '</div>'; });
  host.innerHTML = html || '<div class="text-xs text-gray-500">Nenhum dataset encontrado</div>';
}

// Leftmost Folders (Categories) Pane
function renderFoldersPane() {
  var pane = document.getElementById('folders-pane');
  var listEl = document.getElementById('folders-list');
  if (!pane || !listEl) { return; }

  // Only show for a concrete dataset (not _all)
  if (state.active === '_all' || !state[state.active]) {
    listEl.innerHTML = '<div class="text-xs text-gray-500">Selecione um dataset</div>';
    return;
  }

  var ds = state[state.active];
  if (!ds || !ds.Categories) {
    listEl.innerHTML = '<div class="text-xs text-gray-500">Dataset vazio ou sem categorias</div>';
    return;
  }

  var cats = Object.keys(ds.Categories || {}).sort();
  var html = '';

  // CORREÇÃO: Verificar se há categorias antes de renderizar
  if (cats.length === 0) {
    listEl.innerHTML = '<div class="text-xs text-gray-500">Sem categorias neste dataset</div>';
    return;
  }

  cats.forEach(function (cat) {
    var selected = !!state.multiCategory[cat];
    html += '<div class="folder-row flex items-center gap-2 px-2 py-1 rounded ' + (selected ? 'bg-blue-900 bg-opacity-30' : 'hover:bg-gray-100') + ' droppable" data-drop-type="category" data-kind="' + state.active + '" data-category="' + cat + '">'
      + '<span class="text-sm flex-1 cursor-pointer" data-action="edit-category-presets" data-kind="' + state.active + '" data-category="' + cat + '" title="Editar presets da categoria">' + cat + '</span>'
      + (selected ? '<span class="text-xs text-blue-300 mr-1">●</span>' : '')
      + '<div class="flex items-center gap-1">'
      + '<button class="text-xs text-indigo-400 hover:text-indigo-200" title="Editar presets" data-action="edit-category-presets" data-kind="' + state.active + '" data-category="' + cat + '">⚙️</button>'
      + '<button class="text-xs text-gray-500 hover:text-gray-800" title="Renomear" data-action="rename-category" data-kind="' + state.active + '" data-category="' + cat + '">✏️</button>'
      + '</div>'
      + '</div>';
  });

  listEl.innerHTML = html;

  // NOVO: Debug logging para troubleshooting
  console.log('Folders rendered for dataset:', state.active, 'Categories:', cats.length);
}

// Folders toolbar buttons
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'folders-select-all') {
    if (state.active === '_all' || !state[state.active]) return;
    var ds = state[state.active]; var cats = Object.keys(ds.Categories || {});
    state.multiCategory = {}; cats.forEach(function (c) { state.multiCategory[c] = true; });
    renderFoldersPane(); renderNav();
    return;
  }
  if (e.target && e.target.id === 'folders-clear') {
    state.multiCategory = {}; renderFoldersPane(); renderNav(); return;
  }
  if (e.target && e.target.dataset && e.target.dataset.action === 'add-folder') {
    if (state.active === '_all' || !state[state.active]) { alert('Selecione um dataset específico primeiro.'); return; }
    var ds = state[state.active];
    var name = (prompt('Nome da nova pasta:') || '').trim();
    if (!name) return;
    if (ds.Categories[name]) { alert('Já existe uma pasta com esse nome.'); return; }
    pushHistory();
    ds.Categories[name] = {};
    markDirty(state.active);
    state.multiCategory[name] = true; // auto-select
    renderFoldersPane();
    renderCategoryChips();
    renderNav();
    showToast('Pasta criada: ' + name, 'success');
    return;
  }
});

// Row-click toggles inside folders list
document.addEventListener('click', function (e) {
  var row = e.target && e.target.closest('.folder-row');
  if (row && row.parentElement && row.parentElement.id === 'folders-list') {
    // Ignore clicks on action buttons inside the row
    if (e.target.closest('button[data-action]')) return;
    var cat = row.dataset.category;
    if (!cat) return;
    if (state.multiCategory[cat]) { delete state.multiCategory[cat]; }
    else { state.multiCategory[cat] = true; }
    renderFoldersPane();
    renderNav();
  }
});

// Double-click folder row to open category editor
document.addEventListener('dblclick', function (e) {
  var row = e.target && e.target.closest('.folder-row');
  if (row && row.parentElement && row.parentElement.id === 'folders-list') {
    var dsK = state.active; var cat = row.dataset.category; var data = state[dsK];
    if (!data || !data.Categories || !data.Categories[cat]) return;
    state.selected[dsK] = { category: cat, classname: '_CATEGORY_' };
    state.selectedVariant[dsK] = null;
    state.rightTab = 'attachments'; renderRightTab(); renderNav(); renderEditor();
  }
});

function deepMerge(target, src) { if (Array.isArray(src)) return src.slice(); if (src && typeof src === 'object') { var out = (target && typeof target === 'object') ? JSON.parse(JSON.stringify(target)) : {}; Object.keys(src).forEach(function (k) { out[k] = deepMerge(out[k], src[k]); }); return out; } return src; }
function promoteVariant(dsName, category, currentName, newName) {
  var ds = state[dsName]; var items = ds.Categories[category]; var item = items[currentName]; if (!item) return;
  pushHistory();
  // Ensure variants is object mapping name -> overrides
  if (Array.isArray(item.variants)) { var mapping = {}; item.variants.forEach(function (n) { mapping[n] = {}; }); item.variants = mapping; }
  var overrides = (item.variants && item.variants[newName]) ? item.variants[newName] : {};
  // Create clone with overrides applied
  var clone = JSON.parse(JSON.stringify(item));
  // Do not carry the full variants map to the clone; compute new variants for the rename
  delete clone.variants;
  // Apply overrides on clone
  clone = deepMerge(clone, overrides);
  // New item's variants: remove the promoted name and include old name as a variant (empty overrides), preserving rest
  var newVariants = {}; var keys = (item.variants && typeof item.variants === 'object') ? Object.keys(item.variants) : [];
  keys.forEach(function (vn) { if (vn !== newName) { newVariants[vn] = item.variants[vn]; } });
  // Old name becomes a variant of newName with empty or swapped overrides
  newVariants[currentName] = newVariants[currentName] || {};
  // Move key
  items[newName] = clone; delete items[currentName]; items[newName].variants = newVariants;
  if (state.active === '_all') { state.selected['_all'] = { dataset: dsName, category: category, classname: newName }; } else { state.selected[dsName] = { category: category, classname: newName }; }
  markDirty(dsName); renderNav();
}

function clearVariantSelection() { var k = state.active; state.selectedVariant[k] = null; renderNav(); renderEditor(); }

// Make clearVariantSelection available globally
window.clearVariantSelection = clearVariantSelection;

function moveItemToCategory(dsName, fromCategory, classname, toCategory) {
  if (fromCategory === toCategory) return; var ds = state[dsName]; if (!ds) return; if (!ds.Categories[toCategory]) ds.Categories[toCategory] = {}; var items = ds.Categories; if (items[toCategory][classname]) { alert('Já existe item com este classname na categoria destino.'); return; } pushHistory(); items[toCategory][classname] = items[fromCategory][classname]; delete items[fromCategory][classname]; if (state.active === '_all') { if (state.selected['_all'] && state.selected['_all'].classname === classname) { state.selected['_all'] = { dataset: dsName, category: toCategory, classname: classname }; } } else if (state.active === dsName) { if (state.selected[dsName] && state.selected[dsName].classname === classname) { state.selected[dsName] = { category: toCategory, classname: classname }; } }
  // If user is filtering by multiCategory and destination isn't visible, include it so moved item remains visible
  var activeFilters = Object.keys(state.multiCategory || {}).filter(function (c) { return !!state.multiCategory[c]; });
  if (activeFilters.length > 0 && !state.multiCategory[toCategory]) { state.multiCategory[toCategory] = true; renderFoldersPane(); }
  markDirty(dsName);
  renderFoldersPane(); // NOVO
  renderCategoryChips();
  renderNav();
}

// --- Debug and development tools ---
function dumpState() {
  console.log('--- Estado atual ---');
  console.log(JSON.stringify(state, null, 2));
  console.log('-------------------');
}
function loadState(snap) {
  if (!snap) return;
  state = JSON.parse(JSON.stringify(snap));
  // Re-render everything to reflect restored state
  renderDatasetChips(); renderCategoryChips(); renderFlagsChips(); buildPalette(); renderPending(); renderTrash(); renderRightTab(); renderNav(); renderEditor(); updateDirtyIndicator();
}
// window.dumpState = dumpState;
// window.loadState = loadState;
