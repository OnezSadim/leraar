'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getPublicPlugins({
    searchTerm = '',
    pluginType = '',
}: {
    searchTerm?: string;
    pluginType?: string;
} = {}) {
    const supabase = await createClient();

    let query = supabase
        .from('plugins')
        .select('id, name, description, plugin_type, upvotes, downvotes, helped_me_pass, trust_score, created_at, author_id')
        .gte('trust_score', -5)
        .order('trust_score', { ascending: false })
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
    }
    if (pluginType) {
        query = query.eq('plugin_type', pluginType);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching plugins:', error);
        return [];
    }
    return data;
}

export async function getPlugin(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('plugins')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return null;
    return data;
}

export async function publishPlugin(
    name: string,
    description: string,
    pluginType: string,
    htmlContent: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('plugins')
        .insert({
            author_id: user.id,
            name,
            description,
            plugin_type: pluginType,
            html_content: htmlContent,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath('/plugins');
    return data;
}

export async function addPluginComment(pluginId: string, content: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('plugin_comments')
        .insert({ plugin_id: pluginId, user_id: user.id, content })
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath(`/plugins/${pluginId}`);
    return data;
}

export async function getPluginComments(pluginId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('plugin_comments')
        .select('*, user:user_id(email)')
        .eq('plugin_id', pluginId)
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function togglePluginReaction(pluginId: string, reactionType: 'upvote' | 'downvote' | 'helped_me_pass') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: existing } = await supabase
        .from('plugin_reactions')
        .select('*')
        .eq('plugin_id', pluginId)
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

    if (existing) {
        if (existing.reaction_type === reactionType) {
            await supabase.from('plugin_reactions').delete().eq('plugin_id', pluginId).eq('user_id', user.id);
            setDelta(reactionType, -1);
        } else {
            await supabase.from('plugin_reactions')
                .update({ reaction_type: reactionType })
                .eq('plugin_id', pluginId).eq('user_id', user.id);
            setDelta(reactionType, 1);
            setDelta(existing.reaction_type, -1);
        }
    } else {
        await supabase.from('plugin_reactions').insert({ plugin_id: pluginId, user_id: user.id, reaction_type: reactionType });
        setDelta(reactionType, 1);
    }

    const { data: raw } = await supabase.from('plugins').select('upvotes, downvotes, helped_me_pass').eq('id', pluginId).single();
    if (raw) {
        await supabase.from('plugins').update({
            upvotes: Math.max(0, (raw.upvotes || 0) + upvotesDelta),
            downvotes: Math.max(0, (raw.downvotes || 0) + downvotesDelta),
            helped_me_pass: Math.max(0, (raw.helped_me_pass || 0) + helpedDelta),
        }).eq('id', pluginId);
    }

    revalidatePath('/plugins');
    revalidatePath(`/plugins/${pluginId}`);
}
