import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SegmentViewer from '@/components/material/SegmentViewer';
import RemixBanner from '@/components/material/RemixBanner';
import TrustInteractions from '@/components/social/TrustInteractions';
import CommentsSection from '@/components/social/CommentsSection';
import ImportButton from './ImportButton';
import { BookOpen, GitFork, BookMarked } from 'lucide-react';
import { getComments } from '../actions';
import { applyDeltas, Delta } from '@/lib/deltas';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function MaterialDiscoverPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: material, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !material) {
        return notFound();
    }

    // Runtime delta merge:
    // If this material is a fork (segments=[]), load the original's segments
    // and apply any user deltas on top to produce the effective view.
    let segments = material.segments;
    let originalInfo: { id: string; title: string } | null = null;

    if (material.original_material_id) {
        const { data: origData } = await supabase
            .from('materials')
            .select('*, original: original_material_id(id, title)')
            .eq('id', material.original_material_id)
            .single();

        if (origData) {
            originalInfo = { id: origData.id, title: origData.title };

            // Only replace segments if the fork's own segment list is empty
            if (!segments || segments.length === 0) {
                const origSegments = typeof origData.segments === 'string'
                    ? JSON.parse(origData.segments)
                    : (origData.segments || []);
                const storedDeltas: Delta[] = typeof material.deltas === 'string'
                    ? JSON.parse(material.deltas)
                    : (material.deltas || []);
                // Merge: original segments + user deltas = effective view
                segments = applyDeltas(origSegments, storedDeltas);
            }
        }
    }

    const parsedSegments = typeof segments === 'string' ? JSON.parse(segments) : (segments || []);
    const commentsData = await getComments(id);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans relative overflow-x-hidden selection:bg-indigo-500/30">
            {/* Dynamic Backgrounds */}
            <div className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] bg-indigo-500/10 dark:bg-indigo-500/5 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute top-[40%] -right-[20%] w-[600px] h-[600px] bg-fuchsia-500/10 dark:bg-fuchsia-500/5 blur-[120px] rounded-full pointer-events-none" />

            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 px-6 py-4 flex items-center shadow-sm">
                <Link href="/discover" className="group flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-500 font-semibold transition-colors">
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    Back to Discover
                </Link>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-12 relative z-10">

                {/* Remix Banner — shown if this is a forked material */}
                {originalInfo && (
                    <div className="mb-8">
                        <RemixBanner
                            forkId={id}
                            originalId={originalInfo.id}
                            originalTitle={originalInfo.title}
                            syncEnabled={material.sync_original_updates ?? true}
                        />
                    </div>
                )}

                {/* Header Section */}
                <header className="mb-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[3rem] p-8 md:p-12 border border-white/40 dark:border-slate-800/50 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-teal-400/20 to-transparent blur-[60px] pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative z-10">
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <span className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide border border-indigo-100 dark:border-indigo-500/30">
                                    <BookOpen className="w-4 h-4" />
                                    {material.subject_id || 'General Subject'}
                                </span>

                                {/* Fork badge */}
                                {material.original_material_id && originalInfo && (
                                    <Link href={`/discover/${material.original_material_id}`} className="inline-flex items-center gap-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-800/40 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide border border-teal-200 dark:border-teal-700/50 transition-colors">
                                        <GitFork className="w-4 h-4" />
                                        Remixed from: {originalInfo.title}
                                    </Link>
                                )}
                            </div>

                            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tighter mb-6">
                                {material.title}
                            </h1>

                            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mb-8">
                                {material.description || 'No overview available for this material.'}
                            </p>

                            <div className="flex items-center gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                                <TrustInteractions
                                    itemId={id}
                                    itemType="material"
                                    initialUpvotes={material.upvotes || 0}
                                    initialDownvotes={material.downvotes || 0}
                                    initialHelped={material.helped_me_pass || 0}
                                />
                                <span className="text-slate-400 text-sm font-bold font-mono px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    {new Date(material.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl min-w-[280px]">
                            <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-3xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-500/30 overflow-hidden relative">
                                <BookMarked className="w-10 h-10 relative z-10" />
                                <div className="absolute inset-0 bg-white/20 rotate-45 transform translate-y-3/4"></div>
                            </div>
                            <ImportButton materialId={id} />
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium text-center mt-4">
                                Saves a remixed copy to<br />your personal dashboard
                            </p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* Main Content Area */}
                    <div className="lg:col-span-2">
                        <section className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                            {/* Subtle hover reveal gradient */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 mb-8 flex items-center gap-3">
                                <BookOpen className="w-6 h-6 text-indigo-500" />
                                Material Preview
                            </h2>

                            {parsedSegments.length > 0 ? (
                                <SegmentViewer segments={parsedSegments} />
                            ) : (
                                <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-8 border border-slate-200 dark:border-slate-700">
                                    <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-loose whitespace-pre-wrap">
                                        {material.content_text || 'This material has no text content.'}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Sidebar Area */}
                    <aside className="lg:col-span-1 space-y-8">
                        <CommentsSection materialId={id} initialComments={commentsData || []} />
                    </aside>
                </div>
            </main>
        </div>
    );
}
