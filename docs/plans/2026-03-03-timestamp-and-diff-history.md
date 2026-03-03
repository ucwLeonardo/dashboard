# Timestamp Shortening + 1-Week Diff History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shorten the "Last Update" timestamp display and accumulate course diffs across 7 days in `stats.json`.

**Architecture:** The scraper computes diffs at write time and appends them to a `changesHistory` array in `stats.json`, pruning entries older than 7 days. The frontend reads `changesHistory` and computes a net accumulated diff, falling back to `current`/`previous` diff if the field is absent.

**Tech Stack:** TypeScript, React 18, Playwright scraper, Vitest, static JSON on GitHub Pages.

---

### Task 1: Shorten the timestamp display

**Files:**
- Modify: `src/App.tsx:140`

**Step 1: Make the change**

In `src/App.tsx` line 140, change:
```tsx
<p className="update-time">Last Update: {stats ? new Date(stats.timestamp).toLocaleString('en-US') : 'Unknown'}</p>
```
to:
```tsx
<p className="update-time">Last Update: {stats ? new Date(stats.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown'}</p>
```

**Step 2: Verify visually**

Run `npm run dev` and confirm the header shows e.g. `Last Update: 3/3/2026, 6:27 AM` (no seconds).

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix: shorten timestamp display to omit seconds"
```

---

### Task 2: Add diff computation helper to the scraper

**Files:**
- Modify: `scraper/scrape.ts`

**Step 1: Add `computeDiff` function after the `scrapeGTCEvent` export block (around line 273)**

Insert this function before the `CONFIG_FILE` constant:

```typescript
interface DiffResult {
    added: Course[];
    removed: Course[];
}

function computeDiff(current: { sections: SectionData[] }, previous: { sections: SectionData[] }): DiffResult {
    const currentCourses = current.sections.flatMap(s => s.courses);
    const previousCourses = previous.sections.flatMap(s => s.courses);
    const added = currentCourses.filter(c => !previousCourses.find(p => p.url === c.url));
    const removed = previousCourses.filter(p => !currentCourses.find(c => p.url === c.url));
    return { added, removed };
}
```

**Step 2: Add `ChangeEntry` interface alongside the other interfaces (top of file, after `SectionData`)**

```typescript
interface ChangeEntry {
    timestamp: string;
    hq: DiffResult;
    china: DiffResult;
}
```

Note: `DiffResult` must be declared before `ChangeEntry`. Place `DiffResult` interface at the top with the others, and `computeDiff` function near the bottom before `CONFIG_FILE`.

**Step 3: Build to check types**

```bash
npm run build
```
Expected: no TypeScript errors.

---

### Task 3: Update scraper `main()` to accumulate history

**Files:**
- Modify: `scraper/scrape.ts` — the `main()` function

**Step 1: Load existing `changesHistory` after loading previous data (around line 450–461)**

After the block that loads `previous` from the existing file, also load `changesHistory`:

```typescript
let changesHistory: ChangeEntry[] = [];
if (fs.existsSync(STATS_FILE)) {
    try {
        const existing = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
        previous = existing.current || previous;
        if (!previous.event) {
            previous.event = { hq: { sections: [], total: 0 }, china: { sections: [], total: 0 } };
        }
        changesHistory = existing.changesHistory || [];
    } catch (e) {
        console.log('Error reading existing stats');
    }
}
```

(This replaces/merges with the existing try/catch block — keep its structure, just add `changesHistory` loading.)

**Step 2: Compute diff and append to history before saving (after `console.log` for completion, before building `data`)**

```typescript
// Compute diff and update history
const hqDiff = computeDiff(hq, previous.hq);
const chinaDiff = computeDiff(china, previous.china);

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
```

**Step 3: Add `changesHistory` to the saved `data` object**

```typescript
const data = {
    timestamp: new Date().toISOString(),
    current: { hq, china, event: { hq: eventHQ, china: eventChina } },
    previous,
    changesHistory
};
```

**Step 4: Build to check types**

```bash
npm run build
```
Expected: no TypeScript errors.

**Step 5: Commit**

```bash
git add scraper/scrape.ts
git commit -m "feat: accumulate course diff history in stats.json (7-day rolling window)"
```

---

### Task 4: Update frontend to read accumulated diff history

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update the `Stats` interface to include `changesHistory`**

Add to the existing `Stats` interface (around line 22):

```typescript
interface DiffResult {
  added: Course[];
  removed: Course[];
}

interface ChangeEntry {
  timestamp: string;
  hq: DiffResult;
  china: DiffResult;
}

interface Stats {
  timestamp: string;
  changesHistory?: ChangeEntry[];
  current: { ... };   // keep existing
  previous?: { ... }; // keep existing
}
```

**Step 2: Replace `getDiff` with `getAccumulatedDiff`**

Remove the existing `getDiff` function (lines 85–95) and replace with:

```typescript
const getAccumulatedDiff = (history: ChangeEntry[] | undefined, region: 'hq' | 'china') => {
  if (!history || history.length === 0) return { added: [], removed: [], delta: 0 };

  const allAdded = history.flatMap(e => e[region].added);
  const allRemoved = history.flatMap(e => e[region].removed);

  // Net effect: added but not subsequently removed
  const netAdded = allAdded.filter(a => !allRemoved.find(r => r.url === a.url));
  const netRemoved = allRemoved.filter(r => !allAdded.find(a => a.url === r.url));

  return { added: netAdded, removed: netRemoved, delta: netAdded.length - netRemoved.length };
};
```

**Step 3: Update the call sites (lines 116–117)**

Replace:
```typescript
const hqDiff = getDiff(stats?.current.hq.sections || [], stats?.previous?.hq.sections);
const chinaDiff = getDiff(stats?.current.china.sections || [], stats?.previous?.china.sections);
```

With:
```typescript
const hqDiff = getAccumulatedDiff(stats?.changesHistory, 'hq');
const chinaDiff = getAccumulatedDiff(stats?.changesHistory, 'china');
```

**Step 4: Build to check types**

```bash
npm run build
```
Expected: no TypeScript errors.

**Step 5: Verify behavior**

Run `npm run dev`. With no `changesHistory` in the current `stats.json`, the diff badges should show nothing (empty history = no delta). This is correct — history will accumulate from the next scrape onward.

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: display 7-day accumulated course diff on frontend"
```

---

### Task 5: Push

```bash
cd /home/ubuntu/project/dashboard && git pull --rebase origin main && git push origin main
```
(Run with `dangerouslyDisableSandbox: true` — SSH only works from `/home/ubuntu/project/`.)
