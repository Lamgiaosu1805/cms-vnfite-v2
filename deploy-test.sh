#!/bin/bash
# Deploy CMS Web lên test server
# URL sau deploy: http://cms-test.vnfite.com.vn  (sau khi DNS trỏ về 42.113.122.119)
# SSH key: ~/.ssh/jenkins_test (hoặc set SSH_KEY_PATH env var)

set -e

SERVER="root@42.113.122.119"
REMOTE_DIR="/opt/cms-web-test"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/jenkins_test}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

echo "=== Build CMS Web (test mode) ==="
npm run build:test

echo ""
echo "=== Upload lên test server: $SERVER ==="
ssh $SSH_OPTS "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -avz --delete -e "ssh $SSH_OPTS" dist/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "=== Reload Apache ==="
ssh $SSH_OPTS "$SERVER" "systemctl reload apache2"

echo ""
echo "✅ Done! CMS Web Test: http://cms-test.vnfite.com.vn"
echo "   (Cần DNS A record: cms-test.vnfite.com.vn → 42.113.122.119)"
