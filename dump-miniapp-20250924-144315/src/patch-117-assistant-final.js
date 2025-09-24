/* Patch v1.1.7 — Assistant variantes (add + edit) + listing clair */
const fs = require('fs');
const path = 'api/bot.js';
let s = fs.readFileSync(path, 'utf8');

/* Utilitaires */
function replaceBlock(startPattern, newCode) {
  const sp = s.search(startPattern);
  if (sp === -1) return false;
  // Trouver la fin du bloc "if (...) { ... }" en comptant les { }
  let i = s.indexOf('{', sp);
  if (i === -1) return false;
  let depth = 1, j = i + 1;
  while (j < s.length && depth > 0) {
    const ch = s[j++];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  if (depth !== 0) return false;
  s = s.slice(0, sp) + newCode + s.slice(j);
  return true;
}
function insertAfter(pattern, insert) {
  const m = s.match(pattern);
  if (!m) return false;
  const idx = m.index + m[0].length;
  s = s.slice(0, idx) + insert + s.slice(idx);
  return true;
}

/* 1) Listing produits (admin:prod_list) — clair + variantes multi-lignes */
{
  const re = /if\s*\(data===['"]admin:prod_list['"]\)\s*\{/;
  const block = String.raw`
  if (data==='admin:prod_list'){
    const products=(await kv.get('products'))||[];
    if (!products.length){ await send('Produits actifs\n\n(aucun)', chatId, adminProductsKb()); return; }
    const blocks=products.map(p=>{
      const medias = Array.isArray(p.media) ? p.media.length : 0;
      if (Array.isArray(p.quantities) && p.quantities.length){
        const qs = p.quantities.map(v=>{
          const lb=String(v?.label||''); const pc=Number(v?.price_cash||0); const pr=Number(v?.price_crypto||0);
          return '  - '+lb+': Cash: '+pc+' € / Crypto: '+pr+' €';
        }).join('\n');
        return '• '+String(p.name)+' ('+String(p.id)+')\nTarifs:\n'+qs+'\nMédias: '+medias+'\nDesc: '+(p.description||'-');
      } else {
        const unit=p.unit||'1u'; const pc=Number(p.price_cash||0); const pr=Number(p.price_crypto||0);
        return '• '+String(p.name)+' ('+String(p.id)+')\nTarif: '+unit+' — Cash: '+pc+' € / Crypto: '+pr+' €\nMédias: '+medias+'\nDesc: '+(p.description||'-');
      }
    }).join('\n\n');
    await send('Produits actifs\n\n'+blocks, chatId, adminProductsKb()); return;
  }
`;
  replaceBlock(re, block);
}

/* 2) ADD PRODUCT — Assistant étapes (supprime JSON/legacy) */
{
  const reAdd = /if\s*\(sess\.flow===['"]add_product['"]\)\s*\{/;
  const newAdd = String.raw`
  if (sess.flow==='add_product'){
    // name -> desc -> qty_label -> qty_cash -> qty_crypto -> qty_more -> media -> confirm
    if (sess.step==='name' && msg.text){
      sess.payload.name = msg.text.trim();
      sess.step='desc'; await adminSessionSet(userId,sess);
      await send('Description ?', chatId); return;
    }
    if (sess.step==='desc' && msg.text){
      sess.payload.description = msg.text.trim();
      // Démarre l’assistant variantes
      sess.payload.quantities = [];
      sess.step='qty_label'; await adminSessionSet(userId,sess);
      await send('Première variante — libellé (ex: 10g, boîte, 1u, …) ?', chatId);
      return;
    }
    if (sess.step==='qty_label' && msg.text){
      const t = String(msg.text).trim();
      if (!t){ await send('Libellé vide. Réessaie.', chatId); return; }
      sess.payload._current = { label: t, price_cash: 0, price_crypto: 0 };
      sess.step='qty_cash'; await adminSessionSet(userId,sess);
      await send(\`Prix cash (€) pour "\${t}" ?\`, chatId); return;
    }
    if (sess.step==='qty_cash' && msg.text){
      const n = Number(String(msg.text).replace(',','.'));
      if (!isFinite(n)){ await send('Nombre invalide. Entre un prix (ex: 5 ou 5,5).', chatId); return; }
      sess.payload._current.price_cash = n;
      const t = sess.payload._current.label;
      sess.step='qty_crypto'; await adminSessionSet(userId,sess);
      await send(\`Prix crypto (€) pour "\${t}" ?\`, chatId); return;
    }
    if (sess.step==='qty_crypto' && msg.text){
      const n = Number(String(msg.text).replace(',','.'));
      if (!isFinite(n)){ await send('Nombre invalide. Entre un prix (ex: 6 ou 6,2).', chatId); return; }
      sess.payload._current.price_crypto = n;
      (sess.payload.quantities ||= []).push(sess.payload._current);
      delete sess.payload._current;
      sess.step='qty_more'; await adminSessionSet(userId,sess);
      await send('Ajouter une autre variante ? (oui/non)', chatId); return;
    }
    if (sess.step==='qty_more' && msg.text){
      const t = String(msg.text).trim().toLowerCase();
      if (['oui','o','yes','y'].includes(t)){
        sess.step='qty_label'; await adminSessionSet(userId,sess);
        await send('Libellé de la variante suivante ?', chatId); return;
      }
      if (!sess.payload.quantities || !sess.payload.quantities.length){
        await send('Tu dois créer au moins une variante (réponds "oui").', chatId); return;
      }
      // On passe aux médias
      sess.step='media'; await adminSessionSet(userId,sess);
      await send('Envoie 1 ou plusieurs photos/vidéos.\nQuand c’est bon : ➡️ Terminer.', chatId, kbMedia()); return;
    }
    if (sess.step==='media'){
      let added=0;
      if (msg.photo?.length){ const best=msg.photo[msg.photo.length-1]; const url=await getFileUrl(best.file_id); if (url){ (sess.payload.media ||= []).push({type:'photo', url}); added++; } }
      if (msg.video){ const url=await getFileUrl(msg.video.file_id); if (url){ (sess.payload.media ||= []).push({type:'video', url}); added++; } }
      if (added>0){ await adminSessionSet(userId, sess); await send(\`Média ajouté. Total: \${(sess.payload.media||[]).length}\nTu peux en ajouter d’autres ou cliquer ➡️ Terminer.\`, chatId, kbMedia()); }
      return;
    }
  }
`;
  replaceBlock(reAdd, newAdd);
}

/* 3) Bouton BACK dans add_product (revient correctement dans l’assistant) */
{
  s = s.replace(
    /if\s*\(data===['"]back['"]\)\s*\{[\s\S]*?return;\s*\}/m,
    String.raw`
  if (data==='back'){
    const sess=await adminSessionGet(userId);
    if (sess?.flow==='add_product'){
      if (sess.step==='qty_label'){ await adminSessionSet(userId,{...sess, step:'desc'}); await send('Description ?', chatId); return; }
      if (sess.step==='qty_cash'){ await adminSessionSet(userId,{...sess, step:'qty_label'}); await send('Libellé de la variante ?', chatId); return; }
      if (sess.step==='qty_crypto'){ await adminSessionSet(userId,{...sess, step:'qty_cash'}); await send('Prix cash (€) ?', chatId); return; }
      if (sess.step==='qty_more'){ await adminSessionSet(userId,{...sess, step:'qty_crypto'}); await send('Prix crypto (€) ?', chatId); return; }
      if (sess.step==='media'){ await adminSessionSet(userId,{...sess, step:'qty_more'}); await send('Ajouter une autre variante ? (oui/non)', chatId); return; }
    }
    return;
  }
`
  );
}

/* 4) EDIT PRODUCT — menu simplifié + sous-menu Quantités (assistant) */
{
  // Menu "choisir le champ"
  s = s.replace(
    /const kb=\[\s*\[[\s\S]*?\]\s*];\s*await send\(`Modifier <b\>\$\{found\.name\}<\/b>\`[\s\S]*?return;/m,
    String.raw`
const kb=[
  [{text:'Nom', callback_data:'admin:edit_field:name'}, {text:'Description', callback_data:'admin:edit_field:description'}],
  [{text:'Quantités', callback_data:'admin:edit_field:quantities'}],
  [{text:'Médias', callback_data:'admin:edit_field:media'}],
  [{text:'Annuler', callback_data:'cancel'}]
];
await send(\`Modifier <b>\${found.name}</b> (\${found.id}) — choisis le champ :\`, chatId, kb);
return;
`
  );

  // Callbacks Quantités (liste / ajouter / éditer / supprimer)
  insertAfter(
    /\/\/ Media helpers/,
    String.raw`

  // === Quantités — callbacks ===
  if (data==='admin:edit_field:quantities'){
    const sess=await adminSessionGet(userId);
    const products=(await kv.get('products'))||[];
    const p=products.find(x=>x.id===sess?.payload?.id);
    if(!p){ await send('Introuvable.', chatId); return; }
    const qs = Array.isArray(p.quantities)?p.quantities:[];
    const rows = qs.length ? qs.map((v,i)=>[{text:\`\${v.label} — Cash: \${v.price_cash}€ / Crypto: \${v.price_crypto}€\`, callback_data:'admin:qty_pick:'+i}]) : [[{text:'(aucune)', callback_data:'noop'}]];
    const kb=[...rows, [{text:'➕ Ajouter', callback_data:'admin:qty_add'}], [{text:'⬅️ Retour', callback_data:'admin:edit_product'}]];
    await send('Quantités :', chatId, kb); return;
  }
  if (data.startsWith('admin:qty_pick:')){
    const i = Number(data.split(':').pop()||'0')|0;
    const sess=await adminSessionGet(userId);
    await adminSessionSet(userId,{...sess, step:'qty_menu', payload:{...(sess?.payload||{}), idx:i}});
    const kb=[
      [{text:'Libellé', callback_data:'admin:qty_edit_label'}],
      [{text:'Prix cash', callback_data:'admin:qty_edit_cash'}, {text:'Prix crypto', callback_data:'admin:qty_edit_crypto'}],
      [{text:'🗑️ Supprimer', callback_data:'admin:qty_del'}],
      [{text:'⬅️ Retour', callback_data:'admin:edit_field:quantities'}]
    ];
    await send('Modifier cette variante :', chatId, kb); return;
  }
  if (data==='admin:qty_add'){
    const sess=await adminSessionGet(userId);
    await adminSessionSet(userId,{...sess, step:'qty_add_label'});
    await send('Libellé de la nouvelle variante ?', chatId); return;
  }
  if (data==='admin:qty_edit_label'){
    const sess=await adminSessionGet(userId);
    await adminSessionSet(userId,{...sess, step:'qty_edit_label_wait'});
    await send('Nouveau libellé ?', chatId); return;
  }
  if (data==='admin:qty_edit_cash'){
    const sess=await adminSessionGet(userId);
    await adminSessionSet(userId,{...sess, step:'qty_edit_cash_wait'});
    await send('Nouveau prix cash (€) ?', chatId); return;
  }
  if (data==='admin:qty_edit_crypto'){
    const sess=await adminSessionGet(userId);
    await adminSessionSet(userId,{...sess, step:'qty_edit_crypto_wait'});
    await send('Nouveau prix crypto (€) ?', chatId); return;
  }
  if (data==='admin:qty_del'){
    const sess=await adminSessionGet(userId);
    const products=(await kv.get('products'))||[];
    const id = sess?.payload?.id, i = sess?.payload?.idx|0;
    const idx=products.findIndex(p=>p.id===id);
    if(idx<0){ await send('Introuvable.', chatId); return; }
    (products[idx].quantities ||= []).splice(i,1);
    await kv.set('products', products);
    await send('✅ Variante supprimée.', chatId);
    await onCallbackQuery({ message:{chat:{id:chatId}}, from:{id:userId}, data:'admin:edit_field:quantities' });
    return;
  }
`
  );

  // Messages pour Quantités (add / edit champs)
  insertAfter(
    /\/\*\* ===== Messages ===== \*\*\//,
    String.raw`

  // === EDIT PRODUCT — messages Quantités ===
  {
    const sess=await adminSessionGet(msg.from.id);
    if (sess?.flow==='edit_product'){
      const products=(await kv.get('products'))||[];

      if (sess.step==='qty_add_label' && msg.text){
        const t = String(msg.text).trim(); if(!t){ await send('Libellé vide.', msg.chat.id); return; }
        await adminSessionSet(msg.from.id,{...sess, step:'qty_add_cash', payload:{...(sess.payload||{}), newLabel:t}});
        await send(\`Prix cash (€) pour "\${t}" ?\`, msg.chat.id); return;
      }
      if (sess.step==='qty_add_cash' && msg.text){
        const n=Number(String(msg.text).replace(',','.')); if(!isFinite(n)){ await send('Nombre invalide.', msg.chat.id); return; }
        await adminSessionSet(msg.from.id,{...sess, step:'qty_add_crypto', payload:{...(sess.payload||{}), newCash:n}});
        await send('Prix crypto (€) ?', msg.chat.id); return;
      }
      if (sess.step==='qty_add_crypto' && msg.text){
        const n=Number(String(msg.text).replace(',','.')); if(!isFinite(n)){ await send('Nombre invalide.', msg.chat.id); return; }
        const idx=products.findIndex(p=>p.id===sess.payload.id); if(idx<0){ await send('Introuvable.', msg.chat.id); return; }
        (products[idx].quantities ||= []).push({ label: sess.payload.newLabel, price_cash: sess.payload.newCash, price_crypto: n });
        await kv.set('products', products);
        await adminSessionSet(msg.from.id,{ flow:'edit_product', step:'choose_field', payload:{ id: sess.payload.id }});
        await send('✅ Variante ajoutée.', msg.chat.id);
        await onCallbackQuery({ message:{chat:{id:msg.chat.id}}, from:{id:msg.from.id}, data:'admin:edit_field:quantities' });
        return;
      }

      if (sess.step==='qty_edit_label_wait' && msg.text){
        const id = sess?.payload?.id, i = sess?.payload?.idx|0;
        const idx=products.findIndex(p=>p.id===id); if(idx<0){ await send('Introuvable.', msg.chat.id); return; }
        if(!Array.isArray(products[idx].quantities)||!products[idx].quantities[i]){ await send('Introuvable.', msg.chat.id); return; }
        products[idx].quantities[i].label = String(msg.text).trim();
        await kv.set('products', products);
        await adminSessionSet(msg.from.id,{ flow:'edit_product', step:'choose_field', payload:{ id }});
        await send('✅ Libellé mis à jour.', msg.chat.id);
        await onCallbackQuery({ message:{chat:{id:msg.chat.id}}, from:{id:msg.from.id}, data:'admin:edit_field:quantities' });
        return;
      }
      if (sess.step==='qty_edit_cash_wait' && msg.text){
        const id = sess?.payload?.id, i = sess?.payload?.idx|0;
        const idx=products.findIndex(p=>p.id===id); if(idx<0){ await send('Introuvable.', msg.chat.id); return; }
        if(!Array.isArray(products[idx].quantities)||!products[idx].quantities[i]){ await send('Introuvable.', msg.chat.id); return; }
        const n=Number(String(msg.text).replace(',','.')); products[idx].quantities[i].price_cash=isFinite(n)?n:0;
        await kv.set('products', products);
        await adminSessionSet(msg.from.id,{ flow:'edit_product', step:'choose_field', payload:{ id }});
        await send('✅ Prix cash mis à jour.', msg.chat.id);
        await onCallbackQuery({ message:{chat:{id:msg.chat.id}}, from:{id:msg.from.id}, data:'admin:edit_field:quantities' });
        return;
      }
      if (sess.step==='qty_edit_crypto_wait' && msg.text){
        const id = sess?.payload?.id, i = sess?.payload?.idx|0;
        const idx=products.findIndex(p=>p.id===id); if(idx<0){ await send('Introuvable.', msg.chat.id); return; }
        if(!Array.isArray(products[idx].quantities)||!products[idx].quantities[i]){ await send('Introuvable.', msg.chat.id); return; }
        const n=Number(String(msg.text).replace(',','.')); products[idx].quantities[i].price_crypto=isFinite(n)?n:0;
        await kv.set('products', products);
        await adminSessionSet(msg.from.id,{ flow:'edit_product', step:'choose_field', payload:{ id }});
        await send('✅ Prix crypto mis à jour.', msg.chat.id);
        await onCallbackQuery({ message:{chat:{id:msg.chat.id}}, from:{id:msg.from.id}, data:'admin:edit_field:quantities' });
        return;
      }
    }
  }
`
  );
}

/* Écriture */
fs.writeFileSync(path, s);
console.log('✅ Patch assistant appliqué à', path);
