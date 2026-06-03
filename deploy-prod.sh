#!/bin/bash
# Deploy CMS Web lên LIVE environment
# URL: https://cms.vnfite.com.vn
#
# Static files đặt tại reverse proxy 42.113.122.155 (/var/www/cms-web-prod)
# /cms API proxy vào local docker cms-service (localhost:8090 trên .155)
#
# SSH key: ~/.ssh/jenkins_test hoặc set SSH_KEY_PATH

set -e

SERVER="root@42.113.122.155"
SSH_PORT="2222"
REMOTE_DIR="/var/www/cms-web-prod"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/jenkins_test}"
SSH_OPTS="-i $SSH_KEY -p $SSH_PORT -o StrictHostKeyChecking=no"

echo "=== Build CMS Web (production mode) ==="
npm run build:prod

echo ""
echo "=== Upload lên reverse proxy: $SERVER ==="
ssh $SSH_OPTS "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --delete -e "ssh $SSH_OPTS" dist/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "=== Reload nginx ==="
ssh $SSH_OPTS "$SERVER" "nginx -t && systemctl reload nginx"

echo ""
echo "✅ Done! https://cms.vnfite.com.vn"
