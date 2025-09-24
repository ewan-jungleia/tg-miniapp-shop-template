#!/usr/bin/env bash
set -e
{
  echo "=== FULL DIAG $(date -u) UTC ==="
  echo "## PWD"; pwd
  echo "## BRANCH"; git branch --show-current
  echo "## COMMITS"; git log --oneline -5
  echo
  echo "## api/bot.js (FULL)"
  nl -ba api/bot.js
  echo
  echo "## api/order.js (FULL)"
  nl -ba api/order.js
  echo
  echo "## public/webapp/app.js (HEAD)"
  nl -ba public/webapp/app.js | sed -n '1,200p'
} > diag-full.out
echo "✅ écrit: $(pwd)/diag-full.out"
