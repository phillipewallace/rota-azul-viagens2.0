#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/phill/Downloads/rota-azul-viagens2.0

echo "=== Syntax check ==="
bash -n deploy.sh && echo "OK: bash syntax valid" || { echo "FAIL: bash syntax invalid"; exit 1; }

echo ""
echo "=== csll.cloud relevant lines ==="
grep -n 'csll\.cloud\|server_name csll\|listen 443\|certbot\|return 301\|CSLL_' deploy.sh | head -40

echo ""
echo "=== Section headers ==="
grep -n '^# -' deploy.sh | head -30
