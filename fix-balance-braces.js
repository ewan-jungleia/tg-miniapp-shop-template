const fs=require('fs');const f='api/bot.js';let s=fs.readFileSync(f,'utf8');
// Compte naïvement les { } en ignorant les backticks multi-lignes (template strings)
let depth=0,inBT=false;for(let i=0;i<s.length;i++){const c=s[i],p=s[i-1];
 if(c==='`'&&p!=='\\') inBT=!inBT;
 if(inBT) continue;
 if(c==='{') depth++; else if(c==='}') depth--; }
if(depth>0){ s+= '\n'+'}'.repeat(depth)+'\n'; fs.writeFileSync(f,s); console.log('✅ Ajout de',depth,'accolade(s) de clôture à la fin.'); }
else { console.log('OK: pas de manque global d’accolades (depth='+depth+').'); }
