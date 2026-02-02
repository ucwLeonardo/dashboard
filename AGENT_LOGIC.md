# Agent Monitoring Logic

## Overview
The monitoring system is designed to track and compare NVIDIA Deep Learning Institute (DLI) training content across different regions (HQ/Global vs. China). It focuses on two main areas:
1.  **Self-Paced Courses** (Catalog Monitoring)
2.  **Event-Based Training** (Dynamic Event Page Monitoring)

## 1. Self-Paced Courses Monitoring
*   **Target Pages**:
    *   HQ: `https://www.nvidia.com/en-us/training/self-paced-courses/`
    *   China: `https://www.nvidia.cn/training/online/`
*   **Logic**:
    *   **Scraping**: A Playwright-based scraper navigates to the pages.
        *   It handles tab navigation (clicking through categories).
        *   It expands "Show More" sections to load all courses.
        *   It extracts course titles, URLs, and pricing (Free/Paid).
    *   **Categorization**: Courses are grouped by their tab/category (e.g., Generative AI, Deep Learning).
    *   **Comparison**:
        *   The dashboard aligns China's categories with HQ's to side-by-side comparison.
        *   It calculates "Diff" (Added/Removed courses compared to the previous scrape).

## 2. Event Page Monitoring (New Feature)
*   **Purpose**: To monitor temporary or season-specific training event pages (e.g., GTC Training).
*   **Target Pages**: Configurable via the Dashboard UI.
    *   Users can input specific "HQ Event URL" and "China Event URL".
    *   Example: `https://www.nvidia.com/gtc/training/` vs `https://www.nvidia.cn/gtc/training/`
*   **Logic**:
    *   **Configuration**: URLs are stored in `data/event_config.json`.
    *   **Scraping**:
        *   The scraper reads the config.
        *   It reuses the robust scraping logic from the Self-Paced comparison (handling DLI component structures, cards, and lists).
        *   It extracts course/session counts and titles.
    *   **Display**:
        *   A dedicated "Event Monitor" component appears in the dashboard.
        *   It shows the event statistics if URLs are active.
        *   If no URLs are configured, it remains in a "waiting for input" state.

## Automation & Workflow
*   **Daily Schedule**: A GitHub Actions workflow (`scrape.yml`) runs automatically every day at 8:00 AM UTC+8 to scrape the configured pages and update `data/stats.json`.
*   **On-Demand/Commit**:
    *   When the Event URLs are updated and saved via the Dashboard (running locally or with backend), a scrape is triggered immediately.
    *   On code commits (push to main), the scraping workflow is also triggered to ensure data is fresh.
    *   The scraped data (`stats.json`) is committed back to the repository to serve as the static data source for the frontend.

## Development Guidelines
*   **Git Workflow**: Always pull the repository (`git pull --rebase origin main`) before pushing code changes to avoid conflicts and rejected pushes.
