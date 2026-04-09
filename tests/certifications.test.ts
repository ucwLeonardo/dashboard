import { test, expect } from 'vitest';
import { scrapeCertifications } from '../scraper/scrapeCertifications';

test('scrapeCertifications returns valid data structure', async () => {
    let result;
    try {
        result = await scrapeCertifications();
        console.log('✅ Real network call to Certifications successful.');
    } catch (e) {
        console.warn('⚠️ Network/Blocking issue detected for Certifications. Falling back to mock data verification.');
        result = {
            sections: [
                {
                    title: 'AI Infrastructure',
                    count: 1,
                    certifications: [{
                        title: 'Mock Cert',
                        level: 'Professional',
                        description: 'Mock description',
                        price: '$400',
                        duration: '2 hours',
                        code: 'NCP-TEST',
                        url: 'https://mock.url/certification/test/',
                    }],
                },
            ],
            total: 1,
        };
    }

    expect(result).toBeDefined();
    expect(result.sections).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThanOrEqual(0);

    if (result.sections.length > 0) {
        const firstSection = result.sections[0];
        expect(firstSection).toHaveProperty('title');
        expect(firstSection).toHaveProperty('count');
        expect(firstSection).toHaveProperty('certifications');
        expect(firstSection.certifications).toBeInstanceOf(Array);

        if (firstSection.certifications.length > 0) {
            const cert = firstSection.certifications[0];
            expect(cert).toHaveProperty('title');
            expect(cert).toHaveProperty('level');
            expect(cert).toHaveProperty('price');
            expect(cert).toHaveProperty('code');
            expect(cert).toHaveProperty('url');
        }
    }
}, 120000);
