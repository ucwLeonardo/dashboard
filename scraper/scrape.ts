import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getCourseIdentity } from '../src/courseIdentity.ts';
import { getCertIdentity } from '../src/certIdentity.ts';
import { scrapeCertifications, Certification, CertSection } from './scrapeCertifications.ts';

const STATS_FILE = path.join(process.cwd(), 'data', 'stats.json');
const CERT_FILE = path.join(process.cwd(), 'data', 'certifications.json');

interface Course {
    title: string;
    url: string;
    price: string;
}

interface SectionData {
    title: string;
    count: number;
    courses: Course[];
}

interface DiffResult {
    added: Course[];
    removed: Course[];
}

interface ChangeEntry {
    timestamp: string;
    hq: DiffResult;
    china: DiffResult;
}

async function scrapeHQ(url = 'https://www.nvidia.com/en-us/training/self-paced-courses/') {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Dismiss cookie banner if present (OneTrust)
        try {
            const acceptButton = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept All"), button:has-text("Accept Cookies")').first();
            if (await acceptButton.count() > 0) {
                await acceptButton.click({ timeout: 5000 });
                console.log('✓ Dismissed cookie banner');
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('No cookie banner found or already dismissed');
        }

        // Wait for DLI widget content
        try {
            await page.waitForSelector('.dli--card', { timeout: 10000 });
        } catch (e) {
            console.log('Timeout waiting for HQ cards');
        }

        // Wait for tabs to appear
        try {
            await page.waitForSelector('.cmp-tabs__tab', { timeout: 15000 });
        } catch (e) {
            console.log('Timeout waiting for HQ tabs');
        }

        const tabs = await page.$$('.cmp-tabs__tab');
        // console.log(`HQ found ${tabs.length} tabs`);

        // Iterate through tabs to ensure all content is loaded
        for (const tab of tabs) {
            const tabTitle = (await tab.textContent())?.trim() || 'Unknown';
            if (tabTitle.includes('Infrastructure') || tabTitle === 'Unknown') continue;

            // Click tab to activate (force: true to bypass cookie overlay)
            await tab.click({ force: true });
            await page.waitForTimeout(1500); // Wait for tab switch and card loading

            // Click "Show More" buttons for the *active* tab
            // Target specific text to avoid clicking "Reset" or other buttons
            for (let i = 0; i < 20; i++) {
                const button = page.locator('button.dli-secondary-button:visible').filter({ hasText: 'Show More' }).first();
                if (await button.count() === 0) break;
                try {
                    // console.log(`Clicking Show More on ${tabTitle} (${i+1})`);
                    await button.click({ force: true, timeout: 3000 });
                    await page.waitForTimeout(1500);
                } catch {
                    break;
                }
            }
        }

        // Now scrape the fully expanded panels
        const panels = await page.$$('.cmp-tabs__tabpanel');
        const sections: SectionData[] = [];

        for (const panel of panels) {
            const labelledBy = await panel.getAttribute('aria-labelledby');
            let title = 'Unknown';
            if (labelledBy) {
                const titleEl = await page.$(`#${labelledBy}`);
                if (titleEl) {
                    title = (await titleEl.textContent())?.trim() || 'Unknown';
                }
            }

            if (title === 'Infrastructure' || title === 'Unknown') continue;

            // Restrict to cards inside .dli--container as requested for accuracy
            // Some tabs might have "Featured" lists outside the main container which causes duplicates
            const courseCards = await panel.$$('.dli--container .dli--card');
            // If specific container not found, fallback to just .dli--card inside panel
            if (courseCards.length === 0) {
                const fallbackCards = await panel.$$('.dli--card');
                if (fallbackCards.length > 0) {
                    // console.log('  Using fallback selector .dli--card');
                }
            }

            // Actually, let's try to query the container first
            const container = await panel.$('.dli--container');
            const targetCards = container ? await container.$$('.dli--card') : await panel.$$('.dli--card');

            const courses: Course[] = [];

            for (const card of targetCards) {
                const titleText = (await (await card.$('.dli--title'))?.textContent())?.trim() || '';
                const url = await card.getAttribute('href') || '';

                let price = 'Free';
                const descItems = await card.$$('.dli--description li');
                if (descItems.length > 0) {
                    const text = await descItems[descItems.length - 1].textContent();
                    if (text && (text.includes('$') || text.includes('Free'))) {
                        price = text.trim();
                    }
                }

                courses.push({ title: titleText, url, price });
            }

            console.log(`Found ${courses.length} courses in ${title}`);
            if (courses.length > 0) {
                sections.push({ title, count: courses.length, courses });
            }
        }

        return { sections, total: sections.reduce((sum, s) => sum + s.count, 0) };
    } finally {
        await browser.close();
    }
}

