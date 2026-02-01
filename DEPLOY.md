# Deployment Guide (Ubuntu)

This guide explains how to deploy the DLI Dashboard on an Ubuntu server.

## Prerequisites
- Node.js (v20+)
- NPM
- PM2 (`npm install -g pm2`)

## Steps

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the frontend**
   ```bash
   npm run build
   ```

4. **Serve the application**
   You can serve the build folder using Nginx or use PM2 to serve both the backend and frontend.

   **Using PM2 to serve the backend (API & Scheduler):**
   ```bash
   pm2 start npx --name "dli-backend" -- ts-node server/index.ts
   ```

   **Using PM2 to serve the frontend (Static):**
   ```bash
   pm2 serve dist 8080 --name "dli-frontend" --spa
   ```

5. **Nginx Configuration (Optional)**
   If you want to use Nginx as a reverse proxy:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:8080;
       }

       location /api/ {
           proxy_pass http://localhost:3001;
       }
   }
   ```

6. **Playwright Dependencies**
   If you run the scraper on the Ubuntu server manually, ensure dependencies are installed:
   ```bash
   npx playwright install-deps
   ```
