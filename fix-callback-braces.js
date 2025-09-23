const fs = require('fs');
const path = 'api/bot.js';
let s = fs.readFileSync(path, 'utf8');

const startFn = s.indexOf('async function onCallbackQuery');
if (startFn === -1) {
  console.error('❌ onCallbackQuery non trouvé.');
  process.exit(1);
}
const openBrace = s.indexOf('{', startFn);
if (openBrace === -1) { console.error('❌ { d’ouverture non trouvée.'); process.exit(1); }

const msgMark = s.indexOf('/** ===== Messages ===== **/');
if (msgMark === -1) { console.error('❌ Marqueur "Messages" non trouvé.'); process.exit(1); }

let head = s.slice(0, openBrace + 1);
let body = s.slice(openBrace + 1, msgMark);
let tail = s.slice(msgMark);

let depth = 1; // on est dans la { d’ouverture de onCallbackQuery
let out = '';
for (let i=0; i<body.length; i++) {
  const ch = body[i];
  if (ch === '{') { depth++; out += ch; continue; }
  if (ch === '}') {
    depth--;
    // si on tomberait à 0 AVANT le marqueur Messages, alors c'est une accolade en trop -> on la SKIP
    if (depth === 0) { depth = 1; continue; }
    out += ch; continue;
  }
  out += ch;
}

// s’assure qu’on a bien UNE fermeture juste avant Messages
if (!out.trimEnd().endsWith('}')) out = out + '\n}\n';

// recolle
const fixed = head + out + tail;
fs.writeFileSync(path, fixed);
console.log('✅ Accolades du bloc onCallbackQuery réparées.');
