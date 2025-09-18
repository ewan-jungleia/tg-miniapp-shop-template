(function(){try{
window.addEventListener('error',function(e){
  try{
    var d=document.createElement('pre');
    d.style.cssText='white-space:pre-wrap;color:#fff;background:#c00;padding:8px;position:fixed;left:0;right:0;top:0;z-index:99999;font-size:12px';
    d.textContent='JS ERROR: '+(e.message||'')+' — '+(e.filename||'')+':'+(e.lineno||'');
    document.body && document.body.appendChild(d);
  }catch(_){}
}, true);
}catch(_){}})();
const tg = window.Telegram?.WebApp;
tg?.ready?.();

const state = {
  settings: null,
  products: [],
  cart: JSON.parse(localStorage.getItem('cart')||'{"items":[]}'),
  checkoutStep: 'cart',
};

try{init();}catch(e){(function(){try{var d=document.createElement('pre');d.style.cssText='white-space:pre-wrap;color:#fff;background:#c00;padding:8px;position:fixed;left:0;right:0;top:0;z-index:99999;font-size:12px';d.textContent='JS ERROR: '+(e&&e.message||e)+'\n'+(e&&e.stack||'');document.body&&document.body.appendChild(d);}catch(_){alert('JS ERROR: '+(e&&e.message||e));}})();}

async function init() {
  const res = await fetch('/api/products');
  const { settings, products } = await res.json();
  state.settings = settings || {};
  state.products = products || [];
try {
  if (Array.isArray(state.products) && state.products.length>0 && !Array.isArray(state.products[0].quantities)) {
    state.products[0].quantities = [
      {label:"10g",  price_cash:5,  price_crypto:6},
      {label:"50g",  price_cash:20, price_crypto:24},
      {label:"100g", price_cash:35, price_crypto:42}
    ];
  }
} catch(_){}

  // Title & branding
  const logo = document.getElementById('logo');
  const logoPh = document.getElementById('logoPh');
  const title = document.getElementById('shopTitle');
  title.textContent = state.settings.shopName || 'Boutique';

  if (state.settings.logoUrl) { logo.src = state.settings.logoUrl; logo.style.display='block'; logoPh.style.display='none'; }
  else { logo.style.display='none'; logoPh.style.display='flex'; }

  if (state.settings.bgUrl) {
    const app = document.getElementById('app');
    app.style.backgroundImage = `url('${state.settings.bgUrl}')`;
  }

  setupTabs();
  renderCatalog();
  renderDescFaqContact();
  hookupCartModal();
  applyDeliveryFieldsVisibility();
}

function setupTabs() {
  document.querySelectorAll('.tabs button').forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
      document.getElementById(btn.dataset.tab).classList.add('active');
    };
  });
}

function renderDescFaqContact() {
  document.getElementById('descText').textContent = state.settings.description || '—';
  document.getElementById('faqText').textContent = state.settings.faq || '—';
  const contact = state.settings.contactUsername ? `https://t.me/${state.settings.contactUsername}` : '#';
  document.getElementById('contactBlock').innerHTML =
    state.settings.contactUsername
      ? `Contact humain : <a href="${contact}" target="_blank">@${state.settings.contactUsername}</a>`
      : `Aucun contact défini.`;
}

