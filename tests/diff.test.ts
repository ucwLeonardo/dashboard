
import { describe, it, expect } from 'vitest';

interface Course {
    title: string;
    url: string;
    price: string;
}

interface Section {
    title: string;
    count: number;
    courses: Course[];
}

// Replicating the logic from App.tsx (or importing if refactored to shared utility)
const getDiff = (current: Section[], previous?: Section[]) => {
    if (!previous) return { added: [], removed: [], delta: 0 };

    const currentCourses = current.flatMap(s => s.courses);
    const previousCourses = previous.flatMap(s => s.courses);

    const added = currentCourses.filter(c => !previousCourses.find(p => p.url === c.url));
    const removed = previousCourses.filter(p => !currentCourses.find(c => p.url === c.url));

    return { added, removed, delta: added.length - removed.length };
};

describe('Diff Logic', () => {
    const courseA = { title: 'A', url: 'http://a', price: 'Free' };
    const courseB = { title: 'B', url: 'http://b', price: 'Free' };
    const courseC = { title: 'C', url: 'http://c', price: 'Free' };

    it('should detect added courses', () => {
        const prev = [{ title: 'S1', count: 1, courses: [courseA] }];
        const curr = [{ title: 'S1', count: 2, courses: [courseA, courseB] }];

        const diff = getDiff(curr, prev);
        expect(diff.added).toHaveLength(1);
        expect(diff.added[0].title).toBe('B');
        expect(diff.delta).toBe(1);
    });

    it('should detect removed courses', () => {
        const prev = [{ title: 'S1', count: 2, courses: [courseA, courseB] }];
        const curr = [{ title: 'S1', count: 1, courses: [courseA] }];

        const diff = getDiff(curr, prev);
        expect(diff.removed).toHaveLength(1);
        expect(diff.removed[0].title).toBe('B');
        expect(diff.delta).toBe(-1);
    });

    it('should handle no changes', () => {
        const prev = [{ title: 'S1', count: 1, courses: [courseA] }];
        const curr = [{ title: 'S1', count: 1, courses: [courseA] }];

        const diff = getDiff(curr, prev);
        expect(diff.added).toHaveLength(0);
        expect(diff.removed).toHaveLength(0);
        expect(diff.delta).toBe(0);
    });
});
