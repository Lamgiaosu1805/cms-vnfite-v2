#!/bin/bash
# Deploy CMS Web lên live server (reverse proxy)
# URL sau deploy: https://cms.vnfite.com.vn
#
# Cấu trúc: static files đặt tại 42.113.122.155 (reverse proxy)
#            /cms API proxy qua 42.113.122.119:8090 (backend docker)
#
# SSH key: set SSH_KEY_PATH env var hoặc truyền tham số
# Usage:
#   ./deploy-prod.sh                      # dùng SSH_KEY_PATH hoặc default ~/.ssh/id_rsa
#   ./deploy-prod.sh ~/.ssh/my_key        # chỉ định key

set -e

SERVER="root@42.113.122.155"
REMOTE_DIR="/opt/cms-web-prod"
SSH_KEY="${1:-${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

echo "=== Build CMS Web (production mode) ==="
npm run build:prod

echo ""
echo "=== Upload lên live reverse proxy: $SERVER ==="
ssh $SSH_OPTS "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --delete -e "ssh $SSH_OPTS" dist/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "=== Reload nginx ==="
ssh $SSH_OPTS "$SERVER" "nginx -t && systemctl reload nginx"

echo ""
echo "✅ Done! CMS Web Live: https://cms.vnfite.com.vn"
