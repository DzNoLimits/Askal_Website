// parser.js - Responsible for converting JSON <-> DayZ XML formats (types.xml, etc.)
// Public API:
//   EconomyParser.loadJson(jsonObj)
//   EconomyParser.toTypesXml()
//   EconomyParser.fromTypesXml(xmlString)
//   (stubs) toEventsXml(), toCfgSpawnableTypesXml()

(function(global){
  var EconomyParser = {
    state: { items: {}, defaults: {}, meta: {} },

    loadJson: function(json){
      this.state.items = JSON.parse(JSON.stringify(json.items||{}));
      this.state.defaults = JSON.parse(JSON.stringify(json.defaults||{}));
      this.state.meta = JSON.parse(JSON.stringify(json.meta||{}));
    },

    buildJson: function(){
      return {
        meta: this.state.meta,
        defaults: this.state.defaults,
        items: this.state.items
      };
    },

    // Convert current state to types.xml content
    toTypesXml: function(){
      var lines = [];
      lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
      lines.push('<types>');
      var items = this.state.items;
      Object.keys(items).sort().forEach(function(name){
        var it = items[name];
        lines.push('  <type name="'+name+'">');
        // Basic numeric params
        if(it.nominal != null) lines.push('    <nominal>'+it.nominal+'</nominal>');
        if(it.lifetime != null) lines.push('    <lifetime>'+it.lifetime+'</lifetime>');
        if(it.restock != null) lines.push('    <restock>'+it.restock+'</restock>');
        if(it.min != null) lines.push('    <min>'+it.min+'</min>');
        if(it.quantmin != null) lines.push('    <quantmin>'+it.quantmin+'</quantmin>');
        if(it.quantmax != null) lines.push('    <quantmax>'+it.quantmax+'</quantmax>');
        if(it.cost != null) lines.push('    <cost>'+it.cost+'</cost>');
        // Flags block
        var flags = it.flags || {}; // count_in_map, deloot
        var flagAttrs = ['count_in_map','deloot'].map(function(f){ return f+'="'+(flags[f]!=null? flags[f]: (f==='count_in_map'?1:0))+'"'; }).join(' ');
        lines.push('    <flags '+flagAttrs+' />');
        // Category
        if(it.category){ lines.push('    <category name="'+it.category+'" />'); }
        // Tag(s)
        (it.tag||[]).forEach(function(t){ lines.push('    <tag name="'+t+'" />'); });
        // Usage(s)
        (it.usage||[]).forEach(function(u){ lines.push('    <usage name="'+u+'" />'); });
        // Value(s)
        (it.value||[]).forEach(function(v){ lines.push('    <value name="'+v+'" />'); });
        // Optional comment (as XML comment)
        if(it.comment){ lines.push('    <!-- '+escapeXmlComment(it.comment)+' -->'); }
        lines.push('  </type>');
      });
      lines.push('</types>');
      return lines.join('\n');
    },

    fromTypesXml: function(xmlString){
      // Minimal DOM parse (browser context assumed)
      var parser = new DOMParser();
      var doc = parser.parseFromString(xmlString, 'application/xml');
      if(doc.querySelector('parsererror')){
        throw new Error('Erro ao parsear XML');
      }
      var out = {};
      doc.querySelectorAll('type').forEach(function(node){
        var name = node.getAttribute('name');
        if(!name) return;
        var it = {};
        function gi(tag){ var el=node.querySelector(tag); return el? parseInt(el.textContent.trim(),10): undefined; }
        it.nominal = gi('nominal');
        it.lifetime = gi('lifetime');
        it.restock = gi('restock');
        it.min = gi('min');
        it.quantmin = gi('quantmin');
        it.quantmax = gi('quantmax');
        it.cost = gi('cost');
        var flagsNode = node.querySelector('flags');
        it.flags = {
          count_in_map: flagsNode? parseInt(flagsNode.getAttribute('count_in_map')||'1',10):1,
          deloot: flagsNode? parseInt(flagsNode.getAttribute('deloot')||'0',10):0
        };
        var catNode = node.querySelector('category');
        if(catNode){ it.category = catNode.getAttribute('name'); }
        it.tag = Array.from(node.querySelectorAll('tag')).map(function(n){ return n.getAttribute('name'); });
        it.usage = Array.from(node.querySelectorAll('usage')).map(function(n){ return n.getAttribute('name'); });
        it.value = Array.from(node.querySelectorAll('value')).map(function(n){ return n.getAttribute('name'); });
        // Extract comment if present (approximation)
        var childNodes = node.childNodes;
        for(var i=0;i<childNodes.length;i++){
          var c=childNodes[i];
            if(c.nodeType===8){ // Comment
              it.comment = c.nodeValue.trim();
            }
        }
        out[name]=it;
      });
      this.state.items = out;
      return out;
    },

    toEventsXml: function(){ return '<events><!-- TODO --></events>'; },
    toCfgSpawnableTypesXml: function(){ return '<cfgspawnabletypes><!-- TODO --></cfgspawnabletypes>'; }
  };

  function escapeXmlComment(str){ return str.replace(/--/g,'—'); }

  global.EconomyParser = EconomyParser;
})(window);
