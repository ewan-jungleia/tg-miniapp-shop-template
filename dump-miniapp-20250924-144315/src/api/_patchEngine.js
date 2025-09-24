const crypto = require('crypto');
const { kv, getJSON, setJSON } = require('./_kv');

const VERSION_KEY = 'app:version';
const HISTORY_KEY = 'patch:history';
const LOCK_KEY = 'patch:lock';
const BACKUP_PREFIX = 'backup:';

function nowISO(){ return new Date().toISOString(); }
function hmacHex(secret, str){ return crypto.createHmac('sha256', secret).update(str,'utf8').digest('hex'); }
function cmpVersion(a,b){
  const pa=String(a).split('.').map(n=>parseInt(n)||0), pb=String(b).split('.').map(n=>parseInt(n)||0);
  for(let i=0;i<3;i++){ if((pa[i]||0)>(pb[i]||0))return 1; if((pa[i]||0)<(pb[i]||0))return -1; }
  return 0;
}
async function withLock(fn){
  const tok = crypto.randomBytes(8).toString('hex');
  const ok = await kv.set(LOCK_KEY, tok, { nx:true, ex:60 });
  if(!ok) throw new Error('Patch lock in progress');
  try { return await fn(); }
  finally {
    const cur=await kv.get(LOCK_KEY);
    if(cur===tok) await kv.del(LOCK_KEY);
  }
}
async function currentDataVersion(){ const v = await kv.get(VERSION_KEY); return v || process.env.APP_VERSION || '0.0.0'; }
function verifySignature(manifest, secret){
  if(!secret) return true;
  const payload = JSON.stringify({version:manifest.version, type:manifest.type, issued_at:manifest.issued_at, ops:manifest.ops});
  const expected = hmacHex(secret, payload);
  const got = String(manifest.sign||'').replace(/^hmac-sha256=/,'');
  if(!got) return false;
  return crypto.timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(got,'hex'));
}
function summarize(m){
  const ops=m.ops||[];
  const touched=ops.map(o=>`${o.op} ${o.key}`).join(', ');
  return `Patch ${m.version} (${m.type}) — ${ops.length} ops — ${touched}`;
}
async function preview(manifest, secret){
  if(manifest.type!=='data') throw new Error('Only type=data supported');
  if(!manifest.version) throw new Error('Missing version');
  if(!Array.isArray(manifest.ops)) throw new Error('Missing ops[]');
  if(!verifySignature(manifest, secret)) throw new Error('Invalid signature');
  const cur = await currentDataVersion();
  if(cmpVersion(manifest.version, cur) <= 0) throw new Error(`Patch ${manifest.version} <= current ${cur}`);
  const keys = [...new Set(manifest.ops.map(o=>o.key))];
  const before = {};
  for(const k of keys) before[k] = await kv.get(k);
  return { summary:summarize(manifest), currentVersion:cur, willWriteKeys:keys, before };
}
async function apply(manifest, adminId, secret){
  return withLock(async ()=>{
    const p = await preview(manifest, secret);
    const backupKey = `${BACKUP_PREFIX}${manifest.version}`;
    await setJSON(backupKey, { at:nowISO(), from:p.currentVersion, to:manifest.version, by:adminId, keys:p.before });
    for(const op of manifest.ops){
      if(op.op==='kv.set') await setJSON(op.key, op.value);
      else if(op.op==='kv.del') await kv.del(op.key);
      else if(op.op==='kv.incr') await kv.incr(op.key, op.by||1);
      else throw new Error(`Unsupported op: ${op.op}`);
    }
    await kv.set(VERSION_KEY, manifest.version);
    const hist = await getJSON(HISTORY_KEY, []);
    hist.push({ at:nowISO(), adminId, from:p.currentVersion, to:manifest.version, notes:manifest.notes||'', ops:(manifest.ops||[]).map(o=>({op:o.op,key:o.key})) });
    await setJSON(HISTORY_KEY, hist);
    return { ok:true, backupKey, historyLen:hist.length };
  });
}
async function rollback(targetVersion, adminId){
  return withLock(async ()=>{
    const backupKey = `${BACKUP_PREFIX}${targetVersion}`;
    const backup = await getJSON(backupKey, null);
    if(!backup) throw new Error(`No backup for ${targetVersion}`);
    const keys = Object.keys(backup.keys||{});
    for(const k of keys){
      const val = backup.keys[k];
      if(val==null) await kv.del(k); else await setJSON(k, val);
    }
    await kv.set(VERSION_KEY, backup.from||'0.0.0');
    const hist = await getJSON(HISTORY_KEY, []);
    hist.push({ at:nowISO(), adminId, rollback:true, to:backup.from||'0.0.0', from:backup.to||targetVersion });
    await setJSON(HISTORY_KEY, hist);
    return { ok:true, restoredTo: backup.from||'0.0.0' };
  });
}
module.exports = { preview, apply, rollback, currentDataVersion };
