"use server";

import { createClient } from '@/lib/supabase/server';

export type MatchType = 'exact_hash' | 'title_similarity';

export interface DuplicateMatch {
    id: string;
    title: string;
    matchType: MatchType;
    createdAt?: string;
    description?: string;
}

export async function checkDuplicates(contentHash: string | undefined, title: string): Promise<DuplicateMatch[]> {
    const supabase = await createClient();
    const matches: DuplicateMatch[] = [];
    const matchedIds = new Set<string>();

    try {
        // 1. Check for Exact Hash Match
        if (contentHash && contentHash.trim() !== '') {
            const { data: hashMatches, error: hashError } = await supabase
                .from('materials')
                .select('id, title, description, created_at')
                .eq('content_hash', contentHash)
                .is('original_material_id', null) // Avoid matching against existing forks if possible or match them all
                .limit(5);

            if (!hashError && hashMatches) {
                hashMatches.forEach(match => {
                    if (!matchedIds.has(match.id)) {
                        matches.push({
                            id: match.id,
                            title: match.title,
                            matchType: 'exact_hash',
                            createdAt: match.created_at,
                            description: match.description
                        });
                        matchedIds.add(match.id);
                    }
                });
            }
        }

        // 2. Check for Title Similarity
        if (title && title.trim() !== '') {
            // Very basic case-insensitive match for the title format. 
            // In a real application, you might use Postgres pg_trgm or full text search vector here.
            const { data: titleMatches, error: titleError } = await supabase
                .from('materials')
                .select('id, title, description, created_at')
                .ilike('title', `%${title.trim()}%`)
                .limit(5);

            if (!titleError && titleMatches) {
                titleMatches.forEach(match => {
                    if (!matchedIds.has(match.id)) {
                        matches.push({
                            id: match.id,
                            title: match.title,
                            matchType: 'title_similarity',
                            createdAt: match.created_at,
                            description: match.description
                        });
                        matchedIds.add(match.id);
                    }
                });
            }
        }

        return matches;
    } catch (error) {
        console.error("Duplicate check failed:", error);
        return [];
    }
}
