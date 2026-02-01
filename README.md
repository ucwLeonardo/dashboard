# NVIDIA DLI Course Dashboard

![Tests](https://github.com/ucwLeonardo/dashboard/actions/workflows/test.yml/badge.svg)

A monitoring dashboard for NVIDIA Deep Learning Institute (DLI) self-paced courses, comparing course availability and counts between the HQ (Global) and China regions.

## Features

- **Daily Automated Scraping**: Runs daily at 00:00 UTC (8:00 AM UTC+8) to fetch the latest course data.
- **Data Diff Tracking**: Tracks changes in course counts and details (New/Removed courses).
- **Dual Region View**: Side-by-side comparison of HQ and China course catalogs.
- **Bilingual & Responsive**: English/Chinese labels matching region standards, with a responsive card-based layout.
- **Theme Support**: Light (Default) and Dark modes.

## Deployment

### 1. Ubuntu Server

A unified deployment script is provided for Ubuntu environments.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/ucwLeonardo/dashboard.git
    cd dashboard
    ```
2.  **Run the deployment script**:
    ```bash
    chmod +x deploy.sh
    ./deploy.sh
    ```
    This script will:
    - Install Node.js dependencies.
    - Build the frontend.
    - Start the backend and frontend services using `pm2` (or `nohup` if pm2 is not available).
    - Serve the application on port `5173`.

### 2. GitHub Actions (Automated Data Updates)

This repository is configured with **GitHub Actions** to handle data updates automatically.

- **Workflow**: `.github/workflows/scrape.yml`
- **Schedule**: Runs daily at 8:00 AM Beijing Time.
- **Behavior**:
    - Scrapes NVIDIA DLI pages.
    - Updates `data/stats.json`.
    - Commits and pushes the updated data back to the `main` branch.
    
**Serving the App via GitHub**:
You can use **GitHub Pages** to serve the dashboard statically.
1.  Go to **Settings** > **Pages**.
2.  Select `main` branch (or configure a workflow to build to `gh-pages`).
3.  *Note*: For static hosting, the frontend will read `data/stats.json` directly from the repository. Ensure the build configuration points to the correct data path.

## Development

### Run Locally

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start Development Server**:
    ```bash
    npm run dev
    ```
3.  **Run Scraper Manually**:
    ```bash
    npx tsx scraper/scrape.ts
    ```

## Testing

Run unit and integration tests:
```bash
npm test
```
