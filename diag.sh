#!/usr/bin/env bash
set -e
DOMAIN="${DOMAIN:-https://tg-miniapp-shop-template-black.vercel.app}"

{
  echo "=== DIAG $(date -u) UTC ==="
  echo "## PWD"; pwd
  echo "## GIT"; git branch --show-current; git status -sb
  echo "## LAST COMMITS"; git log --oneline -10

  echo "## TREE webapp"; ls -la public/webapp
  echo "## HEAD api/bot.js"; sed -n '1,160p' api/bot.js | nl -ba
  echo "## TAIL api/bot.js"; tail -n 120 api/bot.js | nl -ba
  echo "## HEAD api/order.js"; sed -n '1,160p' api/order.js | nl -ba
  echo "## HEAD public/webapp/app.js"; sed -n '1,220p' public/webapp/app.js | nl -ba
  echo "## GREP app.js"; grep -n "quantities\|variantSel\|qtyInput\|Ajouter au panier" public/webapp/app.js || true

  echo "## NODE CHECKS"; node --version
  node --check api/bot.js || true
  node --check api/order.js || true
  node --check public/webapp/app.js || true

  echo "## DEPLOY: /api/bot"; curl -i "$DOMAIN/api/bot" | sed -n '1,40p'
  echo "## DEPLOY: /api/products"; curl -s "$DOMAIN/api/products"
  echo
  echo "## DEPLOY: /webapp/index.html (head)"; curl -s "$DOMAIN/webapp/" | sed -n '1,100p'
  echo "## DEPLOY: /webapp/app.js (grep)"; curl -s "$DOMAIN/webapp/app.js" | grep -n "variantSel\|p.quantities\|10g\|name=\"variant\"" || true
} > diag.out

echo "✅ écrit: $(pwd)/diag.out"
