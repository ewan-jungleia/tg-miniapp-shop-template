// enhance.js — v1.1.5 (badge panier "visible-first" + fallback)
// - Compte d'abord les inputs visibles (évite x2 si 2 vues coexistent)
// - Fallback sur le total all-vues et/ou parsing "x N" si rien de visible
// - Lightbox inchangée (OK chez toi)

(function(){
  // ---------- LIGHTBOX (inchangé) ----------
  function ensureLightbox(){
    var lb=document.getElementById('lightbox');
    if(!lb){
      lb=document.createElement('div'); lb.id='lightbox'; lb.className='lb hidden'; lb.style.display='none';
      lb.innerHTML='<button id="lbClose" class="lb-close" aria-label="Fermer">✕</button><div id="lbInner" class="lb-inner"></div>';
      document.body.appendChild(lb);
    }
    return lb;
  }
  function openBox(url,isVideo){
    var lb=ensureLightbox(), inner=document.getElementById('lbInner');
    if(!lb||!inner||!url) return;
    inner.innerHTML='';
    if(isVideo){ var v=document.createElement('video'); v.src=url; v.controls=true; v.autoplay=true; v.playsInline=true; inner.appendChild(v); }
    else{ var i=document.createElement('img'); i.src=url; inner.appendChild(i); }
    lb.classList.remove('hidden'); lb.style.display='flex';
  }
  function closeBox(){
    var lb=document.getElementById('lightbox'); var inner=document.getElementById('lbInner');
    if(!lb||!inner) return; lb.classList.add('hidden'); lb.style.display='none'; inner.innerHTML='';
  }
  document.addEventListener('click', function(e){
    var t=e.target;
    if(t && t.id==='lbClose') { closeBox(); return; }
    var lb=document.getElementById('lightbox');
    if(lb && e.target===lb) { closeBox(); return; }
  }, true);
  function bgUrl(el){ try{var s=getComputedStyle(el).backgroundImage; var m=s && s.match(/url\(["']?(.*?)["']?\)/i); return m?m[1]:'';}catch(e){return '';} }
  function mediaFromEvent(e){
    var path=(e.composedPath&&e.composedPath())||[];
    for(var i=0;i<path.length;i++){
      var node=path[i]; if(!node||!node.tagName) continue;
      var tag=node.tagName.toUpperCase();
      if(tag==='IMG') return {url:node.currentSrc||node.src||'',vid:false};
      if(tag==='VIDEO') return {url:node.currentSrc||node.src||'',vid:true};
      var u=bgUrl(node); if(u) return {url:u,vid:false};
      if(tag==='BODY'||tag==='HTML') break;
    }
    return {url:'',vid:false};
  }
  document.addEventListener('click', function(e){
    var inCatalog = !!(e.target.closest('#catalog') || e.target.closest('.card'));
    if(!inCatalog) return;
    var m = mediaFromEvent(e);
    if(m.url){ e.preventDefault(); e.stopPropagation(); openBox(m.url, m.vid); }
  }, true);

  // ---------- BADGE PANIER (visible-first) ----------
  var cartBtn=document.getElementById('openCart')||document.querySelector('.cartFab');
  if(!cartBtn){
    cartBtn=document.createElement('button');
    cartBtn.id='openCart'; cartBtn.title='Voir le panier'; cartBtn.textContent='🛍️';
    Object.assign(cartBtn.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:9998,borderRadius:'12px',padding:'10px 12px',background:'#fff',border:'1px solid #e5e7eb'});
    document.body.appendChild(cartBtn);
  }
  if(!cartBtn._wired){
    cartBtn._wired=true;
    cartBtn.addEventListener('click', function(){
      var ov=document.getElementById('cartOverlay');
      if(ov){ ov.classList.remove('hidden'); }
      else {
        var c=document.getElementById('cart')||document.querySelector('[data-cart]');
        if(c) try{ c.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){}
      }
      scheduleUpdate(); // recale à l'ouverture
    }, true);
  }

  function getContainers(){
    var list=[];
    var a=document.getElementById('cartOverlay'); if(a) list.push(a);
    var b=document.getElementById('cart'); if(b) list.push(b);
    var c=document.getElementById('cartItems'); if(c && !list.includes(c)) list.push(c);
    // document en dernier recours
    list.push(document);
    return list;
  }
  function isVisible(el){
    return !!(el && el.offsetParent !== null);
  }

  function sumInputsIn(container, onlyVisible){
    var total=0;
    var inputs = container.querySelectorAll('input[type="number"]');
    inputs.forEach(function(inp){
      if(onlyVisible && !isVisible(inp)) return;
      var v = +inp.value || 0;
      total += v;
    });
    return total;
  }
  function qtyFromText(row){
    var txt=(row.textContent||'').trim();
    var m = txt.match(/x\s*(\d+)/i) || txt.match(/×\s*(\d+)/i) || txt.match(/qty[:\s]*?(\d+)/i);
    if(m) return +m[1]||0;
    var nums=(txt.match(/\d+/g)||[]).map(Number).filter(n=>n>0);
    return nums.length ? Math.min.apply(null, nums) : 0;
  }
  function sumTextIn(container, onlyVisible){
    var total=0;
    // lignes candidates : direct children ou lignes communes
    var rows = container.querySelectorAll('#cartItems > *, tr, .item, .cart-row, .cartItem');
    rows.forEach(function(r){
      if(onlyVisible && !isVisible(r)) return;
      // si input number existe, on le laissera aux fonctions inputs; ici, on prend texte uniquement quand il n’y a pas d’input
      var hasInput = r.querySelector('input[type="number"]');
      if(hasInput) return;
      total += qtyFromText(r);
    });
    return total;
  }

  function recountVisibleFirst(){
    var containers = getContainers();
    var bestVisible = 0;
    for(var i=0;i<containers.length;i++){
      var cv = sumInputsIn(containers[i], true);
      if(cv===0) cv = sumTextIn(containers[i], true);
      if(cv>bestVisible) bestVisible = cv;
    }
    if(bestVisible>0) return bestVisible;

    // fallback: max des totaux "toutes vues"
    var bestAll = 0;
    for(var j=0;j<containers.length;j++){
      var ca = sumInputsIn(containers[j], false);
      if(ca===0) ca = sumTextIn(containers[j], false);
      if(ca>bestAll) bestAll = ca;
    }
    return bestAll;
  }

  var last=-1;
  function applyBadge(n){
    if(n<=0){
      if(last!==0){ cartBtn.removeAttribute('data-count'); last=0; }
      return;
    }
    if(n!==last){ cartBtn.setAttribute('data-count', String(n)); last=n; }
  }

  var deb=null;
  function scheduleUpdate(){
    if(deb) return;
    deb = setTimeout(function(){
      deb=null;
      var n = recountVisibleFirst();
      applyBadge(n);
    }, 120);
  }

  // Clics usuels
  document.addEventListener('click', function(e){
    var t=e.target;
    var label=(t.textContent||t.getAttribute('aria-label')||'').toLowerCase();
    if(label.includes('ajouter au panier') || t.matches('[data-add-to-cart],.add-to-cart')){ scheduleUpdate(); return; }
    if(label.includes('supprimer') || t.matches('.remove,.delete,[data-remove]')){ scheduleUpdate(); return; }
    if(label.includes('panier') || label.includes('valider') || t.id==='openCart'){ scheduleUpdate(); return; }
  }, true);

  // Mutations : MAJ quand le panier change
  ['#cartItems','#cart','#cartOverlay'].forEach(function(sel){
    var el=document.querySelector(sel); if(!el) return;
    var mo=new MutationObserver(function(){ scheduleUpdate(); });
    mo.observe(el,{childList:true,subtree:true,attributes:true,characterData:true});
  });

  // Init
  window.addEventListener('load', function(){ scheduleUpdate(); setTimeout(scheduleUpdate, 250); }, true);

  // Debug helpers
  window.__cartBadge = {
    recount: function(){ return recountVisibleFirst(); },
    show: function(){ applyBadge(recountVisibleFirst()); }
  };
})();