function renderCatalog() {
  const root = document.getElementById('catalog');
  root.innerHTML = '';
  state.products.forEach(p=>{
    const card = document.createElement('div'); card.className='card';

    // Galerie médias (tous)
    if (Array.isArray(p.media) && p.media.length){
      const gal = document.createElement('div'); gal.className='gallery';
      p.media.forEach(m => { const el = mediaEl(m); if (el) gal.appendChild(el); });
      card.appendChild(gal);
    }

    const hasVariants = Array.isArray(p.quantities) && p.quantities.length>0;
    const unitInfo = (!hasVariants && p.unit) ? ` (${p.unit})` : '';
    const baseCash = fmtEUR(p.price_cash||0);
    const baseCrypto = fmtEUR(p.price_crypto||0);

    // Bloc prix (dyn si variantes)
    let priceBlock = '';
    if (hasVariants) {
      const first = p.quantities[0] || {price_cash:0, price_crypto:0};
      priceBlock = `
        <div class="row" style="margin-left:auto; gap:16px;">
          <div>Prix cash : <span id="pc-${p.id}">${fmtEUR(first.price_cash||0)}</span></div>
          <div>Prix crypto : <span id="pr-${p.id}">${fmtEUR(first.price_crypto||0)}</span></div>
        </div>`;
    } else {
      priceBlock = `
        <div class="row" style="margin-left:auto; gap:16px;">
          <div>Prix cash : ${baseCash}</div>
          <div>Prix crypto : ${baseCrypto}</div>
        </div>`;
    }

    // Select variantes si présent
    let variantHtml = '';
    if (hasVariants) {
      const opts = p.quantities.map((q,i)=>`<option value="${i}">${q.label} — ${fmtEUR(q.price_cash||0)} / ${fmtEUR(q.price_crypto||0)}</option>`).join('');
      variantHtml = `
        <div class="row" style="margin:8px 0;">
          <label style="margin-right:8px;">Quantité</label>
          <select class="variantSel" data-id="${p.id}">${opts}</select>
        </div>`;
    }

    card.innerHTML += `
      <h3>${p.name}</h3>
      <div class="row">${p.description || ''}</div>
      ${variantHtml}
      <div class="row">
        ${!hasVariants ? `<div class="qty"><label>Qté${unitInfo}</label><div class="qtybox"><button type="button" class="minus" data-id="${p.id}">−</button><input type="number" min="1" value="1" data-id="${p.id}" class="qtyInput"><button type="button" class="plus" data-id="${p.id}">+</button></div></div>` : ''}
        ${priceBlock}
      </div>
      <button class="primary" data-add="${p.id}">Ajouter au panier</button>
    `;
    root.appendChild(card);
  });

  // +/- handlers
  root.querySelectorAll('button.minus').forEach(b=>{
    b.onclick = ()=>{
      const id=b.getAttribute('data-id');
      const input = root.querySelector('input.qtyInput[data-id="'+id+'"]');
      const v = Math.max(1, (parseInt(input.value,10)||1) - 1);
      input.value = v;
    };
  });
  root.querySelectorAll('button.plus').forEach(b=>{
    b.onclick = ()=>{
      const id=b.getAttribute('data-id');
      const input = root.querySelector('input.qtyInput[data-id="'+id+'"]');
      input.value = Math.max(1, (parseInt(input.value,10)||1) + 1);
    };
  });

  // variantes: maj prix à la volée
  root.querySelectorAll('select.variantSel').forEach(sel=>{
    sel.onchange = ()=>{
      const id = sel.getAttribute('data-id');
      const p = state.products.find(x=>x.id===id);
      if (!p) return;
      const idx = parseInt(sel.value,10)||0;
      const v = (Array.isArray(p.quantities)&&p.quantities[idx]) ? p.quantities[idx] : null;
      if (!v) return;
      const pc = document.getElementById('pc-'+id);
      const pr = document.getElementById('pr-'+id);
      if (pc) pc.textContent = fmtEUR(v.price_cash||0);
      if (pr) pr.textContent = fmtEUR(v.price_crypto||0);
    };
  });

  // Ajouter au panier
  root.querySelectorAll('button[data-add]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-add');
      const p = state.products.find(x=>x.id===id);
      const input = root.querySelector('input.qtyInput[data-id="'+id+'"]');
      const qty = Math.max(1, parseInt(input.value,10) || 1);
      addToCart(p, qty);
      openCart('cart');
    };
  });
}
function mediaEl(m) {
  if (m.type==='photo') { const img = document.createElement('img'); img.src=m.url; img.alt=''; return img; }
  if (m.type==='video') { const v = document.createElement('video'); v.src=m.url; v.controls=true; return v; }
  return null;
}

function addToCart(p, qty) {
  const hasVariants = Array.isArray(p.quantities) && p.quantities.length>0;
  let price_cash = Number(p.price_cash||0);
  let price_crypto = Number(p.price_crypto||0);
  let variantLabel = '';

  if (hasVariants) {
    const sel = document.querySelector(`select.variantSel[data-id="${p.id}"]`);
    const idx = sel ? (parseInt(sel.value,10)||0) : 0;
    const v = p.quantities[idx] || {label:'', price_cash:0, price_crypto:0};
    price_cash = Number(v.price_cash||0);
    price_crypto = Number(v.price_crypto||0);
    variantLabel = String(v.label||'');
  }

  const existing = state.cart.items.find(x=>x.id===p.id && String(x.variantLabel||'')===variantLabel);
  if (existing) existing.qty += qty;
  else state.cart.items.push({
    id: p.id,
    name: p.name,
    unit: hasVariants ? '' : p.unit,
    variantLabel,
    qty,
    price_cash,
    price_crypto
  });
  persistCart();
  renderCartItems();
}
function persistCart(){ localStorage.setItem('cart', JSON.stringify(state.cart)); }

