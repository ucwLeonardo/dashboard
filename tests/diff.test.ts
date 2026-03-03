
import { describe, it, expect } from 'vitest';

interface Course {
    title: string;
    url: string;
    price: string;
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

// Copied from App.tsx (cannot import directly since it's embedded in a React component)
const getAccumulatedDiff = (history: ChangeEntry[] | undefined, region: 'hq' | 'china') => {
    if (!history || history.length === 0) return { added: [], removed: [], delta: 0 };
    const allAdded = history.flatMap(e => e[region].added);
    const allRemoved = history.flatMap(e => e[region].removed);
    const netAdded = allAdded
        .filter(a => !allRemoved.find(r => r.url === a.url))
        .filter((a, i, arr) => arr.findIndex(x => x.url === a.url) === i);
    const netRemoved = allRemoved
        .filter(r => !allAdded.find(a => a.url === r.url))
        .filter((r, i, arr) => arr.findIndex(x => x.url === r.url) === i);
    return { added: netAdded, removed: netRemoved, delta: netAdded.length - netRemoved.length };
};

const makeEntry = (
    added: Course[],
    removed: Course[],
    timestamp = '2024-01-01T00:00:00Z'
): ChangeEntry => ({
    timestamp,
    hq: { added, removed },
    china: { added: [], removed: [] },
});

describe('getAccumulatedDiff', () => {
    const courseA = { title: 'A', url: 'http://a', price: 'Free' };
    const courseB = { title: 'B', url: 'http://b', price: 'Free' };
    const courseC = { title: 'C', url: 'http://c', price: 'Free' };

    // Case 1: Empty history
    it('returns empty result for undefined history', () => {
        const result = getAccumulatedDiff(undefined, 'hq');
        expect(result).toEqual({ added: [], removed: [], delta: 0 });
    });

    it('returns empty result for empty history array', () => {
        const result = getAccumulatedDiff([], 'hq');
        expect(result).toEqual({ added: [], removed: [], delta: 0 });
    });

    // Case 2: Single entry with additions
    it('returns added courses from a single entry', () => {
        const history = [makeEntry([courseA, courseB], [])];
        const result = getAccumulatedDiff(history, 'hq');
        expect(result.added).toHaveLength(2);
        expect(result.added.map(c => c.url)).toContain('http://a');
        expect(result.added.map(c => c.url)).toContain('http://b');
        expect(result.removed).toHaveLength(0);
        expect(result.delta).toBe(2);
    });

    // Case 3: Single entry with removals
    it('returns removed courses from a single entry', () => {
        const history = [makeEntry([], [courseA, courseB])];
        const result = getAccumulatedDiff(history, 'hq');
        expect(result.removed).toHaveLength(2);
        expect(result.removed.map(c => c.url)).toContain('http://a');
        expect(result.removed.map(c => c.url)).toContain('http://b');
        expect(result.added).toHaveLength(0);
        expect(result.delta).toBe(-2);
    });

    // Case 4: Net cancellation — course added in entry 1, removed in entry 2 → neither in output
    it('cancels out a course added then removed', () => {
        const history = [
            makeEntry([courseA], [], '2024-01-01T00:00:00Z'),
            makeEntry([], [courseA], '2024-01-02T00:00:00Z'),
        ];
        const result = getAccumulatedDiff(history, 'hq');
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
        expect(result.delta).toBe(0);
    });

    // Case 5: Reverse cancellation — course removed in entry 1, added back in entry 2 → neither in output
    it('cancels out a course removed then added back', () => {
        const history = [
            makeEntry([], [courseA], '2024-01-01T00:00:00Z'),
            makeEntry([courseA], [], '2024-01-02T00:00:00Z'),
        ];
        const result = getAccumulatedDiff(history, 'hq');
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
        expect(result.delta).toBe(0);
    });

    // Case 6: No cancellation — different courses in each entry both appear in result
    it('accumulates distinct added and removed courses across entries', () => {
        const history = [
            makeEntry([courseA], [courseB], '2024-01-01T00:00:00Z'),
            makeEntry([courseC], [],        '2024-01-02T00:00:00Z'),
        ];
        const result = getAccumulatedDiff(history, 'hq');
        expect(result.added).toHaveLength(2);
        expect(result.added.map(c => c.url)).toContain('http://a');
        expect(result.added.map(c => c.url)).toContain('http://c');
        expect(result.removed).toHaveLength(1);
        expect(result.removed[0].url).toBe('http://b');
        expect(result.delta).toBe(1);
    });

    // Case 7: Duplicate URL deduplication — same URL added in two entries → appears only once
    it('deduplicates the same URL added in multiple entries', () => {
        const history = [
            makeEntry([courseA], [], '2024-01-01T00:00:00Z'),
            makeEntry([courseA], [], '2024-01-02T00:00:00Z'),
        ];
        const result = getAccumulatedDiff(history, 'hq');
        expect(result.added).toHaveLength(1);
        expect(result.added[0].url).toBe('http://a');
        expect(result.delta).toBe(1);
    });

    // Case 8: China region — course in china.added appears in result when region is 'china'
    it('reads from the china region independently of hq', () => {
        const history: ChangeEntry[] = [{
            timestamp: '2024-01-01T00:00:00Z',
            hq: { added: [], removed: [] },
            china: { added: [courseA], removed: [] },
        }];
        const result = getAccumulatedDiff(history, 'china');
        expect(result.added).toHaveLength(1);
        expect(result.added[0].url).toBe('http://a');
        expect(result.delta).toBe(1);
    });
});
