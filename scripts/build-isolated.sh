#!/bin/bash
set -e

echo "🧹 Cleaning isolated build directory..."
rm -rf /tmp/crowncare-isolated-build

echo "📦 Creating isolated build environment..."
mkdir -p /tmp/crowncare-isolated-build
cd /tmp/crowncare-isolated-build

echo "📋 Copying source files..."
rsync -av --exclude='.next' --exclude='.next_new' --exclude='.next_old' --exclude='node_modules' /var/www/crowncare/ .

echo "📦 Installing dependencies..."
npm ci

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🏗️  Building application (isolated, zero downtime)..."
export NODE_OPTIONS='--max-old-space-size=4096'
export NEXT_DIST_DIR=.next_new
npm run build:core

echo "✅ Build complete! Moving to production..."
cp -r .next_new /var/www/crowncare/

echo "🧹 Cleaning up temp directory..."
cd /var/www/crowncare
rm -rf /tmp/crowncare-isolated-build

echo "✨ Isolated build ready for deployment!"
echo "Run 'npm run deploy' to swap and restart"
