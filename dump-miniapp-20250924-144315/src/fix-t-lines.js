const fs = require('fs');
const file = 'patch-117-assistant.js';
let s = fs.readFileSync(file, 'utf8');

// Remplace TOUTE ligne contenant la version cassée de "Prix cash (...) pour ..."
s = s.replace(
  /^\$1\s+await send\('Prix cash \(€\) pour.*$/m,
  `$1  await send('Prix cash (€) pour "\\${t}" ?', chatId); return;`
);

// Remplace TOUTE ligne contenant la version cassée de "Prix crypto (...) pour ..."
s = s.replace(
  /^\$1\s+await send\('Prix crypto \(€\) pour.*$/m,
  `$1  await send('Prix crypto (€) pour "\\${t}" ?', chatId); return;`
);

fs.writeFileSync(file, s);
console.log('✔ Lignes "Prix cash/crypto … ${t}" réparées dans', file);
