'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { applyDeltas, computeDeltas, Delta } from '@/lib/deltas';
import { Segment } from '@/components/material/SegmentViewer';

export async function getPublicMaterials({
    searchTerm = '',
    subjectId = '',
    educationSystem = '',
}: {
    searchTerm?: string;
    subjectId?: string;
    educationSystem?: string;
}) {
    const supabase = await createClient();

    let query = supabase
        .from('materials')
        .select(`
      id,
      title,
      description,
      subject_id,
      created_at,
      upvotes,
      downvotes,
      helped_me_pass,
      fork_count,
      trust_score,
      subject_tags,
      education_system_tags,
      original_material_id
    `)
        .gte('trust_score', -5)
        .order('trust_score', { ascending: false })
        .order('created_at', { ascending: false });

    if (searchTerm) {
        // using pg full-text search or ilike
        query = query.ilike('title', `%${searchTerm}%`);
    }

    if (subjectId) {
        query = query.eq('subject_id', subjectId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching public materials:', error);
        return [];
    }

    // Frontend-side tag filtering if needed, though better handled in DB if tags are JSONB
    let filteredData = data;
    if (educationSystem) {
        filteredData = data.filter((m: any) =>
            m.education_system_tags && m.education_system_tags.includes(educationSystem)
        );
    }

    return filteredData;
}

export async function importMaterial(originalId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    // 1. Fetch original material
    const { data: originalMaterial, error: fetchError } = await supabase
        .from('materials')
        .select('*')
        .eq('id', originalId)
        .single();

    if (fetchError || !originalMaterial) {
        throw new Error('Original material not found');
    }

    // 2. Insert fork
    // Storage efficient: segments will be empty array, we will rely on original_material_id to fetch segments if needed
    // Alternatively we can just copy them if they are small, but to be storage efficient:

    const { data: newMaterial, error: insertError } = await supabase
        .from('materials')
        .insert({
            user_id: user.id,
            original_material_id: originalMaterial.id,
            title: `${originalMaterial.title} (Remixed)`,
            description: originalMaterial.description,
            subject_id: originalMaterial.subject_id,
            chapter_id: originalMaterial.chapter_id,
            // Delta-based storage: we do NOT copy content_text or segments.
            // At runtime, we always read from the original and merge deltas.
            content_text: '',     // empty – resolved at load time via applyDeltas
            media_urls: originalMaterial.media_urls,
            file_type: originalMaterial.file_type,
            sort_order: originalMaterial.sort_order,
            segments: [],         // empty – merged at runtime
            deltas: [],           // user's personalizations start empty
            sync_original_updates: true,
            subject_tags: originalMaterial.subject_tags,
            education_system_tags: originalMaterial.education_system_tags,
            practice_questions: originalMaterial.practice_questions,
        })
        .select()
        .single();

    if (insertError) {
        console.error('Insert fork error', insertError);
        throw new Error('Failed to import material');
    }

    // 3. Increment fork_count on original material
    const { data: rawOrig } = await supabase.from('materials').select('fork_count').eq('id', originalMaterial.id).single();
    if (rawOrig) {
        await supabase.from('materials').update({
            fork_count: Math.max(0, (rawOrig.fork_count || 0) + 1)
        }).eq('id', originalMaterial.id);
    }

    revalidatePath('/');
    revalidatePath('/discover');
    revalidatePath(`/discover/${originalMaterial.id}`);
    return newMaterial;
}

export async function addComment(materialId: string, content: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('material_comments')
        .insert({
            material_id: materialId,
            user_id: user.id,
            content
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    revalidatePath(`/discover/`);
    return data;
}

export async function getComments(materialId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('material_comments')
        .select('*, user:user_id(email)') // simplified user fetching
        .eq('material_id', materialId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return [];
    }
    return data;
}

export async function toggleMaterialReaction(materialId: string, reactionType: 'upvote' | 'downvote' | 'helped_me_pass') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    // Check if unliking/undisliking
    const { data: existingReaction } = await supabase
        .from('material_reactions')
        .select('*')
        .eq('material_id', materialId)
        .eq('user_id', user.id)
        .single();

    let upvotesDelta = 0;
    let downvotesDelta = 0;
    let helpedDelta = 0;

    const setDelta = (type: string, amount: number) => {
        if (type === 'upvote') upvotesDelta += amount;
        if (type === 'downvote') downvotesDelta += amount;
        if (type === 'helped_me_pass') helpedDelta += amount;
    };

    if (existingReaction) {
        // If it's the exact same reaction, the user wants to remove it
        if (existingReaction.reaction_type === reactionType) {
            await supabase.from('material_reactions').delete().eq('material_id', materialId).eq('user_id', user.id);
            setDelta(reactionType, -1);
        } else {
            // Swapping reaction
            await supabase.from('material_reactions')
                .update({ reaction_type: reactionType })
                .eq('material_id', materialId).eq('user_id', user.id);

            setDelta(reactionType, 1);
            setDelta(existingReaction.reaction_type, -1);
        }
    } else {
        // New reaction
        await supabase.from('material_reactions').insert({
            material_id: materialId,
            user_id: user.id,
            reaction_type: reactionType
        });
        setDelta(reactionType, 1);
    }

    const { data: rawMat } = await supabase.from('materials').select('upvotes, downvotes, helped_me_pass').eq('id', materialId).single();
    if (rawMat) {
        await supabase.from('materials').update({
            upvotes: Math.max(0, (rawMat.upvotes || 0) + upvotesDelta),
            downvotes: Math.max(0, (rawMat.downvotes || 0) + downvotesDelta),
            helped_me_pass: Math.max(0, (rawMat.helped_me_pass || 0) + helpedDelta)
        }).eq('id', materialId);
    }

    revalidatePath(`/discover`);
    revalidatePath(`/discover/${materialId}`);
}

// ───────────────────────── Delta Actions ─────────────────────────────────────

/**
 * Persists the user's personal deltas for a forked material.
 * Only the owner of the fork can call this (enforced by RLS).
 */
export async function saveForkDeltas(forkId: string, deltas: Delta[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('materials')
        .update({ deltas: deltas as any })
        .eq('id', forkId)
        .eq('user_id', user.id);  // RLS double-guard: only the owner

    if (error) throw new Error('Failed to save deltas: ' + error.message);

    revalidatePath('/');
    revalidatePath(`/discover/${forkId}`);
}

/**
 * "Sync Original Updates": re-bases the fork's user deltas on top of the
 * latest original content.
 *
 * Strategy:
 *  1. Fetch the latest `segments` from the original.
 *  2. Apply the fork's existing deltas onto the OLD original (to see what the
 *     user had) – but since we don't store old_segments, we just keep the
 *     user deltas as-is; only segment IDs that still exist in the new original
 *     remain relevant.
 *  3. Clear stale deltas (those referencing segments that no longer exist in
 *     the new original).
 *  4. Store the pruned delta list back.
 */
export async function syncWithOriginal(forkId: string): Promise<{ effectiveSegments: Segment[] }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Fetch the fork
    const { data: fork, error: forkErr } = await supabase
        .from('materials')
        .select('original_material_id, deltas')
        .eq('id', forkId)
        .eq('user_id', user.id)
        .single();

    if (forkErr || !fork?.original_material_id) {
        throw new Error('Fork not found or not a forked material');
    }

    // Fetch latest original segments
    const { data: original, error: origErr } = await supabase
        .from('materials')
        .select('segments')
        .eq('id', fork.original_material_id)
        .single();

    if (origErr || !original) {
        throw new Error('Original material not found');
    }

    const originalSegments: Segment[] = typeof original.segments === 'string'
        ? JSON.parse(original.segments)
        : (original.segments || []);

    const existingDeltas: Delta[] = (fork.deltas as unknown as Delta[]) || [];

    // Prune deltas that reference segments that no longer exist in the new original
    const prunedDeltas = pruneStaleDeltas(existingDeltas, originalSegments);

    // Persist pruned deltas
    await supabase
        .from('materials')
        .update({ deltas: prunedDeltas as any })
        .eq('id', forkId)
        .eq('user_id', user.id);

    // Return the effective merged content for the client
    const effectiveSegments = applyDeltas(originalSegments, prunedDeltas);

    revalidatePath('/');
    revalidatePath(`/discover/${forkId}`);

    return { effectiveSegments };
}

/**
 * Removes deltas that reference segment IDs that no longer exist in the
 * (updated) original segment tree.
 */
function pruneStaleDeltas(deltas: Delta[], originalSegments: Segment[]): Delta[] {
    const flattenIds = (segs: Segment[]): Set<string> => {
        const ids = new Set<string>();
        const walk = (s: Segment[]) => {
            for (const seg of s) {
                ids.add(seg.id);
                if (seg.children) walk(seg.children);
            }
        };
        walk(segs);
        return ids;
    };

    const validIds = flattenIds(originalSegments);

    return deltas.filter((d) => {
        if (d.op === 'add') return true; // new segments added by user always stay
        if (d.op === 'modify') return validIds.has(d.segmentId);
        if (d.op === 'delete') return validIds.has(d.segmentId);
        return true;
    });
}
