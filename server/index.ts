import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { exec } from 'child_process';

const app = express();
const PORT = 3001; // Keep backend on 3001
const STATS_FILE = path.join(process.cwd(), 'data', 'stats.json');

app.use(cors());
app.use(express.json());

app.get('/api/stats', (req, res) => {
    if (fs.existsSync(STATS_FILE)) {
        const data = fs.readFileSync(STATS_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } else {
        res.status(404).json({ error: 'Stats not found' });
    }
});

const runScrape = () => {
    console.log('Starting scrape...');
    exec('npx tsx scraper/scrape.ts', (error, stdout, stderr) => {
        if (error) {
            console.error(`Scrape error: ${error}`);
            return;
        }
        console.log(`Scrape output: ${stdout}`);
    });
};

// Daily update at 8:00 AM UTC+8 (0:00 AM UTC)
cron.schedule('0 0 * * *', runScrape, {
    timezone: "Asia/Shanghai"
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    // Trigger immediate scrape on startup
    runScrape();
});
