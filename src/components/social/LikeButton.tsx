'use client';

import { useState, useTransition } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toggleMaterialReaction } from '@/app/discover/actions';

interface LikeButtonProps {
    materialId: string;
    initialLikes: number;
    initialDislikes: number;
}

export default function LikeButton({ materialId, initialLikes, initialDislikes }: LikeButtonProps) {
    const [likes, setLikes] = useState(initialLikes);
    const [dislikes, setDislikes] = useState(initialDislikes);
    const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleReaction(type: 'like' | 'dislike') {
        const prev = userReaction;
        const newReaction = prev === type ? null : type;
        setUserReaction(newReaction);

        if (type === 'like') {
            setLikes((v) => v + (newReaction === 'like' ? 1 : -1));
            if (prev === 'dislike') setDislikes((v) => v - 1);
        } else {
            setDislikes((v) => v + (newReaction === 'dislike' ? 1 : -1));
            if (prev === 'like') setLikes((v) => v - 1);
        }

        startTransition(async () => {
            try {
                await toggleMaterialReaction(materialId, type === 'like' ? 'upvote' : 'downvote');
            } catch {
                // revert
                setUserReaction(prev);
                if (type === 'like') {
                    setLikes(initialLikes);
                    setDislikes(initialDislikes);
                }
            }
        });
    }

    return (
        <div className="flex items-center gap-4">
            <button
                onClick={() => handleReaction('like')}
                disabled={isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-sm ${userReaction === 'like'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-emerald-500/30'
                    }`}
            >
                <ThumbsUp className="w-4 h-4" />
                {likes}
            </button>
            <button
                onClick={() => handleReaction('dislike')}
                disabled={isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-sm ${userReaction === 'dislike'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-rose-500/30'
                    }`}
            >
                <ThumbsDown className="w-4 h-4" />
                {dislikes}
            </button>
        </div>
    );
}
