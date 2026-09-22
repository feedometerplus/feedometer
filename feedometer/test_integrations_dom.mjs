import fs from 'fs';

const jsCode = fs.readFileSync('scripts/feedometer-integrations.js', 'utf8');
const htmlCode = fs.readFileSync('integrations.html', 'utf8');

const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(jsCode)) !== null) {
  ids.add(match[1]);
}

console.log('Checked', ids.size, 'IDs:');
for (const id of ids) {
  const hasId = htmlCode.includes(`id="${id}"`) || htmlCode.includes(`id='${id}'`);
  if (!hasId) {
    console.error('❌ MISSING in integrations.html:', id);
  } else {
    console.log('✅ Found:', id);
  }
}