async function scrapeChina(url = 'https://www.nvidia.cn/training/online/') {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for tabs
        try {
            await page.waitForSelector('li[data-tab]', { timeout: 15000 });
        } catch (e) {
            console.log('Timeout waiting for China tabs');
        }

        // Expand "Show More" if needed (though it seems China page uses tabs now, not show more?)
        // The debug HTML showed "加载更多" button might still exist for specific tabs?
        // Let's keep the click logic but target generic buttons just in case, but rely mainly on tabs.

        const tabs = await page.$$('li[data-tab]');
        const sections: SectionData[] = [];

        // console.log(`China found ${tabs.length} tabs`);

        for (const tab of tabs) {
            const title = (await tab.textContent())?.trim() || 'Unknown';
            const contentId = await tab.getAttribute('data-tab');

            // console.log(`Processing China tab: ${title}`);

            if (title.includes('基础架构') || title === 'Unknown' || !contentId) continue;

            const contentDiv = await page.$(`#${contentId}`);
            if (!contentDiv) {
                console.log(`  Content div not found for ${title}`);
                continue;
            }

            // Find cards within the content div
            // Cards seem to be in .card2p or just .textcomponentenhanced inside generic columns
            // Let's look for the title h4 elements which define a course start
            const cardTitles = await contentDiv.$$('h4');
            const courses: Course[] = [];

            for (const titleEl of cardTitles) {
                // Navigate up to finds the container or siblings
                // The structure is complex: .textcomponentenhanced (Title) -> sibling .textcomponentenhanced (Price) -> sibling .button (Link)
                // A safer way involves finding the common parent or traversing.
                // In debug HTML: .card2p -> .card -> .column-1 (.textcomponentenhanced Title) -> .textcomponentenhanced (Price) -> .button (Link)
                // So we can find .card and extract info from it.

                // Let's try to find .card containers inside the contentDiv
                const cards = await contentDiv.$$('.card');
                if (cards.length > 0) {
                    // Iterate cards
                    for (const card of cards) {
                        const h4 = await card.$('h4');
                        const courseTitle = h4 ? (await h4.textContent())?.trim() || '' : '';
                        if (!courseTitle) continue;

                        const linkEl = await card.$('a');
                        const url = linkEl ? await linkEl.getAttribute('href') || '' : '';

                        let price = 'Free';
                        const priceEl = await card.$('.time-price p, .description p');
                        if (priceEl) {
                            const text = await priceEl.textContent();
                            if (text) {
                                const priceMatch = text.match(/(\d+\s*美元|免费|限时免费)/);
                                if (priceMatch) {
                                    price = priceMatch[0];
                                } else if (text.includes('Free')) {
                                    price = 'Free';
                                } else if (text.includes('$')) {
                                    const dollarMatch = text.match(/\$\d+/);
                                    if (dollarMatch) price = dollarMatch[0];
                                }
                            }
                        }
                        courses.push({ title: courseTitle, url, price });
                    }
                    break; // If we found cards via .card, stop trying other methods for this tab
                } else {
                    // Fallback: finding h4 and looking near it
                    const courseTitle = (await titleEl.textContent())?.trim() || '';
                    // This path is harder without a container. 
                    // Let's assume .card exists based on debug HTML.
                }
            }

            // If cards array is empty, re-try finding .card directly in contentDiv
            if (courses.length === 0) {
                const cards = await contentDiv.$$('.card');
                for (const card of cards) {
                    const h4 = await card.$('h4');
                    const courseTitle = h4 ? (await h4.textContent())?.trim() || '' : '';
                    if (!courseTitle) continue;

                    const linkEl = await card.$('a');
                    const url = linkEl ? await linkEl.getAttribute('href') || '' : '';

                    let price = 'Free';
                    // Look for price in description or time-price
                    const priceEl = await card.$('.time-price, .description'); // Broaden search
                    if (priceEl) {
                        const text = await priceEl.innerText();
                        if (text) {
                            // Strictly look for price patterns
                            const priceMatch = text.match(/(\d+\s*美元|免费|限时免费)/);
                            if (priceMatch) {
                                price = priceMatch[0];
                            } else if (text.includes('Free')) {
                                price = 'Free';
                            } else if (text.includes('$')) {
                                const dollarMatch = text.match(/\$\d+/);
                                if (dollarMatch) price = dollarMatch[0];
                            }
                        }
                    }
                    courses.push({ title: courseTitle, url, price });
                }
            }

            console.log(`Found ${courses.length} courses in ${title}`);
            if (courses.length > 0) {
                sections.push({ title, count: courses.length, courses });
            }
        }

        return { sections, total: sections.reduce((sum, s) => sum + s.count, 0) };
    } finally {
        await browser.close();
    }
}

