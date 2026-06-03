#!/bin/bash
# Deploy CMS Web lên TEST environment
# URL: https://cms-test.vnfite.com.vn
#
# Static files đặt tại reverse proxy 42.113.122.155 (/var/www/cms-web-test)
# /cms API proxy qua docker test backend 42.113.122.119:7080
#
# SSH key: ~/.ssh/jenkins_test hoặc set SSH_KEY_PATH

set -e

SERVER="root@42.113.122.155"
SSH_PORT="2222"
REMOTE_DIR="/var/www/cms-web-test"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/jenkins_test}"
SSH_OPTS="-i $SSH_KEY -p $SSH_PORT -o StrictHostKeyChecking=no"

echo "=== Build CMS Web (test mode) ==="
npm run build:test

echo ""
echo "=== Upload lên reverse proxy: $SERVER ==="
ssh $SSH_OPTS "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --delete -e "ssh $SSH_OPTS" dist/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "=== Reload nginx ==="
ssh $SSH_OPTS "$SERVER" "nginx -t && systemctl reload nginx"

echo ""
echo "✅ Done! https://cms-test.vnfite.com.vn"