function sumCart() {
  let cash=0, crypto=0;
  for (const it of state.cart.items) {
    cash   += Number(it.qty||0) * Number(it.price_cash||0);
    crypto += Number(it.qty||0) * Number(it.price_crypto||0);
  }
  return { cash, crypto };
}

function renderCartItems() {
  const root = document.getElementById('cartItems');
  root.innerHTML = '';
  state.cart.items.forEach(it=>{
    const label = it.variantLabel ? ` (${it.variantLabel})` : (it.unit ? ` (${it.unit})` : '');
    const row = document.createElement('div'); row.className='row cart-item';
    row.innerHTML = `<div class="cart-text">${it.name}${label} x ${it.qty} — Prix cash : ${fmtEUR(it.price_cash)} / Prix crypto : ${fmtEUR(it.price_crypto)}</div>`;
    const del = document.createElement('button'); del.textContent='Supprimer'; del.onclick=()=>{
      state.cart.items = state.cart.items.filter(x=>!(x.id===it.id && String(x.variantLabel||'')===String(it.variantLabel||'')));
      persistCart(); renderCartItems();
    };
    row.appendChild(del);
    root.appendChild(row);
  });

  // Total
  const totals = sumCart();
  const totalRow = document.createElement('div'); totalRow.className='row cart-item';
  totalRow.innerHTML = `<div class="cart-text"><b>Total:</b> ${fmtEUR(totals.cash)} (cash) • ${fmtEUR(totals.crypto)} (crypto)</div>`;
  root.appendChild(totalRow);
}
function hookupCartModal() {
  const modal = document.getElementById('cartModal');
  const cartStep = document.getElementById('cartStep');
  const deliveryStep = document.getElementById('deliveryStep');

  document.getElementById('openCart').onclick = ()=>openCart('cart');
  document.getElementById('closeCart').onclick = ()=>modal.close();
  document.getElementById('goCheckout').onclick = ()=>{
    if (!state.cart.items.length) { alert('Panier vide'); return; }
    state.checkoutStep = 'delivery'; updateCheckoutView();
  };
  document.getElementById('backToCart').onclick = ()=>{
    state.checkoutStep = 'cart'; updateCheckoutView();
  };

  function updateCheckoutView() {
    if (state.checkoutStep === 'cart') {
      cartStep.style.display = '';
      deliveryStep.style.display = 'none';
    } else {
      cartStep.style.display = 'none';
      deliveryStep.style.display = '';
    }
  }

  renderCartItems();
  updateCheckoutView();

  document.getElementById('placeOrder').onclick = async ()=>{
    if (!state.cart.items.length) { alert('Panier vide'); return; }

    const f = (state.settings.deliveryForm?.fields)||{};
    const firstname = document.getElementById('firstname')?.value.trim() || '';
    const lastname  = document.getElementById('lastname')?.value.trim()  || '';
    const address1  = document.getElementById('address1')?.value.trim()  || '';
    const postalCode= document.getElementById('postalCode')?.value.trim()|| '';
    const city      = document.getElementById('city')?.value.trim()      || '';
    const country   = document.getElementById('country')?.value.trim()   || '';

    if ((f.firstname && !firstname) || (f.lastname && !lastname) ||
        (f.address1 && !address1) || (f.postalCode && !postalCode) ||
        (f.city && !city) || (f.country && !country)) {
      alert('Formulaire incomplet. Merci de remplir les champs requis.'); return;
    }
    if (f.postalCode && (postalCode.length < 3 || postalCode.length > 10)) {
      alert('Code postal invalide.'); return;
    }

    const payment = document.querySelector('input[name="pay"]:checked').value;
    const user = tg?.initDataUnsafe?.user ? {
      id: tg.initDataUnsafe.user.id,
      username: tg.initDataUnsafe.user.username || ''
    } : {};

    const resp = await fetch('/api/order', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        user, cart: state.cart, payment,
        delivery: { firstname, lastname, address1, postalCode, city, country }
      })
    });
    const data = await resp.json().catch(()=>({}));
    const result = document.getElementById('result');
    if (data?.contact_link && data?.order_id) {
      const totals = sumCart();
      result.innerHTML = [
        `✅ <b>Votre commande ${data.order_id} a été validée !</b>`,
        `Total: ${fmtEUR(totals.cash)} (cash) • ${fmtEUR(totals.crypto)} (crypto)`,
        ``,
        `▶️ Contactez : <a href="${data.contact_link}" target="_blank">${data.contact_link}</a>`,
        `et envoyez votre numéro de commande : <b>${data.order_id}</b>.`
      ].join('<br>');
      state.cart.items = []; persistCart(); renderCartItems();
    } else {
      result.textContent = 'Commande envoyée (vérifie Telegram).';
    }
  };
}

