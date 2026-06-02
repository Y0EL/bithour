#!/bin/bash
set -e

echo "🏗️  Building Crowncare (Zero-Downtime Approach)..."

# Make sure we're in the right directory
# Note: In production this is usually /var/www/crowncare
cd "$(dirname "$0")/.."

# CRITICAL: DO NOT delete .next here! It causes downtime.
# Only clean the future build folder.
echo "🧹 Cleaning previous build attempt..."
rm -rf .next_new

# 1. Generate Prisma Client (Ensures types are up to date)
echo "💎 Generating Prisma Client..."
npx prisma generate

# 2. Build fresh to .next_new
echo "📦 Building application to temporary folder..."
export NODE_OPTIONS='--max-old-space-size=4096'
export NEXT_DIST_DIR=.next_new

# Run the next build using the project's build:core script
npm run build:core

echo ""
echo "✅ Build SUCCESSFUL!"
echo "--------------------------------------------------"
echo "Live site is still running on the OLD build (.next)"
echo "To activate the NEW build, run:"
echo "npm run deploy"
echo "--------------------------------------------------"
