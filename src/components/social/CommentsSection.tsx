'use client';

import { useState, useTransition } from 'react';
import { Send, UserCircle2 } from 'lucide-react';
import { addComment } from '@/app/discover/actions';

type Comment = {
    id: string;
    content: string;
    created_at: string;
    user: {
        email: string;
    };
};

export default function CommentsSection({
    materialId,
    initialComments,
}: {
    materialId: string;
    initialComments: Comment[];
}) {
    const [comments, setComments] = useState(initialComments);
    const [newComment, setNewComment] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const optimisticComment: Comment = {
            id: Math.random().toString(),
            content: newComment,
            created_at: new Date().toISOString(),
            user: { email: 'You' },
        };

        const addedContent = newComment;
        setNewComment('');
        setComments((prev) => [optimisticComment, ...prev]);

        startTransition(async () => {
            try {
                const result = await addComment(materialId, addedContent);
            } catch (err) {
                console.error('Failed to add comment', err);
                setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
            }
        });
    };

    return (
        <div className="w-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-20%] w-[400px] h-[400px] rounded-full bg-teal-500/10 blur-[80px] pointer-events-none" />

            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-8 flex items-center gap-3 relative z-10">
                <span className="bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 px-3 py-1 rounded-xl text-lg">
                    {comments.length}
                </span>
                Community Thoughts
            </h3>

            <div className="space-y-6 relative z-10">
                <form onSubmit={handleAddComment} className="flex flex-col gap-4">
                    <div className="relative">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="What do you think about this material?"
                            className="w-full bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium resize-none shadow-inner min-h-[120px]"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isPending || !newComment.trim()}
                        className="self-end inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold px-8 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95"
                    >
                        {isPending ? 'Posting...' : 'Post Comment'}
                        <Send className="w-4 h-4 ml-1" />
                    </button>
                </form>

                <div className="mt-12 space-y-6">
                    {comments.length === 0 ? (
                        <p className="text-center text-slate-500 italic py-8">No comments yet. Be the first to share your thoughts!</p>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment.id} className="flex gap-4 p-5 bg-white/30 dark:bg-slate-800/30 rounded-2xl border border-white/40 dark:border-slate-700/30 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white shadow-md">
                                        <UserCircle2 className="w-7 h-7" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-baseline justify-between mb-2">
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {comment.user?.email ? comment.user.email.split('@')[0] : 'AnonymousUser'}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">
                                            {new Date(comment.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {comment.content}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
