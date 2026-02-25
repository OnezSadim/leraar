'use client';

import { useState, useTransition } from 'react';
import { DownloadCloud, CheckCircle2, Loader2 } from 'lucide-react';
import { importMaterial } from '@/app/discover/actions';

export default function ImportButton({ materialId }: { materialId: string }) {
    const [isPending, startTransition] = useTransition();
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleImport = () => {
        if (isPending) return;
        setErrorMsg('');
        startTransition(async () => {
            try {
                await importMaterial(materialId);
                setSuccess(true);
            } catch (err: any) {
                console.error('Import error', err);
                setErrorMsg(err.message || 'Failed to import material');
            }
        });
    };

    if (success) {
        return (
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 font-bold px-6 py-3 rounded-xl border border-emerald-500/20 shadow-inner">
                    <CheckCircle2 className="w-5 h-5" />
                    Remixed to Dashboard
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium max-w-[260px]">
                    Your edits are stored as deltas — the original stays untouched.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center">
            <button
                onClick={handleImport}
                disabled={isPending}
                className="group relative flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold px-8 py-4 rounded-2xl shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 min-w-[200px]"
            >
                {isPending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Importing...
                    </>
                ) : (
                    <>
                        <DownloadCloud className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
                        Remix &amp; Fork to Dashboard
                    </>
                )}
            </button>
            {errorMsg && (
                <span className="text-rose-500 text-sm font-medium mt-2">
                    {errorMsg}
                </span>
            )}
        </div>
    );
}
