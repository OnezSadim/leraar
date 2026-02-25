'use client';

import { useState, useTransition } from 'react';
import { Send, UserCircle2 } from 'lucide-react';
import { addPluginComment } from '@/app/plugins/actions';

type Comment = {
    id: string;
    content: string;
    created_at: string;
    user: { email: string };
};

export default function PluginCommentsSection({
    pluginId,
    initialComments,
}: {
    pluginId: string;
    initialComments: Comment[];
}) {
    const [comments, setComments] = useState(initialComments);
    const [newComment, setNewComment] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const optimistic: Comment = {
            id: Math.random().toString(),
            content: newComment,
            created_at: new Date().toISOString(),
            user: { email: 'You' },
        };
        const content = newComment;
        setNewComment('');
        setComments(prev => [optimistic, ...prev]);

        startTransition(async () => {
            try {
                await addPluginComment(pluginId, content);
            } catch {
                setComments(prev => prev.filter(c => c.id !== optimistic.id));
            }
        });
    };

    return (
        <div className="w-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-20%] w-[400px] h-[400px] rounded-full bg-violet-500/10 blur-[80px] pointer-events-none" />

            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-8 flex items-center gap-3 relative z-10">
                <span className="bg-violet-500/10 text-violet-500 dark:bg-violet-500/20 px-3 py-1 rounded-xl text-lg">
                    {comments.length}
                </span>
                Community Thoughts
            </h3>

            <div className="space-y-6 relative z-10">
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="What do you think about this plugin?"
                        className="w-full bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-medium resize-none shadow-inner min-h-[120px]"
                    />
                    <button
                        type="submit"
                        disabled={isPending || !newComment.trim()}
                        className="self-end inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-violet-500/30 hover:scale-105 active:scale-95"
                    >
                        {isPending ? 'Posting...' : 'Post Comment'}
                        <Send className="w-4 h-4 ml-1" />
                    </button>
                </form>

                <div className="mt-8 space-y-4">
                    {comments.length === 0 ? (
                        <p className="text-center text-slate-500 italic py-8">No comments yet. Be the first!</p>
                    ) : (
                        comments.map((c) => (
                            <div key={c.id} className="flex gap-4 p-5 bg-white/30 dark:bg-slate-800/30 rounded-2xl border border-white/40 dark:border-slate-700/30 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center text-white shadow-md flex-shrink-0">
                                    <UserCircle2 className="w-7 h-7" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-baseline justify-between mb-2">
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {c.user?.email ? c.user.email.split('@')[0] : 'Anonymous'}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">
                                            {new Date(c.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
