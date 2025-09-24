const { kv } = require('@vercel/kv');
async function getJSON(key, fallback){ const raw = await kv.get(key); if(raw==null) return fallback; try{ return typeof raw==='string'? JSON.parse(raw): raw; }catch{ return fallback; } }
async function setJSON(key, value){ return kv.set(key, JSON.stringify(value)); }
module.exports = { kv, getJSON, setJSON };
