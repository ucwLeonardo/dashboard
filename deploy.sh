#!/bin/bash

# DLI Dashboard Unified Deployment Script
# Reverted to port 5173 for the frontend
# Includes fallback if PM2 is missing

set -e

echo "🚀 Starting deployment for DLI Dashboard (Port 5173)..."

# 1. Kill potentially hanging processes
echo "🧹 Cleaning up ports 5173 and 3001..."
fuser -k 5173/tcp 3001/tcp || true

# 2. Install Project Dependencies
echo "📦 Installing npm dependencies..."
npm install

# 3. Build Frontend
echo "🏗️ Building frontend..."
npm run build

# 4. Run Detailed Scraper (First time to populate data)
echo "🔍 Running initial detailed scrape..."
npx tsx scraper/scrape.ts

# 5. Start Services
if command -v pm2 &> /dev/null
then
    echo "🔄 Starting services with PM2..."
    pm2 delete dli-backend dli-frontend || true
    pm2 start npx --name "dli-backend" -- tsx server/index.ts
    pm2 serve dist 5173 --name "dli-frontend" --spa
    pm2 save
else
    echo "⚠️ PM2 not found. Starting servers in background..."
    # Start Backend
    nohup npx tsx server/index.ts > backend.log 2>&1 &
    # Start Frontend
    nohup npx serve -s dist -l 5173 > frontend.log 2>&1 &
    echo "Servers started in background. Check backend.log and frontend.log for details."
fi

echo "✅ Deployment complete!"
echo "Dashboard live at: http://localhost:5173"
echo "API live at: http://localhost:3001/api/stats"
