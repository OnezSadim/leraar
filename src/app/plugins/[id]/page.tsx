import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Puzzle, Calendar } from 'lucide-react';
import { getPlugin, getPluginComments } from '../actions';
import TrustInteractions from '@/components/social/TrustInteractions';
import PluginCommentsSection from './PluginCommentsSection';
import PluginPreview from './PluginPreview';

const TYPE_COLORS: Record<string, string> = {
    tutor: 'from-indigo-500 to-violet-600',
    flashcards: 'from-blue-500 to-cyan-500',
    narrator: 'from-emerald-500 to-teal-600',
    custom: 'from-rose-500 to-pink-600',
};

export default async function PluginDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const plugin = await getPlugin(id);

    if (!plugin) return notFound();

    const comments = await getPluginComments(id);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans relative overflow-x-hidden selection:bg-violet-500/30">
            <div className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] bg-violet-500/10 dark:bg-violet-500/5 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute top-[40%] -right-[20%] w-[600px] h-[600px] bg-cyan-500/10 dark:bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

            <nav className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 px-6 py-4 flex items-center shadow-sm">
                <Link href="/plugins" className="group flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-violet-500 font-semibold transition-colors">
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    Back to Marketplace
                </Link>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-12 relative z-10">
                {/* Header */}
                <header className="mb-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[3rem] p-8 md:p-12 border border-white/40 dark:border-slate-800/50 shadow-2xl shadow-violet-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-violet-400/20 to-transparent blur-[60px] pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative z-10">
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <span className={`inline-flex items-center gap-1.5 bg-gradient-to-r ${TYPE_COLORS[plugin.plugin_type] || TYPE_COLORS.custom} text-white px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide shadow-md`}>
                                    <Puzzle className="w-4 h-4" />
                                    {plugin.plugin_type}
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tighter mb-6">
                                {plugin.name}
                            </h1>

                            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mb-8">
                                {plugin.description || 'No description provided.'}
                            </p>

                            <div className="flex items-center gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                                <TrustInteractions
                                    itemId={id}
                                    itemType="plugin"
                                    initialUpvotes={plugin.upvotes || 0}
                                    initialDownvotes={plugin.downvotes || 0}
                                    initialHelped={plugin.helped_me_pass || 0}
                                />
                                <span className="text-slate-400 text-sm font-bold font-mono px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(plugin.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* Live Preview card */}
                        <div className="flex flex-col items-center justify-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl min-w-[280px] gap-3">
                            <div className={`w-16 h-16 bg-gradient-to-tr ${TYPE_COLORS[plugin.plugin_type] || TYPE_COLORS.custom} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                                <Puzzle className="w-9 h-9" />
                            </div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 text-center">Sandbox Preview</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Runs in a secure isolated environment</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Live Plugin Viewport */}
                    <div className="lg:col-span-2">
                        <section className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 mb-6 flex items-center gap-3">
                                <Puzzle className="w-6 h-6 text-violet-500" />
                                Live Preview
                            </h2>
                            <PluginPreview htmlContent={plugin.html_content} />
                        </section>
                    </div>

                    {/* Sidebar */}
                    <aside className="lg:col-span-1 space-y-8">
                        <PluginCommentsSection pluginId={id} initialComments={comments || []} />
                    </aside>
                </div>
            </main>
        </div>
    );
}
