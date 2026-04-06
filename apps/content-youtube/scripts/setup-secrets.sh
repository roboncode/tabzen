#!/bin/bash
set -e

echo "📦 Setting up Cloudflare Workers secrets for YouTube Scraper..."

if [ ! -f .dev.vars ]; then
  echo "❌ Error: .dev.vars file not found"
  echo "💡 Create .dev.vars file with your secrets first"
  exit 1
fi

while IFS='=' read -r key value; do
  # Skip comments and empty lines
  if [[ ! $key =~ ^# ]] && [[ -n $key ]]; then
    # Skip PORT as it's defined in wrangler.jsonc
    if [[ $key != "PORT" ]]; then
      echo "Setting secret: $key"
      echo "$value" | wrangler secret put "$key"
    fi
  fi
done < .dev.vars

echo "✅ All secrets uploaded successfully!"
echo ""
echo "🚀 Next steps:"
echo "   1. Test locally: pnpm workers:dev"
echo "   2. Deploy to dev: pnpm workers:deploy"
echo "   3. Deploy to prod: pnpm workers:deploy:prod"
