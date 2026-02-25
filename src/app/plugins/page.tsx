'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Puzzle, ThumbsUp, ThumbsDown, Plus, X, Loader2, Send, Sparkles } from 'lucide-react';
import { getPublicPlugins, publishPlugin } from './actions';

const PLUGIN_TYPES = ['all', 'tutor', 'flashcards', 'narrator', 'custom'];

const TYPE_COLORS: Record<string, string> = {
    tutor: 'from-indigo-500 to-violet-600',
    flashcards: 'from-blue-500 to-cyan-500',
    narrator: 'from-emerald-500 to-teal-600',
    custom: 'from-rose-500 to-pink-600',
};

export default function PluginsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [pluginType, setPluginType] = useState('');
    const [plugins, setPlugins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPublish, setShowPublish] = useState(false);

    // Publish form state
    const [pubName, setPubName] = useState('');
    const [pubDesc, setPubDesc] = useState('');
    const [pubType, setPubType] = useState('custom');
    const [pubHtml, setPubHtml] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [publishError, setPublishError] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const data = await getPublicPlugins({
                    searchTerm,
                    pluginType: pluginType === 'all' ? '' : pluginType,
                });
                if (active) setPlugins(data);
            } catch (e) {
                console.error(e);
            } finally {
                if (active) setLoading(false);
            }
        }, 300);
        return () => { active = false; clearTimeout(timer); };
    }, [searchTerm, pluginType]);

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pubName.trim() || !pubHtml.trim()) return;
        setPublishing(true);
        setPublishError('');
        try {
            await publishPlugin(pubName, pubDesc, pubType, pubHtml);
            setShowPublish(false);
            setPubName(''); setPubDesc(''); setPubHtml(''); setPubType('custom');
            // Refresh list
            const data = await getPublicPlugins({});
            setPlugins(data);
        } catch (err: any) {
            setPublishError(err.message || 'Failed to publish');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 sm:p-12 font-sans relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-500/20 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/20 blur-[100px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="mb-12 text-center">
                    <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center justify-center gap-4">
                        <Puzzle className="w-12 h-12 text-violet-500" />
                        Plugin Marketplace
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        Discover, install, and publish interactive learning plugins built by the community.
                    </p>
                </header>

                {/* Search + Filters */}
                <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 p-6 rounded-3xl shadow-xl shadow-violet-500/5 mb-10">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search plugins by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all font-medium"
                            />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {PLUGIN_TYPES.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setPluginType(t === 'all' ? '' : t)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all border ${(t === 'all' && !pluginType) || pluginType === t
                                        ? 'bg-violet-500 text-white border-violet-500 shadow-lg shadow-violet-500/30'
                                        : 'bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-400'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowPublish(true)}
                            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-2xl hover:scale-105 transition-all shadow-lg shadow-violet-500/30 whitespace-nowrap"
                        >
                            <Plus className="w-5 h-5" /> Publish Plugin
                        </button>
                    </div>
                </div>

                {/* Plugin Grid */}
                {loading ? (
                    <div className="flex justify-center items-center py-24">
                        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : plugins.length === 0 ? (
                    <div className="text-center py-24 text-slate-500 dark:text-slate-400">
                        <Puzzle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-xl font-medium">No plugins found.</p>
                        <p>Be the first to publish one!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plugins.map((plugin) => (
                            <Link href={`/plugins/${plugin.id}`} key={plugin.id} className="group h-full">
                                <div className="h-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-800/50 p-6 rounded-3xl shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-violet-500/10 hover:bg-white/80 dark:hover:bg-slate-800/80 flex flex-col gap-4">
                                    {/* Type badge + icon */}
                                    <div className="flex items-center justify-between">
                                        <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${TYPE_COLORS[plugin.plugin_type] || TYPE_COLORS.custom} text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-md`}>
                                            <Puzzle className="w-3.5 h-3.5" />
                                            {plugin.plugin_type}
                                        </div>
                                        <span className="text-xs text-slate-400 font-mono group-hover:text-violet-500 transition-colors">
                                            {new Date(plugin.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white line-clamp-2">
                                        {plugin.name}
                                    </h3>

                                    <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3 mb-auto">
                                        {plugin.description || 'No description provided.'}
                                    </p>

                                    <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                            <ThumbsUp className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm font-semibold">{plugin.upvotes || 0}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 tooltip" title="Helped Me Pass">
                                            <Sparkles className="w-4 h-4 text-amber-500" />
                                            <span className="text-sm font-semibold">{plugin.helped_me_pass || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Publish Modal */}
            {showPublish && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowPublish(false)}
                            className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-2xl font-extrabold text-white mb-2">Publish a Plugin</h2>
                        <p className="text-sm text-white/50 mb-8">Paste your plugin's HTML/JS code to share it with the community.</p>

                        <form onSubmit={handlePublish} className="flex flex-col gap-5">
                            <div>
                                <label className="text-xs uppercase tracking-widest font-bold text-white/40 mb-2 block">Plugin Name *</label>
                                <input
                                    value={pubName}
                                    onChange={e => setPubName(e.target.value)}
                                    placeholder="My Awesome Plugin"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase tracking-widest font-bold text-white/40 mb-2 block">Description</label>
                                <input
                                    value={pubDesc}
                                    onChange={e => setPubDesc(e.target.value)}
                                    placeholder="What does this plugin do?"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase tracking-widest font-bold text-white/40 mb-2 block">Type</label>
                                <select
                                    value={pubType}
                                    onChange={e => setPubType(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                    {['tutor', 'flashcards', 'narrator', 'custom'].map(t => (
                                        <option key={t} value={t} className="bg-slate-800 capitalize">{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs uppercase tracking-widest font-bold text-white/40 mb-2 block">Plugin HTML Code *</label>
                                <textarea
                                    value={pubHtml}
                                    onChange={e => setPubHtml(e.target.value)}
                                    placeholder="<!DOCTYPE html>..."
                                    required
                                    rows={10}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-green-400 font-mono text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                />
                            </div>
                            {publishError && (
                                <p className="text-rose-400 text-sm font-medium">{publishError}</p>
                            )}
                            <button
                                type="submit"
                                disabled={publishing || !pubName.trim() || !pubHtml.trim()}
                                className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-extrabold rounded-2xl hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                {publishing ? 'Publishing...' : 'Publish to Marketplace'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
