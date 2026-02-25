import React from 'react';

export type Segment = {
    id: string;
    type: 'heading' | 'content';
    title?: string;
    text?: string;
    children?: Segment[];
};

export default function SegmentViewer({ segments, level = 1 }: { segments: Segment[], level?: number }) {
    if (!segments || segments.length === 0) return null;

    return (
        <div className="space-y-4">
            {segments.map((seg) => (
                <div key={seg.id} className={`${level > 1 ? 'ml-6 border-l-2 border-indigo-500/20 pl-4 py-2' : 'py-4'}`}>
                    {seg.type === 'heading' && (
                        <h3
                            className={`font-bold tracking-tight text-slate-900 dark:text-white mb-2 ${level === 1 ? 'text-3xl border-b border-indigo-500/20 pb-2' : level === 2 ? 'text-2xl text-indigo-500 dark:text-indigo-400' : 'text-xl'
                                }`}
                        >
                            {seg.title || seg.text}
                        </h3>
                    )}

                    {seg.type === 'content' && (
                        <div className="prose dark:prose-invert max-w-none prose-slate text-slate-700 dark:text-slate-300">
                            {seg.text?.split('\n').map((para, i) => (
                                <p key={i} className="mb-4 leading-relaxed whitespace-pre-wrap">{para}</p>
                            ))}
                        </div>
                    )}

                    {seg.children && seg.children.length > 0 && (
                        <div className="mt-4">
                            <SegmentViewer segments={seg.children} level={level + 1} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
