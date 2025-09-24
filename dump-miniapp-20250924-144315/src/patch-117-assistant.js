// patch-117-assistant.js
// Transforme v1.1.7 "JSON/legacy" -> "Assistant variantes" + list clair
const fs = require('fs');

const path = 'api/bot.js';
let src = fs.readFileSync(path, 'utf8');
let changed = false;

// -- 1) Listing produits: "  - 10g — Cash: 5 € • Crypto: 6 €"
src = src.replace(
  /`  - \$\{lb\}: \$\{pc\} € \/ \$\{pr\} €`/g,
  '`  - ${lb} — Cash: ${pc} € • Crypto: ${pr} €`'
);

// -- 2) Menu "Modifier" : remplace Variantes(JSON)/legacy -> "Quantités & tarifs"
src = src.replace(
/const kb=\[\s*\[\{text:'Nom'.*?\n\s*await send\(`Modifier <b\>\$\{found\.name\}<\/b\>.*?kb\);\n\s*return;\n\s*\}\n/gs,
(match)=>{
  const rebuilt =
`const kb=[
  [{text:'Nom', callback_data:'admin:edit_field:name'}, {text:'Description', callback_data:'admin:edit_field:description'}],
  [{text:'Quantités & tarifs', callback_data:'admin:edit_field:quantities'}],
  [{text:'Médias', callback_data:'admin:edit_field:media'}],
  [{text:'Annuler', callback_data:'cancel'}]
];
await adminSessionSet(userId, sess);
await send(\`Modifier <b>\${found.name}</b> (\${found.id}) — choisis le champ :\`, chatId, kb);
return;
}
`;
  changed = true;
  return rebuilt;
}
);

// -- 3) Callbacks "Quantités & tarifs" (injection juste avant "// Media helpers")
if (!/admin:edit_field:quantities/.test(src)){
  src = src.replace(
    /(\n\s*\/\/ Media helpers[\s\S]+)/,
    `
  // === Quantités & tarifs (édition assistant) ===
  if (data==='admin:edit_field:quantities'){
    const products=(await kv.get('products'))||[];
    const found = products.find(p=>p.id===sess?.payload?.id);
    if(!found){ await send('Introuvable.', chatId); return; }
    sess.step='qty_menu'; await adminSessionSet(userId, sess);

    const lines = (Array.isArray(found.quantities)&&found.quantities.length)
      ? found.quantities.map((v,i)=>\`#\${i+1} \${v.label} — Cash: \${v.price_cash} € • Crypto: \${v.price_crypto} €\`).join('\\n')
      : '(aucune)';

    const kb=[
      ...((found.quantities||[]).map((_,i)=>[{ text:'✏️ #'+(i+1), callback_data:'admin:qty_pick:'+i }])),
      [{ text:'➕ Ajouter', callback_data:'admin:qty_add' }],
      ...(Array.isArray(found.quantities)&&found.quantities.length?[ [{ text:'🧹 Vider', callback_data:'admin:qty_clear' }] ]: []),
      [{ text:'⬅️ Retour', callback_data:'admin:edit_product' }]
    ];
    await send('<b>Quantités & tarifs</b>\\n\\n'+lines, chatId, kb);
    return;
  }
  if (data==='admin:qty_add'){
    sess.step='qty_add_label'; await adminSessionSet(userId, sess);
    await send('Nouvelle variante — libellé ? (ex: 10g)', chatId); return;
  }
  if (data==='admin:qty_clear'){
    const products=(await kv.get('products'))||[];
    const idx=products.findIndex(p=>p.id===sess?.payload?.id);
    if(idx<0){ await send('Introuvable.', chatId); return; }
    products[idx].quantities = [];
    await kv.set('products', products);
    // retour au menu
    await send('✅ Variantes vidées.', chatId);
    await onCallbackQuery({ message: { chat: { id: chatId } }, from:{id:userId}, data:'admin:edit_field:quantities' });
    return;
  }
  if (data.startsWith('admin:qty_pick:')){
    const pick = parseInt(data.split(':')[2]||'-1',10);
    const products=(await kv.get('products'))||[];
    const found = products.find(p=>p.id===sess?.payload?.id);
    if(!found || !Array.isArray(found.quantities) || !found.quantities[pick]){
      await send('Introuvable.', chatId); return;
    }
    sess.step='qty_edit_menu'; sess.payload.idx=pick; await adminSessionSet(userId, sess);
    const kb=[
      [{text:'Libellé', callback_data:'admin:qty_edit_label:'+pick}],
      [{text:'🗑️ Supprimer', callback_data:'admin:qty_delete:'+pick}],
      [{text:'⬅️ Retour', callback_data:'admin:edit_field:quantities'}]
    ];
    const v=found.quantities[pick];
    await send(\`#\${pick+1} \${v.label} — Cash: \${v.price_cash} € • Crypto: \${v.price_crypto} €\\nQue veux-tu modifier ?\`, chatId, kb);
    return;
  }
  if (data.startsWith('admin:qty_edit_label:')){
    const i=parseInt(data.split(':')[2]||'-1',10);
    sess.step='qty_edit_label_wait'; sess.payload.idx=i; await adminSessionSet(userId, sess);
    await send('Nouveau libellé ?', chatId); return;
  }
  if (data.startsWith('admin:qty_edit_cash:')){
    const i=parseInt(data.split(':')[2]||'-1',10);
    sess.step='qty_edit_cash_wait'; sess.payload.idx=i; await adminSessionSet(userId, sess);
    await send('Nouveau prix cash (€) ?', chatId); return;
  }
  if (data.startsWith('admin:qty_edit_crypto:')){
    const i=parseInt(data.split(':')[2]||'-1',10);
    sess.step='qty_edit_crypto_wait'; sess.payload.idx=i; await adminSessionSet(userId, sess);
    await send('Nouveau prix crypto (€) ?', chatId); return;
  }
  if (data.startsWith('admin:qty_delete:')){
    const i=parseInt(data.split(':')[2]||'-1',10);
    const products=(await kv.get('products'))||[];
    const idx=products.findIndex(p=>p.id===sess?.payload?.id);
    if(idx<0){ await send('Introuvable.', chatId); return; }
    if(Array.isArray(products[idx].quantities)) products[idx].quantities.splice(i,1);
    await kv.set('products', products);
    await send('✅ Variante supprimée.', chatId);
    await onCallbackQuery({ message:{chat:{id:chatId}}, from:{id:userId}, data:'admin:edit_field:quantities' });
    return;
  }
$1`
  );
  changed = true;
}

// -- 4) Ajout produit : remplace le JSON par assistant v_label -> v_cash -> v_crypto -> encore?
if (/sess\.step==='variants_json_add'/.test(src)){
  src = src
    // a) après "Description ?" on part sur v_label (plus de JSON)
    .replace(
`if (sess.step==='desc' && msg.text){
  sess.payload.description = msg.text.trim();
  // Étape variantes JSON (ou "aucune" pour garder unité/prix uniques)
  sess.step='variants_json_add'; await adminSessionSet(userId, sess);
  await send('Envoie les variantes au format JSON (ex: [
  {"label":"10g","price_cash":5,"price_crypto":6}
])\\nOu tape "aucune" pour utiliser unité/prix uniques.', chatId);
  return;
}
`,
`if (sess.step==='desc' && msg.text){
  sess.payload.description = msg.text.trim();
  sess.payload.quantities = [];
  sess.step='v_label'; await adminSessionSet(userId, sess);
  await send('Variante 1 — libellé ? (ex: 10g)\\n\\n(ou tape "aucune" pour ne pas utiliser de variantes)', chatId);
  return;
}
`)
    // b) insère les nouvelles étapes juste avant le bloc media
    .replace(
      /(\n\s*)if \(sess\.step==='media'\)\{/,
      `$1// Assistant variantes (ajout)
$1if (sess.step==='v_label' && msg.text){
$1  const t = String(msg.text).trim();
$1  if (t.toLowerCase()==='aucune'){
$1    // Pas de variantes -> direct médias
$1    sess.step='media'; await adminSessionSet(userId, sess);
$1    await send('Envoie 1 ou plusieurs <b>photos/vidéos</b> du produit.\\nQuand c’est bon : ➡️ Terminer.', chatId, kbMedia());
$1    return;
$1  }
$1  (sess.payload.quantities ||= []);
$1  sess.payload._tmp = { label: t };
$1  sess.step='v_cash'; await adminSessionSet(userId, sess);
$1}
$1if (sess.step==='v_cash' && msg.text){
$1  const n = Number(String(msg.text).replace(',','.'));
$1  sess.payload._tmp = Object.assign(sess.payload._tmp||{}, { price_cash: isFinite(n)?n:0 });
$1  sess.step='v_crypto'; await adminSessionSet(userId, sess);
$1}
$1if (sess.step==='v_crypto' && msg.text){
$1  const n = Number(String(msg.text).replace(',','.'));
$1  const tmp = Object.assign(sess.payload._tmp||{}, { price_crypto: isFinite(n)?n:0 });
$1  delete sess.payload._tmp;
$1  (sess.payload.quantities ||= []).push({
$1    label: String(tmp.label||''),
$1    price_cash: Number(tmp.price_cash||0),
$1    price_crypto: Number(n||0)
$1  });
$1  sess.step='v_more'; await adminSessionSet(userId, sess);
$1  const kb=[[{text:'➕ Ajouter une autre', callback_data:'admin:ap_more'},{text:'➡️ Terminer', callback_data:'admin:ap_done'}]];
$1  await send('Variante ajoutée. Ajouter une autre ?', chatId, kb); return;
$1}
$1// clics "Ajouter une autre" / "Terminer" via CallbackQuery
$1if (sess.step==='v_more' && msg.text){
$1  // si l'utilisateur tape "oui/non", on gère aussi
$1  const t=String(msg.text).trim().toLowerCase();
$1  if(['oui','o','yes','y','ajouter','+'].includes(t)){ sess.step='v_label'; await adminSessionSet(userId, sess); await send('Libellé de la variante suivante ?', chatId); 
return; }
$1  if(['non','n','fin','terminer','stop'].includes(t)){ sess.step='media'; await adminSessionSet(userId, sess); await send('Envoie 1 ou plusieurs <b>photos/vidéos</b>.', 
chatId, kbMedia()); return; }
$1}
$1$&` // (réinjecte le "if (sess.step==='media'){" capturé)
    );
  changed = true;

  // c) Ajouter la gestion des boutons "Ajouter autre / Terminer" dans onCallbackQuery
  src = src.replace(
    /(\n\s*\/\/ Rapports[\s\S]+)/,
`
// Ajout produit: boutons "Ajouter autre / Terminer" pendant v_more
if (data==='admin:ap_more'){
  const sess = await adminSessionGet(userId);
  if (sess?.flow==='add_product' && sess.step==='v_more'){
    sess.step='v_label'; await adminSessionSet(userId, sess);
    await send('Libellé de la variante suivante ?', chatId); return;
  }
}
if (data==='admin:ap_done'){
  const sess = await adminSessionGet(userId);
  if (sess?.flow==='add_product'){
    sess.step='media'; await adminSessionSet(userId, sess);
    await send('Envoie 1 ou plusieurs <b>photos/vidéos</b> du produit.\\nQuand c’est bon : ➡️ Terminer.', chatId, kbMedia()); return;
  }
}
$1`
  );
}

// -- 5) Édition: étapes messages pour ajouter/éditer variantes
if (!/qty_add_label/.test(src)){
  src = src.replace(
    /\nasync function handleAdminFlowStep\(msg, sess\)\{\n/,
    `
async function handleAdminFlowStep(msg, sess){
`
  ).replace(
    /(\n\s*\/\/ === EDIT PRODUCT \(adds variants_json\) ===[\s\S]+?\n\s*\}\n\s*\n\s*\/\/ === DELETE PRODUCT)/,
    (m)=>{
      const add =
`
// === EDIT PRODUCT (assistant quantités) ===
if (sess.flow==='edit_product'){
  const products=(await kv.get('products'))||[];

  // ajout variante (assistant)
  if (sess.step==='qty_add_label' && msg.text){
    sess.payload._new = { label:String(msg.text).trim() };
    sess.step='qty_add_cash'; await adminSessionSet(userId, sess);
    await send('Prix cash (€) ?', chatId); return;
  }
  if (sess.step==='qty_add_cash' && msg.text){
    const n = Number(String(msg.text).replace(',','.')); 
    sess.payload._new.price_cash = isFinite(n)?n:0;
    sess.step='qty_add_crypto'; await adminSessionSet(userId, sess);
    await send('Prix crypto (€) ?', chatId); return;
  }
  if (sess.step==='qty_add_crypto' && msg.text){
    const n = Number(String(msg.text).replace(',','.'));
    const id = sess?.payload?.id;
    const idx = products.findIndex(p=>p.id===id);
    if(idx<0){ await send('Introuvable.', chatId); return; }
    const v = {
      label: String(sess.payload._new?.label||''),
      price_cash: Number(sess.payload._new?.price_cash||0),
      price_crypto: isFinite(n)?n:0
    };
    delete sess.payload._new;
    (products[idx].quantities ||= []).push(v);
    await kv.set('products', products);
    sess.step='qty_menu'; await adminSessionSet(userId, sess);
    await send('✅ Variante ajoutée.', chatId);
    await onCallbackQuery({ message:{chat:{id:chatId}}, from:{id:userId}, data:'admin:edit_field:quantities' });
    return;
  }

  // édition variante (libellé / cash / crypto)
  if (sess.step==='qty_edit_label_wait' && msg.text){
    const id = sess?.payload?.id, i = sess?.payload?.idx|0;
    const idx=products.findIndex(p=>p.id===id); if(idx<0){ await send('Introuvable.', chatId); return; }
    if(!Array.isArray(products[idx].quantities)||!products[idx].quantities[i]){ await send('Introuvable.', chatId); return; }
    products[idx].quantities[i].label = String(msg.text).trim();
    await kv.set('products', products);
    sess.step='qty_menu'; await adminSessionSet(userId, sess);
    await send('✅ Libellé mis à jour.', chatId);
    await onCallbackQuery({ message:{chat:{id:chatId}}, from:{id:userId}, data:'admin:edit_field:quantities' });
    return;
  }
  if (sess.step==='qty_edit_cash_wait' && msg.text){
    const id = sess?.payload?.id, i = sess?.payload?.idx|0;
    const idx=products.findIndex(p=>p.id===id); if(idx<0){ await send('Introuvable.', chatId); return; }
    if(!Array.isArray(products[idx].quantities)||!products[idx].quantities[i]){ await send('Introuvable.', chatId); return; }
    const n=Number(String(msg.text).replace(',','.')); products[idx].quantities[i].price_cash=isFinite(n)?n:0;
    await kv.set('products', products);
    sess.step='qty_menu'; await adminSessionSet(userId, sess);
    await send('✅ Prix cash mis à jour.', chatId);
    await onCallbackQuery({ message:{chat:{id:chatId}}, from:{id:userId}, data:'admin:edit_field:quantities' });
    return;
  }
  if (sess.step==='qty_edit_crypto_wait' && msg.text){
    const id = sess?.payload?.id, i = sess?.payload?.idx|0;
    const idx=products.findIndex(p=>p.id===id); if(idx<0){ await send('Introuvable.', chatId); return; }
    if(!Array.isArray(products[idx].quantities)||!products[idx].quantities[i]){ await send('Introuvable.', chatId); return; }
    const n=Number(String(msg.text).replace(',','.')); products[idx].quantities[i].price_crypto=isFinite(n)?n:0;
    await kv.set('products', products);
    sess.step='qty_menu'; await adminSessionSet(userId, sess);
    await send('✅ Prix crypto mis à jour.', chatId);
    await onCallbackQuery({ message:{chat:{id:chatId}}, from:{id:userId}, data:'admin:edit_field:quantities' });
    return;
  }
}
` + m;
      changed = true;
      return add;
    }
  );
}

if (!changed){ console.log('Aucun changement appliqué.'); }
fs.writeFileSync(path, src);
console.log('OK: api/bot.js patché (assistant + list).');

