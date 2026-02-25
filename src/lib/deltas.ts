/**
 * Smart Forking Delta Engine
 *
 * A pure, dependency-free utility for computing and applying segment-level
 * deltas on forked study materials.
 *
 * Delta format (stored as JSONB `deltas` column):
 *   { op: 'modify', segmentId, newText?, newTitle?, timestamp }
 *   { op: 'add',    afterId, segment, timestamp }        afterId=null → prepend
 *   { op: 'delete', segmentId, timestamp }
 */

import { Segment } from '@/components/material/SegmentViewer';

// ─────────────────────────── Types ──────────────────────────────────────────

export type ModifyDelta = {
    op: 'modify';
    segmentId: string;
    newText?: string;
    newTitle?: string;
    timestamp: string;
};

export type AddDelta = {
    op: 'add';
    /** The id of the segment this new block should appear AFTER. Null = prepend. */
    afterId: string | null;
    segment: Segment;
    timestamp: string;
};

export type DeleteDelta = {
    op: 'delete';
    segmentId: string;
    timestamp: string;
};

export type Delta = ModifyDelta | AddDelta | DeleteDelta;

// ─────────────────────────── Apply ──────────────────────────────────────────

/**
 * Applies a list of deltas to an original segment array, returning the
 * effective (user-customised) segment tree. This is the runtime merge step.
 *
 * Operates recursively so nested children are also patched.
 */
export function applyDeltas(segments: Segment[], deltas: Delta[]): Segment[] {
    if (!deltas || deltas.length === 0) return segments;

    // Sort deltas by timestamp so they apply in the order they were made.
    const sorted = [...deltas].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let result = deepCloneSegments(segments);

    for (const delta of sorted) {
        if (delta.op === 'modify') {
            result = modifyInTree(result, delta.segmentId, delta);
        } else if (delta.op === 'delete') {
            result = deleteInTree(result, delta.segmentId);
        } else if (delta.op === 'add') {
            result = insertInTree(result, delta.afterId, delta.segment);
        }
    }

    return result;
}

// ─────────────────────────── Compute ────────────────────────────────────────

/**
 * Computes a minimal set of deltas between an `original` and a `modified`
 * segment array. Used when saving user edits back to the database.
 *
 * Strategy:
 *  – Segments removed from `original` → DeleteDelta
 *  – Segments in `modified` that did not exist in `original` → AddDelta
 *  – Segments in both but with different text/title → ModifyDelta
 */
export function computeDeltas(original: Segment[], modified: Segment[]): Delta[] {
    const now = new Date().toISOString();
    const deltas: Delta[] = [];

    const originalMap = flatMap(original);
    const modifiedMap = flatMap(modified);

    // Deletions
    for (const [id] of originalMap) {
        if (!modifiedMap.has(id)) {
            deltas.push({ op: 'delete', segmentId: id, timestamp: now });
        }
    }

    // Additions & Modifications
    const modifiedList = flatList(modified);
    for (let i = 0; i < modifiedList.length; i++) {
        const seg = modifiedList[i];
        if (!originalMap.has(seg.id)) {
            // New segment – find what it comes after
            const afterId = i > 0 ? modifiedList[i - 1].id : null;
            deltas.push({ op: 'add', afterId, segment: seg, timestamp: now });
        } else {
            const orig = originalMap.get(seg.id)!;
            if (orig.text !== seg.text || orig.title !== seg.title) {
                deltas.push({
                    op: 'modify',
                    segmentId: seg.id,
                    newText: seg.text,
                    newTitle: seg.title,
                    timestamp: now,
                });
            }
        }
    }

    return deltas;
}

// ─────────────────────────── Helpers ────────────────────────────────────────

function deepCloneSegments(segments: Segment[]): Segment[] {
    return segments.map((s) => ({
        ...s,
        children: s.children ? deepCloneSegments(s.children) : undefined,
    }));
}

function modifyInTree(segments: Segment[], id: string, delta: ModifyDelta): Segment[] {
    return segments.map((s) => {
        if (s.id === id) {
            return {
                ...s,
                text: delta.newText !== undefined ? delta.newText : s.text,
                title: delta.newTitle !== undefined ? delta.newTitle : s.title,
            };
        }
        if (s.children) {
            return { ...s, children: modifyInTree(s.children, id, delta) };
        }
        return s;
    });
}

function deleteInTree(segments: Segment[], id: string): Segment[] {
    return segments
        .filter((s) => s.id !== id)
        .map((s) => ({
            ...s,
            children: s.children ? deleteInTree(s.children, id) : undefined,
        }));
}

function insertInTree(segments: Segment[], afterId: string | null, newSeg: Segment): Segment[] {
    if (afterId === null) {
        return [newSeg, ...segments];
    }
    const result: Segment[] = [];
    for (const s of segments) {
        result.push(s);
        if (s.id === afterId) {
            result.push(newSeg);
        }
        if (s.children) {
            s.children = insertInTree(s.children, afterId, newSeg);
        }
    }
    return result;
}

/** Flatten the segment tree into a Map<id, segment> for O(1) lookup. */
function flatMap(segments: Segment[]): Map<string, Segment> {
    const map = new Map<string, Segment>();
    function walk(segs: Segment[]) {
        for (const s of segs) {
            map.set(s.id, s);
            if (s.children) walk(s.children);
        }
    }
    walk(segments);
    return map;
}

/** Flatten to an ordered list (depth-first). */
function flatList(segments: Segment[]): Segment[] {
    const list: Segment[] = [];
    function walk(segs: Segment[]) {
        for (const s of segs) {
            list.push(s);
            if (s.children) walk(s.children);
        }
    }
    walk(segments);
    return list;
}