interface CertChange {
    cert: Certification;
    changes: string;
}

interface CertDiffResult {
    added: Certification[];
    removed: Certification[];
    changed: CertChange[];
}

interface CertChangeEntry {
    timestamp: string;
    diff: CertDiffResult;
}

// Export for testing
export { scrapeHQ, scrapeChina };

function computeCertDiff(
    current: { sections: CertSection[] },
    previous: { sections: CertSection[] }
): CertDiffResult {
    const currentCerts = current.sections.flatMap(s => s.certifications);
    const previousCerts = previous.sections.flatMap(s => s.certifications);

    const added = currentCerts.filter(
        c => !previousCerts.find(p => getCertIdentity(p) === getCertIdentity(c))
    );
    const removed = previousCerts.filter(
        p => !currentCerts.find(c => getCertIdentity(c) === getCertIdentity(p))
    );

    // Detect changes (same cert code, different price/duration/description)
    const changed: CertChange[] = [];
    for (const curr of currentCerts) {
        const prev = previousCerts.find(p => getCertIdentity(p) === getCertIdentity(curr));
        if (!prev) continue;
        const diffs: string[] = [];
        if (prev.price !== curr.price) diffs.push(`价格: ${prev.price} → ${curr.price}`);
        if (prev.duration !== curr.duration) diffs.push(`时长: ${prev.duration} → ${curr.duration}`);
        if (prev.description !== curr.description) diffs.push('描述已更新');
        if (diffs.length > 0) {
            changed.push({ cert: curr, changes: diffs.join('; ') });
        }
    }

    return { added, removed, changed };
}

function computeDiff(current: { sections: SectionData[] }, previous: { sections: SectionData[] }): DiffResult {
    const currentCourses = current.sections.flatMap(s => s.courses);
    const previousCourses = previous.sections.flatMap(s => s.courses);
    const added = currentCourses.filter(c => !previousCourses.find(p => getCourseIdentity(p) === getCourseIdentity(c)));
    const removed = previousCourses.filter(p => !currentCourses.find(c => getCourseIdentity(c) === getCourseIdentity(p)));
    return { added, removed };
}

