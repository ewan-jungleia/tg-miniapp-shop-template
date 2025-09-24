set -euo pipefail
file=api/bot.js

# --- Remplace le bloc admin:prod_list entre "if (data==='admin:prod_list')" et le prochain "if (data==='admin:add_product')"
tmp=$(mktemp)
awk '
BEGIN{mode="copy"}
/if \(data===\x27admin:prod_list\x27\)\{/ && mode=="copy"{
  print "// Produits"
  print "  if (data===\x27admin:prod_list\x27){"
  print "    const products = (await kv.get(\x27products\x27)) || [];"
  print "    if (!products.length){ await send(\x27Produits actifs\\n\\n(aucun)\x27, chatId, adminProductsKb()); return; }"
  print ""
  print "    const lines = products.map(function(p){"
  print "      const medias = Array.isArray(p && p.media) ? p.media.length : 0;"
  print "      if (Array.isArray(p.quantities) && p.quantities.length > 0){"
  print "        const qs = (p.quantities||[]).map(function(v){"
  print "          const lb = String((v && v.label) || \x27\x27);"
  print "          const pc = Number((v && v.price_cash) || 0);"
  print "          const pr = Number((v && v.price_crypto) || 0);"
  print "          return \x27  - \x27 + lb + \x27: \x27 + pc + \x27 € / \x27 + pr + \x27 €\x27;"
  print "        }).join(\x27\\n\x27);"
  print "        return \x27• \x27 + String(p.name) + \x27 (\x27 + String(p.id) + \x27)\\nTarifs:\\n\x27 + qs + \x27\\nMédias: \x27 + medias + \x27\\nDesc: \x27 + (p.description||\x27-\x27);"
  print "      }"
  print "      const unit = p.unit || \x271u\x27;"
  print "      const pc = Number(p.price_cash||0), pr = Number(p.price_crypto||0);"
  print "      return \x27• \x27 + String(p.name) + \x27 (\x27 + String(p.id) + \x27)\\nTarif: \x27 + unit + \x27 — \x27 + pc + \x27 € / \x27 + pr + \x27 €\\nMédias: \x27 + medias + \x27\\nDesc: \x27 + (p.description||\x27-\x27);"
  print "    }).join(\x27\\n\\n\x27);"
  print ""
  print "    await send(\x27Produits actifs\\n\\n\x27 + lines, chatId, adminProductsKb());"
  print "    return;"
  print "  }"
  mode="skip_prod"; next
}
mode=="skip_prod" && /if \(data===\x27admin:add_product\x27\)\{/ { mode="copy" }
mode=="copy"{ print }
' "$file" > "$tmp"
mv "$tmp" "$file"

# --- Remplace entièrement function orderLine(o){...}
tmp=$(mktemp)
awk '
BEGIN{mode="copy";depth=0}
/function orderLine\(o\)\{/ && mode=="copy"{
  print "function orderLine(o){"
  print "  const items = (o?.cart?.items||[]).map(it=>{"
  print "    const name = String(it.name||\x27?\x27);"
  print "    const qty  = Number(it.qty||0);"
  print "    const tag  = it.variantLabel ? ` (\x24{it.variantLabel})` : (it.unit?` (\x24{it.unit})`:``);"
  print "    const pc   = Number(it.price_cash||0);"
  print "    const pr   = Number(it.price_crypto||0);"
  print "    return `\x24{name}\x24{tag} x \x24{qty} — Cash: \x24{pc} / Crypto: \x24{pr}`;"
  print "  }).join(\x27, \x27) || \x27(vide)\x27;"
  print "  const d=o?.delivery||{};"
  print "  const name=[d.firstname||\x27\x27, d.lastname||\x27\x27].filter(Boolean).join(\x27 \x27).trim();"
  print "  const addr=[d.address1||\x27\x27, [d.postalCode||\x27\x27, d.city||\x27\x27].filter(Boolean).join(\x27 \x27), d.country||\x27\x27].filter(Boolean).join(\x27, \x27) || \x27-\x27;"
  print "  return ["
  print "    `\x24{o.id} • \x24{fmtDate(o.ts)}`,"
  print "    `Produits: \x24{items}`,"
  print "    `Paiement: \x24{o.payment||\x27-\x27}`,"
  print "    `Total: \x24{fmtEUR(o?.totals?.cash||0)} (cash) • \x24{fmtEUR(o?.totals?.crypto||0)} (crypto)`,"
  print "    `Adresse: \x24{name?(name+\x27, \x27):\x27\x27}\x24{addr}`"
  print "  ].join(\x27\\n\x27);"
  print "}"
  mode="skip_fn"; depth=1; next
}
mode=="skip_fn"{
  for(i=1;i<=length($0);i++){
    ch=substr($0,i,1)
    if(ch=="{") depth++
    if(ch=="}"){ depth--; if(depth==0){ mode="copy"; next } }
  }
  next
}
{ print }
' "$file" > "$tmp"
mv "$tmp" "$file"

node --check api/bot.js
