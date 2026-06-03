#!/bin/bash
# Deploy CMS Web lên test server: 42.113.122.119
# Usage: ./deploy-test.sh
# Cần: SSH key đã được thêm vào server

set -e

SERVER="root@42.113.122.119"
REMOTE_DIR="/opt/cms-web"

echo "=== Build CMS Web (test mode) ==="
npm run build:test

echo ""
echo "=== Upload lên test server ==="
# Tạo thư mục nếu chưa có
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

# Sync dist/ lên server (rsync nhanh hơn scp)
rsync -avz --delete dist/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "=== Reload nginx ==="
ssh "$SERVER" "docker exec p2p-nginx nginx -s reload"

echo ""
echo "✅ Done! CMS Web available at: http://42.113.122.119:7080/admin/"
