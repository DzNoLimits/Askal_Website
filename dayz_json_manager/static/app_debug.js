// Test version of app.js with debugging
console.log('Script loading started...');

// Basic state
var state = { 
  active: 'weapons', 
  dirty: {}, 
  selected: {}, 
  palette: [], 
  filters: { category: '', flags: [] }, 
  _datasets: [], 
  collapsed: {}, 
  rightTab: 'attachments', 
  pending: { items: [] }, 
  trash: { classes: [] }, 
  _pendingSelection: {}, 
  _history: [], 
  _redo: [], 
  collapsedItems: {} 
};

console.log('State initialized:', state);

function endpoint(kind) { 
  return '/api/' + kind; 
}

function markDirty(kind) { 
  state.dirty[kind] = true; 
  updateDirtyIndicator(); 
}

function updateDirtyIndicator() { 
  var el = document.getElementById('dataset-dirty-indicator'); 
  if (!el) {
    console.warn('dataset-dirty-indicator element not found');
    return;
  }
  var arr = []; 
  for (var k in state.dirty) { 
    if (state.dirty[k]) arr.push(k); 
  } 
  el.textContent = arr.length ? 'Alterações não salvas: ' + arr.join(', ') : ''; 
}

function load(kind) { 
  console.log('Loading dataset:', kind);
  return axios.get(endpoint(kind)).then(function(r) { 
    state[kind] = r.data; 
    state.dirty[kind] = false; 
    if (!(kind in state.selected)) state.selected[kind] = null; 
    console.log('Loaded dataset:', kind, r.data);
  }); 
}

function refreshAll() {
  console.log('refreshAll() called');
  
  var datasetsEl = document.getElementById('dataset-chips');
  var navEl = document.getElementById('nav-pane');
  var editorEl = document.getElementById('editor-pane');
  
  console.log('Elements found:', {
    datasets: !!datasetsEl,
    nav: !!navEl,
    editor: !!editorEl
  });
  
  return axios.get('/api/datasets').then(function(res) {
    var list = Array.isArray(res.data) ? res.data : [];
    state._datasets = list;
    console.log('Datasets loaded:', list);
    
    // Simple render for testing
    if (datasetsEl) {
      datasetsEl.innerHTML = list.map(function(ds) {
        return '<span style="margin-right: 10px; padding: 5px; background: #ccc;">' + ds + '</span>';
      }).join('');
    }
    
    if (navEl) {
      navEl.innerHTML = '<p style="padding: 10px;">Datasets: ' + list.length + '</p>';
    }
    
    if (editorEl) {
      editorEl.innerHTML = '<p style="padding: 10px;">Editor ready. Select an item.</p>';
    }
    
    return Promise.all(list.map(function(k) { return load(k); }));
  }).then(function() {
    console.log('All datasets loaded, state:', state);
    
    // Test variant rendering
    var weapons = state.weapons;
    if (weapons && weapons.Categories) {
      var variantItems = [];
      for (var cat in weapons.Categories) {
        for (var cls in weapons.Categories[cat]) {
          var item = weapons.Categories[cat][cls];
          if (item.variants && typeof item.variants === 'object' && Object.keys(item.variants).length > 0) {
            variantItems.push(cat + '/' + cls + ': ' + Object.keys(item.variants).join(', '));
          }
        }
      }
      
      if (navEl) {
        navEl.innerHTML += '<br><strong>Items with variants:</strong><br>' + variantItems.join('<br>');
      }
      
      console.log('Variant items found:', variantItems);
    }
    
  }).catch(function(err) { 
    console.error('Failed to load datasets:', err); 
    if (navEl) {
      navEl.innerHTML = '<p style="color: red; padding: 10px;">Error: ' + err.message + '</p>';
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM ready, initializing app...');
  refreshAll();
});

console.log('Script loading completed, waiting for DOM...');