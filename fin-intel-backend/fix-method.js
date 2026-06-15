const fs = require('fs');

function fixMethod(file) {
  let doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = false;
  doc.nodes.forEach(n => {
    if (n.type === 'n8n-nodes-base.httpRequest') {
      if (!n.parameters.method && n.parameters.sendBody) {
        n.parameters.method = 'POST';
        changed = true;
        console.log('Fixed method in ' + file + ' node ' + n.name);
      }
    }
  });
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
}

fixMethod('./n8n/monitoring-workflow.json');
fixMethod('./n8n/scheduled-reports-workflow.json');