async function main() {
    console.log('Starting scrape...');
    const startTime = Date.now();

    // Scrape with error handling for each source
    let hq = { sections: [] as SectionData[], total: 0 };
    let china = { sections: [] as SectionData[], total: 0 };
    let certs = { sections: [] as CertSection[], total: 0 };
    let certScrapeFailed = false;

    try {
        hq = await scrapeHQ();
        console.log(`✓ HQ scrape successful: ${hq.total} courses`);
    } catch (e) {
        console.error('✗ HQ scrape failed:', e);
    }

    try {
        china = await scrapeChina();
        console.log(`✓ China scrape successful: ${china.total} courses`);
    } catch (e) {
        console.error('✗ China scrape failed:', e);
    }

    try {
        certs = await scrapeCertifications();
        console.log(`✓ Certifications scrape successful: ${certs.total} certifications`);
    } catch (e) {
        certScrapeFailed = true;
        console.error('✗ Certifications scrape failed:', e);
    }

    console.log(`Scrape completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`HQ: ${hq.total}, China: ${china.total}, Certs: ${certs.total}`);

    // --- Course stats ---
    let previous = {
        hq: { sections: [] as SectionData[], total: 0 },
        china: { sections: [] as SectionData[], total: 0 }
    };

    let changesHistory: ChangeEntry[] = [];
    if (fs.existsSync(STATS_FILE)) {
        try {
            const existing = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
            previous = existing.current || previous;
            changesHistory = existing.changesHistory || [];
        } catch (e) {
            console.error('Error reading existing stats file:', STATS_FILE, e);
        }
    }

    // Compute diff and update history
    // Guard: skip diff for a region if scrape returned 0 courses but previous had courses (likely a scrape failure)
    const hqScrapeSucceeded = hq.total > 0 || previous.hq.total === 0;
    const chinaScrapeSucceeded = china.total > 0 || previous.china.total === 0;
    const hqDiff = hqScrapeSucceeded ? computeDiff(hq, previous.hq) : { added: [], removed: [] };
    const chinaDiff = chinaScrapeSucceeded ? computeDiff(china, previous.china) : { added: [], removed: [] };

    if (hqDiff.added.length > 0 || hqDiff.removed.length > 0 ||
        chinaDiff.added.length > 0 || chinaDiff.removed.length > 0) {
        changesHistory.push({
            timestamp: new Date().toISOString(),
            hq: hqDiff,
            china: chinaDiff
        });
    }

    // Prune entries older than 7 days
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    changesHistory = changesHistory.filter(e => new Date(e.timestamp).getTime() > cutoff);

    // Save course stats
    const data = {
        timestamp: new Date().toISOString(),
        current: {
            hq,
            china
        },
        previous,
        changesHistory
    };

    fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
    console.log('✓ Stats saved to', STATS_FILE);

    // --- Certification stats ---
    let certPrevious = { sections: [] as CertSection[], total: 0 };
    let certChangesHistory: CertChangeEntry[] = [];

    if (fs.existsSync(CERT_FILE)) {
        try {
            const existing = JSON.parse(fs.readFileSync(CERT_FILE, 'utf-8'));
            certPrevious = existing.current || certPrevious;
            certChangesHistory = existing.changesHistory || [];
        } catch (e) {
            console.error('Error reading existing cert file:', CERT_FILE, e);
        }
    }

    // Use explicit failure flag — not count-based inference
    // certScrapeFailed = true means the scrape threw an error (network, timeout, etc.)
    // A successful scrape returning 0 is a legitimate state change
    const certCurrent = certScrapeFailed ? certPrevious : certs;

    if (!certScrapeFailed) {
        const certDiff = computeCertDiff(certs, certPrevious);
        if (certDiff.added.length > 0 || certDiff.removed.length > 0 || certDiff.changed.length > 0) {
            certChangesHistory.push({
                timestamp: new Date().toISOString(),
                diff: certDiff
            });
        }
    } else {
        console.log('⚠ Cert scrape failed — preserving previous data');
    }

    certChangesHistory = certChangesHistory.filter(e => new Date(e.timestamp).getTime() > cutoff);

    // Always write: updates timestamp and prunes stale history even on failure
    const certData = {
        timestamp: new Date().toISOString(),
        current: certCurrent,
        previous: certPrevious,
        changesHistory: certChangesHistory
    };

    fs.writeFileSync(CERT_FILE, JSON.stringify(certData, null, 2));
    console.log('✓ Certifications saved to', CERT_FILE);
    console.log('✓ Timestamp updated to:', data.timestamp);
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}
