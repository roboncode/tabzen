#!/bin/bash
set -e

echo "Tab Zen Sync Service Setup"
echo "=============================="
echo ""

# Check wrangler is available
if ! command -v wrangler &> /dev/null; then
  echo "wrangler not found. Install with: bun add -g wrangler"
  exit 1
fi

cd "$(dirname "$0")"

# --- Account selection ---
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "Detecting Cloudflare accounts..."
  ACCOUNTS_OUTPUT=$(wrangler whoami 2>&1) || true

  # Parse account names and IDs from the Unicode table
  # Lines look like: │ Jombee       │ d1fbd52963af543c9e7b19ee3f05f1bb │
  ACCOUNT_LINES=$(echo "$ACCOUNTS_OUTPUT" | grep -E '[a-f0-9]{32}' | sed 's/│/|/g' | awk -F'|' '{
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3)
    if ($2 != "" && $3 != "") print $2 "|" $3
  }')

  ACCOUNT_COUNT=$(echo "$ACCOUNT_LINES" | grep -c '|' 2>/dev/null || echo "0")

  if [ "$ACCOUNT_COUNT" -gt 1 ]; then
    echo ""
    echo "Multiple Cloudflare accounts found:"
    echo ""
    i=1
    while IFS='|' read -r name id; do
      echo "  $i) $name ($id)"
      i=$((i + 1))
    done <<< "$ACCOUNT_LINES"
    echo ""
    read -p "Select account [1-$ACCOUNT_COUNT]: " SELECTION

    SELECTED=$(echo "$ACCOUNT_LINES" | sed -n "${SELECTION}p")
    CLOUDFLARE_ACCOUNT_ID=$(echo "$SELECTED" | cut -d'|' -f2 | tr -d ' ')
    ACCOUNT_NAME=$(echo "$SELECTED" | cut -d'|' -f1)
    echo "Using: $ACCOUNT_NAME ($CLOUDFLARE_ACCOUNT_ID)"
  elif [ "$ACCOUNT_COUNT" -eq 1 ]; then
    CLOUDFLARE_ACCOUNT_ID=$(echo "$ACCOUNT_LINES" | head -1 | cut -d'|' -f2 | tr -d ' ')
    ACCOUNT_NAME=$(echo "$ACCOUNT_LINES" | head -1 | cut -d'|' -f1)
    echo "Using: $ACCOUNT_NAME ($CLOUDFLARE_ACCOUNT_ID)"
  else
    echo "Could not detect accounts. Set CLOUDFLARE_ACCOUNT_ID env var and retry."
    exit 1
  fi
  echo ""
fi

export CLOUDFLARE_ACCOUNT_ID

# --- Install dependencies ---
echo "Installing dependencies..."
bun install

# --- Create D1 database ---
echo ""
echo "Creating D1 database..."
D1_OUTPUT=$(wrangler d1 create tab-zen-sync 2>&1) || true

# Try to parse the ID from create output
D1_ID=$(echo "$D1_OUTPUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)

if [ -z "$D1_ID" ]; then
  # Database might already exist, try to find it
  echo "Database may already exist, looking it up..."
  D1_LIST=$(wrangler d1 list 2>&1) || true
  D1_ID=$(echo "$D1_LIST" | grep "tab-zen-sync" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
fi

if [ -z "$D1_ID" ]; then
  echo "Could not create or find D1 database."
  echo "Try manually: CLOUDFLARE_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID wrangler d1 create tab-zen-sync"
  exit 1
fi
echo "D1 database ID: $D1_ID"

# --- Create KV namespace ---
echo ""
echo "Creating KV namespace..."
KV_OUTPUT=$(wrangler kv namespace create KV 2>&1) || true

# Try to parse the ID from create output
KV_ID=$(echo "$KV_OUTPUT" | grep -oE '[a-f0-9]{32}' | head -1)

if [ -z "$KV_ID" ]; then
  # KV might already exist, try to find it
  echo "KV namespace may already exist, looking it up..."
  KV_LIST=$(wrangler kv namespace list 2>&1) || true
  KV_ID=$(echo "$KV_LIST" | grep -B2 "tab-zen-sync-KV" | grep -oE '[a-f0-9]{32}' | head -1)
fi

if [ -z "$KV_ID" ]; then
  echo "Could not create or find KV namespace."
  echo "Try manually: CLOUDFLARE_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID wrangler kv namespace create KV"
  exit 1
fi
echo "KV namespace ID: $KV_ID"

# --- Update wrangler.toml ---
echo ""
echo "Updating wrangler.toml..."

# Replace placeholder or existing IDs
sed -i.bak -E "s/database_id = \"[^\"]*\"/database_id = \"$D1_ID\"/" wrangler.toml
sed -i.bak -E "/\[\[kv_namespaces\]\]/,/^$/{s/id = \"[^\"]*\"/id = \"$KV_ID\"/}" wrangler.toml
rm -f wrangler.toml.bak

echo "wrangler.toml updated"

# --- Deploy ---
echo ""
echo "Deploying to Cloudflare..."
DEPLOY_OUTPUT=$(bun run deploy 2>&1) || true
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^ ]*workers\.dev' | head -1)

echo "$DEPLOY_OUTPUT"

# --- Run schema migration ---
echo ""
echo "Running database migration..."
wrangler d1 execute tab-zen-sync --file=schema.sql --remote

echo ""
echo "=============================="
echo "Setup complete!"
echo ""
if [ -n "$WORKER_URL" ]; then
  echo "Sync URL: $WORKER_URL"
  echo ""
  echo "Add this URL to Tab Zen Settings > Sync URL"
  echo "Then click 'Enable Sync' to generate your token."
fi
