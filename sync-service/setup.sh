#!/bin/bash
set -e

echo "🔧 Tab Zen Sync Service Setup"
echo "=============================="
echo ""

# Check wrangler is available
if ! command -v wrangler &> /dev/null; then
  echo "❌ wrangler not found. Install with: npm install -g wrangler"
  exit 1
fi

cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create D1 database
echo ""
echo "🗄️  Creating D1 database..."
D1_OUTPUT=$(wrangler d1 create tab-zen-sync 2>&1) || true
D1_ID=$(echo "$D1_OUTPUT" | grep -o 'database_id = "[^"]*"' | head -1 | cut -d'"' -f2)

if [ -z "$D1_ID" ]; then
  # Database might already exist, try to list it
  D1_ID=$(wrangler d1 list 2>&1 | grep "tab-zen-sync" | awk '{print $1}')
fi

if [ -z "$D1_ID" ]; then
  echo "❌ Could not create or find D1 database. Create manually:"
  echo "   cd sync-service && wrangler d1 create tab-zen-sync"
  exit 1
fi
echo "✅ D1 database ID: $D1_ID"

# Create KV namespace
echo ""
echo "📋 Creating KV namespace..."
KV_OUTPUT=$(wrangler kv namespace create KV 2>&1) || true
KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | head -1 | cut -d'"' -f2)

if [ -z "$KV_ID" ]; then
  # KV might already exist, try to list it
  KV_ID=$(wrangler kv namespace list 2>&1 | grep -A1 "tab-zen-sync-KV" | grep "id" | awk -F'"' '{print $4}')
fi

if [ -z "$KV_ID" ]; then
  echo "❌ Could not create or find KV namespace. Create manually:"
  echo "   cd sync-service && wrangler kv namespace create KV"
  exit 1
fi
echo "✅ KV namespace ID: $KV_ID"

# Update wrangler.toml
echo ""
echo "📝 Updating wrangler.toml..."
sed -i.bak "s/database_id = \"placeholder-replace-after-create\"/database_id = \"$D1_ID\"/" wrangler.toml
sed -i.bak "s/id = \"placeholder-replace-after-create\"/id = \"$KV_ID\"/" wrangler.toml
rm -f wrangler.toml.bak

echo "✅ wrangler.toml updated"

# Deploy
echo ""
echo "🚀 Deploying to Cloudflare..."
DEPLOY_OUTPUT=$(npm run deploy 2>&1)
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^ ]*workers.dev' | head -1)

echo "$DEPLOY_OUTPUT"

# Run schema migration
echo ""
echo "🗂️  Running database migration..."
wrangler d1 execute tab-zen-sync --file=schema.sql --remote

echo ""
echo "=============================="
echo "✅ Setup complete!"
echo ""
if [ -n "$WORKER_URL" ]; then
  echo "🌐 Sync URL: $WORKER_URL"
  echo ""
  echo "Add this URL to Tab Zen Settings > Sync URL"
  echo "Then click 'Enable Sync' to generate your token."
fi
