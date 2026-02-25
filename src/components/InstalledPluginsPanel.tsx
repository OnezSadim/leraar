'use client';

import { useState, useEffect, useTransition } from 'react';
import { Puzzle, Eye, EyeOff, Settings, Trash2, ExternalLink, Loader2, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import {
    getInstalledPlugins,
    uninstallPlugin,
    togglePluginDashboardVisibility,
    type InstalledPlugin,
} from '@/lib/actions/plugin-install-actions';

export default function InstalledPluginsPanel() {
    const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [activeWidget, setActiveWidget] = useState<string | null>(null);

    const reload = async () => {
        setLoading(true);
        const data = await getInstalledPlugins();
        setPlugins(data);
        setLoading(false);
    };

    useEffect(() => { reload(); }, []);

    const handleToggleVisibility = (pluginId: string, current: boolean) => {
        startTransition(async () => {
            await togglePluginDashboardVisibility(pluginId, !current);
            setPlugins((prev) =>
                prev.map((p) =>
                    p.plugin_id === pluginId ? { ...p, show_on_dashboard: !current } : p
                )
            );
        });
    };

    const handleUninstall = (pluginId: string) => {
        startTransition(async () => {
            await uninstallPlugin(pluginId);
            setPlugins((prev) => prev.filter((p) => p.plugin_id !== pluginId));
            if (activeWidget === pluginId) setActiveWidget(null);
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
        );
    }

    if (plugins.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                    <Puzzle className="w-8 h-8 text-violet-400 opacity-50" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No plugins installed yet.</p>
                <Link
                    href="/plugins"
                    className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/30 text-violet-400 rounded-xl text-sm font-bold hover:bg-violet-500/20 transition-all"
                >
                    <ExternalLink className="w-4 h-4" /> Browse Marketplace
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Widget Viewer */}
            {activeWidget && (() => {
                const p = plugins.find((pl) => pl.plugin_id === activeWidget);
                if (!p?.plugin.widget_html) return null;
                return (
                    <div className="bg-black/20 backdrop-blur-xl border border-violet-500/20 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                            <span className="text-sm font-bold text-white/70 flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4 text-violet-400" />
                                {p.plugin.name} — Dashboard Widget
                            </span>
                            <button
                                onClick={() => setActiveWidget(null)}
                                className="text-white/30 hover:text-white/70 transition-colors text-xs font-bold uppercase tracking-widest"
                            >
                                Close
                            </button>
                        </div>
                        <iframe
                            srcDoc={p.plugin.widget_html}
                            sandbox="allow-scripts"
                            className="w-full h-64 border-none bg-transparent"
                            title={`${p.plugin.name} widget`}
                        />
                    </div>
                );
            })()}

            {/* Plugin List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {plugins.map((p) => {
                    const TYPE_BG: Record<string, string> = {
                        tutor: 'from-indigo-500 to-violet-600',
                        flashcards: 'from-blue-500 to-cyan-500',
                        narrator: 'from-emerald-500 to-teal-600',
                        custom: 'from-rose-500 to-pink-600',
                    };
                    const grad = TYPE_BG[p.plugin.plugin_type] || TYPE_BG.custom;

                    return (
                        <div
                            key={p.plugin_id}
                            className={`relative bg-white/5 dark:bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 ${!p.show_on_dashboard ? 'opacity-50' : ''}`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-md shrink-0`}>
                                        <Puzzle className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{p.plugin.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{p.plugin.plugin_type}{p.plugin.connector_type ? ` · ${p.plugin.connector_type}` : ''}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            {p.plugin.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                    {p.plugin.description}
                                </p>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                                {/* Show/Hide toggle */}
                                <button
                                    onClick={() => handleToggleVisibility(p.plugin_id, p.show_on_dashboard)}
                                    disabled={isPending}
                                    title={p.show_on_dashboard ? 'Hide from dashboard' : 'Show on dashboard'}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                                >
                                    {p.show_on_dashboard ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                                    {p.show_on_dashboard ? 'Visible' : 'Hidden'}
                                </button>

                                {/* Widget preview */}
                                {p.plugin.widget_html && (
                                    <button
                                        onClick={() => setActiveWidget(activeWidget === p.plugin_id ? null : p.plugin_id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5 text-violet-400" />
                                        {activeWidget === p.plugin_id ? 'Close Widget' : 'Preview Widget'}
                                    </button>
                                )}

                                {/* Settings link */}
                                <Link
                                    href={`/plugins/${p.plugin_id}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                    Details
                                </Link>

                                {/* Uninstall */}
                                <button
                                    onClick={() => handleUninstall(p.plugin_id)}
                                    disabled={isPending}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 transition-all ml-auto"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Remove
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Browse more */}
            <Link
                href="/plugins"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold text-violet-400 border border-violet-500/20 hover:bg-violet-500/10 transition-all"
            >
                <ExternalLink className="w-4 h-4" />
                Browse Plugin Marketplace
            </Link>
        </div>
    );
}
