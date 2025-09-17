// editor.js - Economy item editor UI
// Responsibilities: render form, bind events, integrate with EconomyParser, export types.xml

(function(global){
  var lists = null;
  var jsonState = null; // in-memory JSON (source of truth) loaded from itens.json

  function $(sel){ return document.querySelector(sel); }
  function el(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }

  function loadLists(){
    return fetch('definitions/lists.json').then(r=>r.json()).then(function(j){ lists=j; return j; });
  }
  function loadJson(){
    return fetch('/api/economy').then(r=>r.json()).then(function(j){ jsonState=j; EconomyParser.loadJson(j); return j; });
  }

  function formatSecondsLabel(sec){
    if(sec===0) return '0';
    if(sec<3600) return Math.round(sec/60)+'m';
    if(sec<86400) return (sec/3600)+'h';
    if(sec<2592000) return (sec/86400)+'d';
    return (sec/2592000)+'mês';
  }

  function buildLifetimeSlider(current){
    var presets = (lists && lists.lifetimePresets)||[];
    var container = el('div','mb-3');
    container.innerHTML = '<label class="text-xs font-semibold block mb-1">Lifetime</label>';
    var sliderWrap = el('div','flex items-center gap-2');
    var input = el('input');
    input.type='range';
    input.min=0; input.max=presets.length-1; input.step=1;
    var idx = presets.findIndex(p=>p.seconds===current); if(idx===-1) idx=0; input.value=idx;
    var valLabel = el('span','text-xs text-gray-300'); valLabel.textContent=presets[idx]? presets[idx].label: '0';
    input.addEventListener('input', function(){ var p=presets[parseInt(input.value,10)]; if(p){ valLabel.textContent=p.label; input.dataset.seconds=p.seconds; }});
    input.dataset.seconds = presets[idx]? presets[idx].seconds:0;
    sliderWrap.appendChild(input); sliderWrap.appendChild(valLabel);
    // scale labels
    var labels = el('div','flex justify-between mt-1 text-[10px] text-gray-400');
    labels.innerHTML = presets.map(p=>'<span>'+p.label+'</span>').join('');
    container.appendChild(sliderWrap); container.appendChild(labels);
    return container;
  }

  function buildMultiSelect(label, field, options, selected){
    selected = Array.isArray(selected)? selected:[];
    var wrapper = el('div','mb-3');
    wrapper.innerHTML = '<label class="text-xs font-semibold block mb-1">'+label+'</label>';
    var box = el('div','grid grid-cols-2 gap-1');
    options.forEach(function(opt){
      var id = field+'_'+opt;
      var lbl = el('label','flex items-center gap-1 text-[11px] bg-gray-700 px-2 py-1 rounded cursor-pointer');
      var cb = el('input'); cb.type='checkbox'; cb.value=opt; cb.checked = selected.indexOf(opt)!==-1; cb.dataset.field=field; cb.className='economy-ms';
      lbl.appendChild(cb); lbl.appendChild(document.createTextNode(opt));
      box.appendChild(lbl);
    });
    wrapper.appendChild(box);
    return wrapper;
  }

  function buildFlags(flags){
    flags = flags || { count_in_map:1, deloot:0 };
    var wrap = el('div','mb-3');
    wrap.innerHTML = '<label class="text-xs font-semibold block mb-1">Flags</label>';
    var row = el('div','flex gap-4');
    var count = el('div','text-[11px] flex items-center gap-1');
    count.innerHTML = '<input type="checkbox" checked disabled class="opacity-70" /> <span>count_in_map (1)</span>';
    var deloot = el('div','text-[11px] flex items-center gap-1');
    deloot.innerHTML = '<input type="checkbox" '+(flags.deloot? 'checked':'')+' data-flag="deloot" /> <span>deloot</span>';
    row.appendChild(count); row.appendChild(deloot); wrap.appendChild(row);
    return wrap;
  }

  function buildNumber(label, field, value){
    var w = el('div','mb-3');
    w.innerHTML = '<label class="text-xs font-semibold block mb-1">'+label+'</label><input type="number" class="w-full economy-num bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs" data-field="'+field+'" value="'+(value!=null? value:'')+'" />';
    return w;
  }

  function buildItemForm(name, data){
    var form = el('div','p-3 bg-gray-900 rounded-md shadow-inner');
    form.dataset.item=name;
    form.appendChild(el('h3','text-sm font-semibold mb-2 text-blue-300')).textContent=name;
    form.appendChild(buildNumber('Nominal','nominal',data.nominal));
    form.appendChild(buildNumber('Min','min',data.min));
    form.appendChild(buildNumber('Restock (override)','restock',data.restock));
    form.appendChild(buildNumber('Cost (override)','cost',data.cost));
    form.appendChild(buildNumber('Quant Min','quantmin',data.quantmin));
    form.appendChild(buildNumber('Quant Max','quantmax',data.quantmax));
    form.appendChild(buildLifetimeSlider(data.lifetime));
    form.appendChild(buildFlags(data.flags));
    form.appendChild(buildMultiSelect('Tags','tag', lists.tags||[], data.tag));
    form.appendChild(buildMultiSelect('Usage','usage', lists.usageflags||[], data.usage));
    form.appendChild(buildMultiSelect('Value','value', lists.valueflags||[], data.value));
    // Category (single) - using select for now
    var catWrap = el('div','mb-3');
    var sel = el('select'); sel.className='w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs'; sel.dataset.field='category';
    (lists.categories||[]).forEach(function(c){ var o=el('option'); o.value=c; o.textContent=c; if(data.category===c) o.selected=true; sel.appendChild(o); });
    catWrap.innerHTML='<label class="text-xs font-semibold block mb-1">Categoria</label>';
    catWrap.appendChild(sel); form.appendChild(catWrap);
    // Comment/help icon
    if(data.comment){ var help=el('div','text-[10px] text-gray-400 italic mt-1'); help.textContent=data.comment; form.appendChild(help); }
    return form;
  }

  function renderList(){
    var host = $('#economy-items'); if(!host) return;
    host.innerHTML='';
    var items = EconomyParser.state.items;
    Object.keys(items).sort().forEach(function(name){ host.appendChild(buildItemForm(name, items[name])); });
  }

  function collectForm(){
    var items = EconomyParser.state.items;
    document.querySelectorAll('#economy-items > div[data-item]').forEach(function(box){
      var name = box.dataset.item; var it = items[name]; if(!it) return;
      box.querySelectorAll('input.economy-num').forEach(function(inp){ var f=inp.dataset.field; var v=inp.value.trim(); it[f] = v===''? null: parseInt(v,10); });
      // slider lifetime
      var slider = box.querySelector('input[type=range]'); if(slider){ it.lifetime = parseInt(slider.dataset.seconds||'0',10); }
      // flags
      var deloot = box.querySelector('input[data-flag=deloot]'); if(deloot){ it.flags = it.flags||{}; it.flags.count_in_map=1; it.flags.deloot = deloot.checked?1:0; }
      // category
      var cat = box.querySelector('select[data-field=category]'); if(cat){ it.category = cat.value; }
      // multi-selects
      ['tag','usage','value'].forEach(function(f){
        var arr=[]; box.querySelectorAll('input.economy-ms[data-field='+f+']').forEach(function(cb){ if(cb.checked) arr.push(cb.value); });
        it[f]=arr;
      });
    });
  }

  function bindGlobalButtons(){
    var exportBtn = $('#btn-export-types'); if(exportBtn){ exportBtn.addEventListener('click', function(){ collectForm(); var xml = EconomyParser.toTypesXml(); downloadText('types.xml', xml); }); }
    var importInput = $('#import-types-xml'); if(importInput){ importInput.addEventListener('change', function(){ var f=this.files[0]; if(!f) return; var rd=new FileReader(); rd.onload=function(){ try{ EconomyParser.fromTypesXml(rd.result); renderList(); alert('Importado.'); }catch(e){ alert(e.message); } }; rd.readAsText(f); }); }
  var saveJsonBtn = $('#btn-save-json-economy'); if(saveJsonBtn){ saveJsonBtn.addEventListener('click', function(){ collectForm(); var data = EconomyParser.buildJson(); fetch('/api/economy', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)}).then(r=>{ if(!r.ok) throw new Error('Falha ao salvar'); return r.json(); }).then(()=>{ downloadText('itens.json', JSON.stringify(data, null, 2)); alert('Economia salva (servidor + download)'); }).catch(e=>alert(e.message)); }); }
  }

  function downloadText(filename, text){
    var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }

  function init(){
    var root = document.getElementById('economy-editor-root'); if(!root) return;
    Promise.all([loadLists(), loadJson()]).then(function(){ renderList(); bindGlobalButtons(); });
  }

  document.addEventListener('DOMContentLoaded', init);

  global.EconomyEditor = { refresh: function(){ loadJson().then(renderList); } };
})(window);
