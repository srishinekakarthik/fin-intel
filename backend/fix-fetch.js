const fs = require('fs');

function fixFetch(file) {
  let doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = false;
  doc.nodes.forEach(n => {
    if (n.type === 'n8n-nodes-base.code' && n.parameters && n.parameters.jsCode && n.parameters.jsCode.includes('fetch(')) {
      let newCode = n.parameters.jsCode;
      
      // We know the pattern is:
      // const response = await fetch(`url`, { headers: ... });
      // const { data: varName } = await response.json();
      
      newCode = newCode.replace(
        /const response = await fetch\([\s\S]*?`([^`]+)`,\s*\{\s*headers:\s*\{\s*'X-Callback-Secret':\s*'([^']+)'\s*\}\s*\}\s*\);/m, 
        "const response = await this.helpers.httpRequest({ method: 'GET', url: `$1`, headers: { 'X-Callback-Secret': '$2' }, json: true });"
      );
      
      newCode = newCode.replace(
        /const \{\s*data:\s*([^\s}]+)\s*\} = await response\.json\(\);/, 
        "const $1 = response.data;"
      );
      
      // Specifically for Prep Weekly Jobs
      if (newCode.includes('await response.json()') && newCode.includes('const { data: orgs } =')) {
         newCode = newCode.replace(/const \{ data: orgs \} = await response\.json\(\);/, "const orgs = response.data;");
      }

      if (newCode !== n.parameters.jsCode) {
        n.parameters.jsCode = newCode;
        changed = true;
        console.log(`Fixed fetch in ${file} node ${n.name}`);
      } else {
        console.log(`Could not automatically fix fetch in ${file} node ${n.name}`);
      }
    }
  });
  
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
}

fixFetch('./n8n/monitoring-workflow.json');
fixFetch('./n8n/scheduled-reports-workflow.json');
