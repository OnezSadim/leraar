'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Compass, BookOpen, ThumbsUp, ThumbsDown, GitFork, Sparkles } from 'lucide-react';
import { getPublicMaterials } from './actions';

export default function DiscoverPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [educationSystem, setEducationSystem] = useState('');
    const [materials, setMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        async function fetchMaterials() {
            setLoading(true);
            try {
                const data = await getPublicMaterials({
                    searchTerm, subjectId, educationSystem
                });
                if (active) setMaterials(data);
            } catch (e) {
                console.error(e);
            } finally {
                if (active) setLoading(false);
            }
        }

        const timer = setTimeout(fetchMaterials, 300); // debounce search
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [searchTerm, subjectId, educationSystem]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 sm:p-12 font-sans relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-fuchsia-500/20 blur-[100px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="mb-12 text-center">
                    <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4 flex items-center justify-center gap-4">
                        <Compass className="w-12 h-12 text-indigo-500" />
                        Global Discover Hub
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        Search, discover, and remix study materials from users around the world.
                    </p>
                </header>

                {/* Filters and Search - Glassmorphism Card */}
                <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 p-6 rounded-3xl shadow-xl shadow-indigo-500/5 mb-10">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search materials by title or topic..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            />
                        </div>

                        <div className="w-full md:w-48">
                            <input
                                type="text"
                                placeholder="Subject ID (optional)"
                                value={subjectId}
                                onChange={(e) => setSubjectId(e.target.value)}
                                className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            />
                        </div>

                        <div className="w-full md:w-56">
                            <input
                                type="text"
                                placeholder="Education System (e.g., VWO)"
                                value={educationSystem}
                                onChange={(e) => setEducationSystem(e.target.value)}
                                className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* Results Grid */}
                {loading ? (
                    <div className="flex justify-center items-center py-24">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : materials.length === 0 ? (
                    <div className="text-center py-24 text-slate-500 dark:text-slate-400">
                        <Compass className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-xl font-medium">No materials found.</p>
                        <p>Try adjusting your search filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {materials.map((mat) => (
                            <Link href={`/discover/${mat.id}`} key={mat.id} className="group h-full">
                                <div className="h-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-800/50 p-6 rounded-3xl shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/10 hover:bg-white/80 dark:hover:bg-slate-800/80 flex flex-col items-start gap-4">
                                    <div className="w-full flex justify-between items-start">
                                        <div className="flex items-center gap-2 text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                            <BookOpen className="w-4 h-4" />
                                            {mat.subject_id || "General"}
                                        </div>
                                        {mat.original_material_id && (
                                            <div className="flex items-center gap-1 text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider tooltip" title="Remixed Material">
                                                <GitFork className="w-3 h-3" /> Fork
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white line-clamp-2">
                                        {mat.title}
                                    </h3>

                                    <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3 mb-auto">
                                        {mat.description || "No description provided."}
                                    </p>

                                    <div className="w-full flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                                                <span className="text-sm font-semibold">{mat.upvotes || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 tooltip" title="Helped Me Pass">
                                                <Sparkles className="w-4 h-4 text-amber-500" />
                                                <span className="text-sm font-semibold">{mat.helped_me_pass || 0}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400 transition-colors group-hover:text-indigo-500 font-medium font-mono">
                                            {new Date(mat.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
