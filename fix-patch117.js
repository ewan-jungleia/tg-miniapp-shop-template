const fs = require('fs');
const p = 'patch-117-assistant.js';
let s = fs.readFileSync(p, 'utf8');

// Remplace les concaténations du type:  "' + \"\${t}\" + '"
s = s.replace(/"'\s*\+\s*\\\$\{t\}\s*\+\s*'"/g, '"\\${t}"');
// Et l'autre ordre de guillemets:   '" + "\${t}" + "'
s = s.replace(/'"\s*\+\s*\\\$\{t\}\s*\+\s*"'/g, '"\\${t}"');
// Filet de sécurité pour variantes mixtes
s = s.replace(/(["'])"\s*\+\s*\\\$\{t\}\s*\+\s*"(["'])/g, '"\\${t}"');

fs.writeFileSync(p, s);
console.log('✔ Corrigé:', p);
