'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface InstalledPlugin {
    id: string;
    user_id: string;
    plugin_id: string;
    config: Record<string, unknown>;
    show_on_dashboard: boolean;
    installed_at: string;
    plugin: {
        id: string;
        name: string;
        description: string | null;
        plugin_type: string;
        html_content: string;
        widget_html: string | null;
        ai_tools: unknown[];
        connector_type: string | null;
        trust_score: number | null;
    };
}

/**
 * Get all plugins installed by the currently authenticated user.
 */
export async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('installed_plugins')
        .select(`
            *,
            plugin:plugin_id (
                id, name, description, plugin_type,
                html_content, widget_html, ai_tools, connector_type, trust_score
            )
        `)
        .eq('user_id', user.id)
        .order('installed_at', { ascending: false });

    if (error) {
        console.error('getInstalledPlugins error:', error);
        return [];
    }
    return (data ?? []) as InstalledPlugin[];
}

/**
 * Get the set of installed plugin IDs for the current user (lightweight, for UI badges).
 */
export async function getInstalledPluginIds(): Promise<string[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from('installed_plugins')
        .select('plugin_id')
        .eq('user_id', user.id);

    return (data ?? []).map((row) => row.plugin_id as string);
}

/**
 * Install a plugin for the current user.
 * Idempotent — safe to call even if already installed.
 */
export async function installPlugin(pluginId: string): Promise<{ success: boolean; message: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: 'Unauthorized' };

    const { error } = await supabase
        .from('installed_plugins')
        .upsert(
            { user_id: user.id, plugin_id: pluginId },
            { onConflict: 'user_id,plugin_id', ignoreDuplicates: true }
        );

    if (error) return { success: false, message: error.message };

    revalidatePath('/plugins');
    revalidatePath('/');
    return { success: true, message: 'Plugin installed successfully.' };
}

/**
 * Uninstall a plugin for the current user.
 */
export async function uninstallPlugin(pluginId: string): Promise<{ success: boolean; message: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: 'Unauthorized' };

    const { error } = await supabase
        .from('installed_plugins')
        .delete()
        .eq('user_id', user.id)
        .eq('plugin_id', pluginId);

    if (error) return { success: false, message: error.message };

    revalidatePath('/plugins');
    revalidatePath('/');
    return { success: true, message: 'Plugin uninstalled.' };
}

/**
 * Toggle whether an installed plugin shows on the dashboard.
 */
export async function togglePluginDashboardVisibility(
    pluginId: string,
    showOnDashboard: boolean
): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };

    const { error } = await supabase
        .from('installed_plugins')
        .update({ show_on_dashboard: showOnDashboard })
        .eq('user_id', user.id)
        .eq('plugin_id', pluginId);

    revalidatePath('/');
    return { success: !error };
}

/**
 * Update per-user config for an installed plugin.
 */
export async function updatePluginConfig(
    pluginId: string,
    config: Record<string, unknown>
): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };

    const { error } = await supabase
        .from('installed_plugins')
        .update({ config })
        .eq('user_id', user.id)
        .eq('plugin_id', pluginId);

    return { success: !error };
}
