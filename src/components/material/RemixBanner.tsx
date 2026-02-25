'use client';

import { useState, useTransition } from 'react';
import { GitFork, RefreshCw, CheckCircle2, Loader2, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { syncWithOriginal } from '@/app/discover/actions';

interface RemixBannerProps {
    forkId: string;
    originalId: string;
    originalTitle: string;
    syncEnabled?: boolean;
}

export default function RemixBanner({
    forkId,
    originalId,
    originalTitle,
    syncEnabled = true,
}: RemixBannerProps) {
    const [isPending, startTransition] = useTransition();
    const [synced, setSynced] = useState(false);
    const [error, setError] = useState('');
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const handleSync = () => {
        if (isPending) return;
        setError('');
        setSynced(false);
        startTransition(async () => {
            try {
                await syncWithOriginal(forkId);
                setSynced(true);
                // Reset after 3s
                setTimeout(() => setSynced(false), 3000);
            } catch (err: any) {
                setError(err.message || 'Failed to sync');
            }
        });
    };

    return (
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gradient-to-r from-teal-500/10 via-indigo-500/10 to-fuchsia-500/10 backdrop-blur-sm border border-teal-500/25 rounded-2xl px-5 py-4 shadow-lg shadow-teal-500/5 animate-in fade-in slide-in-from-top-2 duration-500">

            {/* Icon */}
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 shadow-md shadow-indigo-500/20">
                <GitFork className="w-5 h-5 text-white" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                    You&apos;re studying a{' '}
                    <span className="text-teal-600 dark:text-teal-400 font-extrabold">Remixed</span> version
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                    Forked from:{' '}
                    <Link
                        href={`/discover/${originalId}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                    >
                        {originalTitle}
                        <ExternalLink className="w-3 h-3 inline ml-0.5" />
                    </Link>
                    &nbsp;&mdash; your edits are saved as deltas only.
                </p>
                {error && (
                    <p className="text-xs text-rose-500 font-semibold mt-1">{error}</p>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {syncEnabled && (
                    <button
                        onClick={handleSync}
                        disabled={isPending}
                        title="Pull the latest changes from the original material and re-base your edits on top."
                        className="
                            group flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl
                            bg-white/60 dark:bg-slate-800/60 border border-teal-500/30
                            hover:bg-teal-500/10 hover:border-teal-500/60
                            text-teal-700 dark:text-teal-300
                            transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50
                            shadow-sm
                        "
                    >
                        {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : synced ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                        )}
                        {isPending ? 'Syncing…' : synced ? 'Synced!' : 'Sync Original Updates'}
                    </button>
                )}

                <button
                    onClick={() => setDismissed(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all"
                    title="Dismiss"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
