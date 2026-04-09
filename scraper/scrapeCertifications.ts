import { chromium } from 'playwright';

const CERT_URL = 'https://www.nvidia.com/en-us/learn/certification/';

export interface Certification {
    title: string;
    level: string;
    description: string;
    price: string;
    duration: string;
    code: string;
    url: string;
}

export interface CertSection {
    title: string;
    count: number;
    certifications: Certification[];
}

export async function scrapeCertifications(url = CERT_URL) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for certification tab structure to fully render
        try {
            await page.waitForSelector('[role="tab"]', { timeout: 30000 });
        } catch {
            console.log('Cert: Timeout waiting for tabs');
        }

        // Dismiss OneTrust cookie consent overlay
        // Must handle this before any interaction, as the overlay intercepts pointer events
        try {
            const acceptButton = page.locator(
                '#onetrust-accept-btn-handler, button:has-text("Agree")'
            ).first();
            if (await acceptButton.count() > 0) {
                await acceptButton.click({ timeout: 5000 });
                console.log('✓ Cert: Dismissed cookie banner');
                await page.waitForTimeout(1000);
            }
        } catch {
            console.log('Cert: No cookie banner found or already dismissed');
        }

        // Also wait for cert card links to appear
        try {
            await page.waitForSelector('a[href*="/certification/"]', { timeout: 15000 });
        } catch {
            console.log('Cert: Timeout waiting for certification cards');
        }

        // Extract all certifications using DOM traversal
        // DOM structure: grandparent div contains [wrapper(tablist), tabpanel, tabpanel, tabpanel, tabpanel]
        // The tablist is inside a wrapper div; tabpanels are siblings of that wrapper at grandparent level
        const result = await page.evaluate(() => {
            const tablist = document.querySelector('[role="tablist"]');
            if (!tablist || !tablist.parentElement?.parentElement) return { sections: [], total: 0 };

            const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
            const grandparent = tablist.parentElement.parentElement;
            const allChildren = Array.from(grandparent.children);

            // Panels are children with role="tabpanel", in tab order
            const panels = allChildren.filter(el => el.getAttribute('role') === 'tabpanel');

            const sections: { title: string; count: number; certifications: {
                title: string; level: string; description: string;
                price: string; duration: string; code: string; url: string;
            }[] }[] = [];

            for (let i = 0; i < tabs.length && i < panels.length; i++) {
                const tabName = tabs[i].textContent?.trim() || '';
                const panel = panels[i];

                const links = Array.from(panel.querySelectorAll('a[href*="/certification/"]'));
                const certs = links.map(link => {
                    const h3 = link.querySelector('h3');
                    const title = h3?.textContent?.trim() || '';
                    const href = link.getAttribute('href') || '';

                    // Level: find first nested div text containing "NVIDIA-Certified"
                    let level = '';
                    const divs = link.querySelectorAll('div > div');
                    for (const d of divs) {
                        const t = d.textContent?.trim() || '';
                        if (t.includes('Professional')) { level = 'Professional'; break; }
                        if (t.includes('Associate')) { level = 'Associate'; break; }
                    }

                    // Paragraphs: first = description, last = price/duration/code
                    const ps = link.querySelectorAll('p');
                    const description = ps.length > 0 ? (ps[0].textContent?.trim() || '') : '';

                    let price = '', duration = '', code = '';
                    if (ps.length >= 2) {
                        const info = (ps[ps.length - 1] as HTMLElement).innerText?.trim() || '';
                        const pm = info.match(/\$\d+/);
                        if (pm) price = pm[0];
                        const dm = info.match(/(\d+\s*hours?)/i);
                        if (dm) duration = dm[0];
                        const cm = info.match(/\b(NC[PA]-[A-Z]{2,5})\b/);
                        if (cm) code = cm[0];
                    }

                    return { title, level, description, price, duration, code, url: href };
                }).filter(c => c.title);

                if (certs.length > 0) {
                    sections.push({ title: tabName, count: certs.length, certifications: certs });
                }
            }

            return { sections, total: sections.reduce((s, sec) => s + sec.count, 0) };
        });

        for (const s of result.sections) {
            console.log(`Found ${s.count} certifications in ${s.title}`);
        }

        return result;
    } finally {
        await browser.close();
    }
}
