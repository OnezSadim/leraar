'use client';

import { useState, useTransition } from 'react';
import { ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import { toggleMaterialReaction } from '@/app/discover/actions';
import { togglePluginReaction } from '@/app/plugins/actions';

export default function TrustInteractions({
    itemId,
    itemType,
    initialUpvotes,
    initialDownvotes,
    initialHelped,
}: {
    itemId: string;
    itemType: 'material' | 'plugin';
    initialUpvotes: number;
    initialDownvotes: number;
    initialHelped: number;
}) {
    const [upvotes, setUpvotes] = useState(initialUpvotes);
    const [downvotes, setDownvotes] = useState(initialDownvotes);
    const [helped, setHelped] = useState(initialHelped);
    const [userReaction, setUserReaction] = useState<'upvote' | 'downvote' | 'helped_me_pass' | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleToggle = (type: 'upvote' | 'downvote' | 'helped_me_pass') => {
        if (isPending) return;

        let oldReaction = userReaction;
        setUserReaction(curr => (curr === type ? null : type));

        const adjust = (reaction: string, amount: number) => {
            if (reaction === 'upvote') setUpvotes(prev => prev + amount);
            if (reaction === 'downvote') setDownvotes(prev => prev + amount);
            if (reaction === 'helped_me_pass') setHelped(prev => prev + amount);
        };

        if (oldReaction === type) {
            adjust(type, -1);
        } else {
            adjust(type, 1);
            if (oldReaction) adjust(oldReaction, -1);
        }

        startTransition(async () => {
            try {
                if (itemType === 'material') {
                    await toggleMaterialReaction(itemId, type);
                } else {
                    await togglePluginReaction(itemId, type);
                }
            } catch (err) {
                console.error("Failed to react", err);
                setUserReaction(oldReaction);
                setUpvotes(initialUpvotes);
                setDownvotes(initialDownvotes);
                setHelped(initialHelped);
            }
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl p-2 shadow-lg border border-white/40 dark:border-slate-700/50">
            <button
                onClick={() => handleToggle('upvote')}
                disabled={isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 ${userReaction === 'upvote'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105'
                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-500 dark:hover:bg-emerald-500/10'
                    }`}
            >
                <ThumbsUp className={`w-4 h-4 ${userReaction === 'upvote' ? 'fill-current' : ''}`} />
                <span>{upvotes}</span>
            </button>

            <button
                onClick={() => handleToggle('downvote')}
                disabled={isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 ${userReaction === 'downvote'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 scale-105'
                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10'
                    }`}
            >
                <ThumbsDown className={`w-4 h-4 mt-0.5 ${userReaction === 'downvote' ? 'fill-current' : ''}`} />
                <span>{downvotes}</span>
            </button>

            <div className="w-px h-8 bg-slate-300 dark:bg-slate-700 mx-1"></div>

            <button
                onClick={() => handleToggle('helped_me_pass')}
                disabled={isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 ${userReaction === 'helped_me_pass'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-orange-50 hover:text-orange-500 dark:hover:bg-orange-500/10'
                    }`}
            >
                <Sparkles className={`w-4 h-4 ${userReaction === 'helped_me_pass' ? 'fill-current text-white' : 'text-amber-500'}`} />
                <span className="hidden sm:inline">Helped Me Pass</span>
                <span>{helped}</span>
            </button>
        </div>
    );
}
