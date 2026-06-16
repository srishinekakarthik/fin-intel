const fs = require('fs');

function fixPrepNodes(file) {
  let doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = false;
  
  const baseFetchLogic = `// Fetch all active orgs from Supabase
const response = await this.helpers.httpRequest({ method: 'GET', url: 'https://unlovable-target-dominoes.ngrok-free.dev/api/v1/reports/active-orgs', headers: { 'X-Callback-Secret': '8b096c59121a2cd2b774abfabbf73afd332ed532663dc793e477d88e44608174' }, json: true });
const orgs = response.data;

// Create one item per org for the next step
return orgs.map(org => ({ json: { orgId: org.id, reportType: '__TYPE__' } }));`;

  doc.nodes.forEach(n => {
    if (n.name === 'Code: Prep Monthly Jobs') {
      n.parameters.jsCode = baseFetchLogic.replace('__TYPE__', 'monthly');
      changed = true;
    } else if (n.name === 'Code: Prep Quarterly Jobs') {
      n.parameters.jsCode = baseFetchLogic.replace('__TYPE__', 'quarterly');
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
    console.log('Fixed Prep nodes in ' + file);
  }
}

fixPrepNodes('./n8n/scheduled-reports-workflow.json');
