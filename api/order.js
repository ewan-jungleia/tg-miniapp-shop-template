// api/order.js
const axios = require('axios');
const { kv } = require('@vercel/kv');

const BOT = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return axios.create({ baseURL: `https://api.telegram.org/bot${token}` });
};

function genOrderId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random()*chars.length)];
  return '#' + s;
}

function totals(cart) {
  const items = cart?.items || [];
  let cash = 0, crypto = 0;
  for (const it of items) {
    const q = Number(it.qty||0);
    cash   += q * Number(it.price_cash||0);
    crypto += q * Number(it.price_crypto||0);
  }
  return { cash, crypto };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
    const body = JSON.parse(await readBody(req) || '{}');
    const { user, cart, delivery, payment } = body || {};

    const settings = (await kv.get('settings')) || {};
    const contactUsername = settings.contactUsername || 'TonContactHumain';

    // ID aléatoire unique
    let orderId = null;
    for (let i = 0; i < 8; i++) {
      const candidate = genOrderId();
      const exists = await kv.get(`order:${candidate}`);
      if (!exists) { orderId = candidate; await kv.set(`order:${candidate}`, { ts: Date.now() }); break; }
    }
    if (!orderId) orderId = genOrderId();

    const sum = totals(cart);
    const text = formatOrderText(cart, delivery, payment, orderId, sum);

    // Contact humain (@)
    await BOT().post('/sendMessage', {
      chat_id: `@${contactUsername}`, text, parse_mode:'HTML', disable_web_page_preview:true
    }).catch(()=>{});

    // Admins
    const adminIds = Array.isArray(settings.admins) ? settings.admins : [];
    for (const adminId of new Set(adminIds.map(String))) {
      if (/^\d+$/.test(adminId)) {
        await BOT().post('/sendMessage', {
          chat_id: adminId, text, parse_mode:'HTML', disable_web_page_preview:true
        }).catch(()=>{});
      }
    }

    // Accusé utilisateur
    if (user?.id) {
      const link = `https://t.me/${contactUsername}`;
      const ack = [
        `✅ <b>Votre commande ${orderId} a été validée !</b>`,
        `Total: ${fmtEUR(sum.cash)} (cash) • ${fmtEUR(sum.crypto)} (crypto)`,
        ``,
        `▶️ Envoyez un message au contact ci-dessous et fournissez votre <b>numéro de commande</b> :`,
        `<a href="${link}">@${contactUsername}</a>`,
        ``,
        `Le contact finalisera le paiement et le suivi de la livraison.`
      ].join('\n');
      await BOT().post('/sendMessage', {
        chat_id: user.id, text: ack, parse_mode:'HTML', disable_web_page_preview:false
      }).catch(()=>{});
    }

    // 🔸 Persistance pour Rapports
    const orders = (await kv.get('orders_v2')) || [];
    const safeUser = user ? { id: user.id, username: user.username||'' } : null;
    orders.push({
      id: orderId,
      ts: Date.now(),
      user: safeUser,
      cart: cart || {},
      delivery: delivery || {},
      payment: payment || '',
      totals: { cash: Number(sum.cash||0), crypto: Number(sum.crypto||0) }
    });
    await kv.set('orders_v2', orders);

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok:true, contact_link:`https://t.me/${contactUsername}`, order_id:orderId }));
  } catch (e) {
    res.statusCode = 500;
    res.end('ERR_ORDER:' + e.message);
  }
};

function formatOrderText(cart, delivery, payment, orderId, sum) {
  const d = delivery || {};
  const items = (cart?.items || []).map(it =>
    `• ${it.name}${(it.variantLabel?(' ('+it.variantLabel+')'):(it.unit?(' ('+it.unit+')'):''))} x ${it.qty} — Cash: ${it.price_cash} / Crypto: ${it.price_crypto}`
  ).join('\n');

  const addr = [
    `${(d.firstname||'').trim()} ${(d.lastname||'').trim()}`.trim(),
    (d.address1||'').trim(),
    [d.postalCode, d.city].filter(Boolean).join(' '),
    (d.country||'').trim()
  ].filter(Boolean).join('\n');

  return [
    `<b>Nouvelle commande ${orderId}</b>`,
    `🧺 Panier:\n${items || '(vide)'}`,
    `💳 Paiement choisi: ${payment}`,
    `💰 Total: ${fmtEUR(sum.cash)} (cash) • ${fmtEUR(sum.crypto)} (crypto)`,
    `🏠 Livraison:\n${addr}`
  ].join('\n');
}

function fmtEUR(n){ return new Intl.NumberFormat('fr-FR',{style:'currency', currency:'EUR'}).format(Number(n||0)); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
