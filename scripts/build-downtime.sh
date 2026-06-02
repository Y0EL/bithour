#!/bin/bash
set -e

echo "🏗️  Building Crowncare (Clean Build with Controlled Downtime)..."

# Make sure we're in the right directory
cd /var/www/crowncare

echo "⏸️  Stopping crowncare temporarily..."
pm2 stop crowncare

echo "🧹 Force cleaning ALL .next folders..."
rm -rf .next .next_new .next_old

echo "📦 Building application (fresh, no cache)..."
export NODE_OPTIONS='--max-old-space-size=2048'
export NEXT_DIST_DIR=.next
npm run build:core

echo "▶️  Restarting crowncare..."
pm2 restart crowncare

echo "✅ Build complete and service restarted!"
pm2 logs crowncare --lines 20