function openCart(step='cart') {
  state.checkoutStep = step;
  const modal = document.getElementById('cartModal');
  if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open','');
  const cartStep = document.getElementById('cartStep');
  const deliveryStep = document.getElementById('deliveryStep');
  if (state.checkoutStep === 'cart') {
    cartStep.style.display = '';
    deliveryStep.style.display = 'none';
  } else {
    cartStep.style.display = 'none';
    deliveryStep.style.display = '';
  }
}

function applyDeliveryFieldsVisibility(){
  const f = (state.settings.deliveryForm?.fields)||{};
  const map = {
    firstname: document.getElementById('firstname'),
    lastname:  document.getElementById('lastname'),
    address1:  document.getElementById('address1'),
    postalCode:document.getElementById('postalCode'),
    city:      document.getElementById('city'),
    country:   document.getElementById('country'),
  };
  Object.entries(map).forEach(([k,el])=>{
    if (!el) return;
    if (f[k] === false){ el.parentElement?.style ? el.parentElement.style.display='none' : el.style.display='none'; el.dataset.disabled='1'; }
    else { el.parentElement?.style ? el.parentElement.style.display='' : el.style.display=''; delete el.dataset.disabled; }
  });
}

function fmtEUR(n){ return new Intl.NumberFormat('fr-FR',{style:'currency', currency:'EUR'}).format(Number(n||0)); }
// v1.1 append-only: lightbox + cart badge (robust)
(function(){
  var lb=document.getElementById('lightbox'),
      inner=document.getElementById('lbInner'),
      x=document.getElementById('lbClose');

  function openBox(url,isVideo){
    if(!lb||!inner||!url) return;
    inner.innerHTML='';
    if(isVideo){var v=document.createElement('video');v.src=url;v.controls=true;v.autoplay=true;v.playsInline=true;inner.appendChild(v);}
    else{var i=document.createElement('img');i.src=url;inner.appendChild(i);}
    lb.classList.remove('hidden'); lb.style.display='flex';
  }
  function closeBox(){ if(!lb||!inner) return; lb.classList.add('hidden'); lb.style.display='none'; inner.innerHTML=''; }
  lb && lb.addEventListener('click', function(e){ if(e.target===lb) closeBox(); }, true);
  x && x.addEventListener('click', closeBox, true);

  function bgUrl(el){ try{var s=getComputedStyle(el).backgroundImage; var m=s&&s.match(/url\(["']?(.*?)["']?\)/i); return m?m[1]:'';}catch(e){return '';} }
  function mediaFrom(el){
    if(!el) return {url:'',vid:false};
    var i=el.closest('img'); if(i) return {url:i.currentSrc||i.src||'', vid:false};
    var v=el.closest('video'); if(v) return {url:v.currentSrc||v.src||'', vid:true};
    var cur=el, hop=0; while(cur && hop<4){ var u=bgUrl(cur); if(u) return {url:u,vid:false}; cur=cur.parentElement; hop++; }
    return {url:'',vid:false};
  }
  document.addEventListener('click', function(e){
    var inCatalog = !!(e.target.closest('#catalog')||e.target.closest('.card'));
    if(!inCatalog) return;
    var m=mediaFrom(e.target);
    if(m.url){ e.preventDefault(); e.stopPropagation(); openBox(m.url,m.vid); }
  }, true);

  var cartBtn=document.getElementById('openCart')||document.querySelector('.cartFab');
  if(!cartBtn){
    cartBtn=document.createElement('button'); cartBtn.id='openCart'; cartBtn.title='Voir le panier'; cartBtn.textContent='🛍️';
    Object.assign(cartBtn.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:9998,borderRadius:'12px',padding:'10px 12px',background:'#fff',border:'1px solid #e5e7eb'});
    document.body.appendChild(cartBtn);
  }

  function getCartRoot(){ return document.getElementById('cartOverlay')||document.getElementById('cart')||document; }
  function openCart(){
    var el=document.getElementById('cartOverlay');
    if(el){ el.classList.remove('hidden'); }
    else { var c=document.getElementById('cart')||document.querySelector('[data-cart]'); if(c) try{ c.scrollIntoView({behavior:'smooth',block:'start'}) }catch(e){} }
  }
  if(!cartBtn._wired){ cartBtn._wired=true; cartBtn.addEventListener('click',openCart,true); }

  function countFromState(){
    try{
      if(window.state && Array.isArray(window.state.cart && window.state.cart.items)){
        return window.state.cart.items.reduce(function(n,it){ return n + (+it.qty||0); }, 0);
      }
    }catch(e){}
    return 0;
  }
  function countFromDom(){
    var c=0, root=getCartRoot();
    root.querySelectorAll('#cartItems input[type="number"], #cartItems .qty, #cartItems [data-qty]').forEach(function(q){
      var v=(q.value||q.textContent||q.getAttribute('data-qty')||'0'); c += (+v||0);
    });
    return c;
  }
  function updateBadge(){
    if(!cartBtn) return;
    var n=countFromState(); if(!n) n=countFromDom();
    if(n>0) cartBtn.setAttribute('data-count', String(n)); else cartBtn.removeAttribute('data-count');
  }

  document.addEventListener('click', function(e){
    var t=(e.target.textContent||e.target.getAttribute('aria-label')||'').toLowerCase();
    if(t.includes('ajouter au panier')||t.includes('supprimer')||t.includes('valider')||t.includes('panier')){
      setTimeout(updateBadge,150);
    }
  }, true);

  window.addEventListener('load', function(){ setTimeout(updateBadge,400); }, true);

  var mo=new MutationObserver(function(){ setTimeout(updateBadge,120); });
  mo.observe(getCartRoot(), {childList:true,subtree:true});

  var timer=setInterval(updateBadge,800);
  setTimeout(function(){ clearInterval(timer); }, 180000);

  window.__forceUpdateCartBadge = updateBadge;

  // --- Fix compteur panier (basé sur .cart-text) ---
  function updateBadgeFromCart(){
    if(!cartBtn) return;
    let count = 0;
    document.querySelectorAll('#cartItems .cart-text').forEach(el=>{
      const m = el.textContent.match(/x\\s*(\\d+)/);
      if(m) count += parseInt(m[1],10);
    });
    if(count>0){
      cartBtn.setAttribute('data-count', String(count));
    } else {
      cartBtn.removeAttribute('data-count');
    }
  }

  // Mets à jour quand le panier change (ajout/suppression/fermeture etc.)
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const t = (btn.textContent||btn.getAttribute('aria-label')||'').toLowerCase();
    if (t.includes('ajouter au panier') || t.includes('supprimer') || t.includes('valider ma commande') ) {
      setTimeout(updateBadgeFromCart, 150);
    }
  });
  // Quand l’overlay panier s’ouvre/ferme, on refait un comptage
  const cartOverlay = document.getElementById('cartOverlay');
  if(cartOverlay){
    cartOverlay.addEventListener('transitionend', ()=> setTimeout(updateBadgeFromCart,100));
  }
  // Maj au chargement
  window.addEventListener('load', ()=> setTimeout(updateBadgeFromCart, 400));

})();

/* cart badge fix: openCart */
(function(){
  const cartBtn = document.querySelector('#openCart, #cartBtn, .cartFab, .fab[aria-label="Voir le panier"]');
  if(!cartBtn) return;

  function computeCount(){
    let n = 0;
    document.querySelectorAll('#cartItems .cart-text').forEach(el=>{
      const m = el.textContent.match(/x\s*(\d+)/i);
      if(m) n += parseInt(m[1],10);
    });
    return n;
  }
  function refresh(){
    const n = computeCount();
    if(n>0) cartBtn.setAttribute('data-count', String(n));
    else cartBtn.removeAttribute('data-count');
  }

  // Observe dynamiquement le contenu du panier
  const target = document.querySelector('#cartItems');
  if(target && 'MutationObserver' in window){
    const mo = new MutationObserver(()=> setTimeout(refresh, 50));
    mo.observe(target, {childList:true, subtree:true, characterData:true});
  }

  // Sécurités supplémentaires sur clics communs
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('button,[role="button"]');
    if(!btn) return;
    const t = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
    if(t.includes('ajouter au panier') || t.includes('supprimer') || t.includes('passer à la commande')){
      setTimeout(refresh, 120);
    }
  });

  window.addEventListener('load', ()=> setTimeout(refresh, 200));
  refresh();
  // Garde-fou : si un autre code écrase data-count, on le remet
  setInterval(refresh, 800);
  document.addEventListener('visibilitychange', ()=> setTimeout(refresh,100));
})();
