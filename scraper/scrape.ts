import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const STATS_FILE = path.join(process.cwd(), 'data', 'stats.json');

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

async function scrapeHQ(url = 'https://www.nvidia.com/en-us/training/self-paced-courses/') {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

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

            // Click tab to activate
            await tab.click();
            await page.waitForTimeout(1000); // Wait for tab switch

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

// Export for testing
export { scrapeHQ, scrapeChina };

// GTC Event Page Scraping Functions
async function scrapeGTCEvent(url: string, isChina: boolean = false) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Wait for content to load
        await page.waitForTimeout(3000);

        const sections: SectionData[] = [];

        // Extract Full-Day Workshops
        const workshopSection: SectionData = {
            title: isChina ? '全天实战培训' : 'Full-Day Workshops',
            count: 0,
            courses: []
        };

        // Find all H3 headers (workshop titles) in the Full-Day Workshops section
        const workshopHeaders = await page.$$('h3');
        for (const header of workshopHeaders) {
            const title = (await header.textContent())?.trim();
            if (!title) continue;

            // Skip section headers
            if (title.includes('Full-Day') || title.includes('全天') ||
                title.includes('Two-Hour') || title.includes('迷你') ||
                title.includes('Get Certified') || title.includes('认证')) {
                continue;
            }

            // Find the "View Details" or "Learn More" link after this header
            const url = await header.evaluate((el) => {
                const parent = el.parentElement;
                if (!parent) return '';
                const link = parent.querySelector('a[href*="session-catalog"]');
                return link?.getAttribute('href') || '';
            });

            if (url) {
                workshopSection.courses.push({
                    title,
                    url: url.startsWith('http') ? url : `https://www.nvidia.com${url}`,
                    price: isChina ? '付费' : 'Paid'
                });
            }
        }

        workshopSection.count = workshopSection.courses.length;
        if (workshopSection.count > 0) {
            sections.push(workshopSection);
        }

        // Extract Training Labs (H2 headers in the Two-Hour section)
        const labSection: SectionData = {
            title: isChina ? '迷你实战课程' : 'Training Labs',
            count: 0,
            courses: []
        };

        const labHeaders = await page.$$('h2');
        for (const header of labHeaders) {
            const title = (await header.textContent())?.trim();
            if (!title) continue;

            // Skip section headers and other non-lab titles
            if (title.includes('Two-Hour') || title.includes('迷你') ||
                title.includes('Group Pricing') || title.includes('团体') ||
                title.includes('Get Certified') || title.includes('认证') ||
                title.includes('Full-Day') || title.includes('全天')) {
                continue;
            }

            // Find the "Learn More" link after this header
            const url = await header.evaluate((el) => {
                const parent = el.parentElement;
                if (!parent) return '';
                const link = parent.querySelector('a[href*="session-catalog"]');
                return link?.getAttribute('href') || '';
            });

            if (url) {
                labSection.courses.push({
                    title,
                    url: url.startsWith('http') ? url : `https://www.nvidia.com${url}`,
                    price: isChina ? '包含在培训通行证中' : 'Included with Training Lab Pass'
                });
            }
        }

        labSection.count = labSection.courses.length;
        if (labSection.count > 0) {
            sections.push(labSection);
        }

        const total = sections.reduce((sum, s) => sum + s.count, 0);
        console.log(`Found ${total} GTC sessions (${workshopSection.count} workshops, ${labSection.count} labs)`);

        return { sections, total };

    } finally {
        await browser.close();
    }
}

const CONFIG_FILE = path.join(process.cwd(), 'data', 'event_config.json');

async function main() {
    console.log('Starting scrape...');
    const startTime = Date.now();

    // Load config
    let eventConfig = { hqUrl: '', chinaUrl: '' };
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            eventConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        } catch (e) {
            console.log('Error reading event config');
        }
    }

    // Scrape with error handling for each source
    let hq = { sections: [], total: 0 };
    let china = { sections: [], total: 0 };

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

    // Scrape events if URLs are provided
    let eventHQ: { sections: SectionData[], total: number } = { sections: [], total: 0 };
    let eventChina: { sections: SectionData[], total: number } = { sections: [], total: 0 };

    if (eventConfig.hqUrl) {
        console.log(`Scraping HQ Event: ${eventConfig.hqUrl}`);
        try {
            eventHQ = await scrapeGTCEvent(eventConfig.hqUrl, false);
            console.log(`✓ HQ Event scrape successful: ${eventHQ.total} sessions`);
        } catch (e) {
            console.error('✗ HQ Event scrape failed:', e);
        }
    }

    if (eventConfig.chinaUrl) {
        console.log(`Scraping China Event: ${eventConfig.chinaUrl}`);
        try {
            eventChina = await scrapeGTCEvent(eventConfig.chinaUrl, true);
            console.log(`✓ China Event scrape successful: ${eventChina.total} sessions`);
        } catch (e) {
            console.error('✗ China Event scrape failed:', e);
        }
    }

    console.log(`Scrape completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`HQ: ${hq.total}, China: ${china.total}, EventHQ: ${eventHQ.total}, EventChina: ${eventChina.total}`);

    // Load previous data
    let previous = {
        hq: { sections: [], total: 0 },
        china: { sections: [], total: 0 },
        event: { hq: { sections: [], total: 0 }, china: { sections: [], total: 0 } }
    };

    if (fs.existsSync(STATS_FILE)) {
        try {
            const existing = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
            previous = existing.current || previous;
            // Ensure structure compatibility if upgrading from old stats
            if (!previous.event) {
                previous.event = { hq: { sections: [], total: 0 }, china: { sections: [], total: 0 } };
            }
        } catch (e) {
            console.log('Error reading existing stats');
        }
    }

    // Save new data - ALWAYS update timestamp
    const data = {
        timestamp: new Date().toISOString(),
        current: {
            hq,
            china,
            event: {
                hq: eventHQ,
                china: eventChina
            }
        },
        previous
    };

    fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
    console.log('✓ Stats saved to', STATS_FILE);
    console.log('✓ Timestamp updated to:', data.timestamp);
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}
