#!/bin/bash
# Deploy CMS Web lên live server
# URL sau deploy: https://cms.vnfite.com.vn
# Usage: ./deploy-prod.sh <user@live-server-ip> [ssh-key-path]

set -e

if [ -z "$1" ]; then
  echo "Usage: ./deploy-prod.sh <user@server> [ssh-key-path]"
  echo "Example: ./deploy-prod.sh root@1.2.3.4 ~/.ssh/id_rsa"
  exit 1
fi

SERVER="$1"
REMOTE_DIR="/opt/cms-web-prod"
SSH_KEY="${2:-${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

echo "=== Build CMS Web (production mode) ==="
npm run build:prod

echo ""
echo "=== Upload lên live server: $SERVER ==="
ssh $SSH_OPTS "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --delete -e "ssh $SSH_OPTS" dist/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "=== Reload nginx ==="
ssh $SSH_OPTS "$SERVER" "docker exec p2p-nginx nginx -s reload"

echo ""
echo "✅ Done! CMS Web Live: https://cms.vnfite.com.vn"
