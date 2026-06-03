#!/bin/bash
# Deploy CMS Web lên live server
# Usage: ./deploy-prod.sh <user@live-server-ip>
# Cần: SSH key đã được thêm vào live server

set -e

if [ -z "$1" ]; then
  echo "Usage: ./deploy-prod.sh <user@server>"
  echo "Example: ./deploy-prod.sh root@1.2.3.4"
  exit 1
fi

SERVER="$1"
REMOTE_DIR="/opt/cms-web"

echo "=== Build CMS Web (production mode) ==="
npm run build:prod

echo ""
echo "=== Upload lên live server: $SERVER ==="
ssh "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --delete dist/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "=== Reload nginx ==="
ssh "$SERVER" "docker exec p2p-nginx nginx -s reload"

echo ""
echo "✅ Done! CMS Web live."
