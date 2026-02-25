'use client'

import React, { useRef, useState, useEffect } from 'react';
import { usePluginBridge } from '@/lib/hooks/usePluginBridge';
import { Loader2 } from 'lucide-react';

interface PluginViewportProps {
    pluginUrl?: string;
    htmlContent?: string;
    materialData: any;
    knowledgeProfile?: any;
    onProgress?: (data: any) => void;
    onQuizResult?: (data: any) => void;
    onNextChapter?: () => void;
}

/**
 * Full-screen plugin iframe. No sidebar — the plugin owns 100% of the space.
 * The parent is responsible for providing an escape/back mechanism.
 */
export default function PluginViewport({
    pluginUrl,
    htmlContent,
    materialData,
    knowledgeProfile,
    onProgress,
    onQuizResult,
    onNextChapter,
}: PluginViewportProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [content, setContent] = useState<string | null>(htmlContent || null);
    const [isLoading, setIsLoading] = useState(!htmlContent);

    const { sendMessage } = usePluginBridge({
        iframeRef,
        pluginData: materialData,
        knowledgeProfile,
        onProgress,
        onQuizResult,
        onNextChapter,
        mode: 'manual',
    });

    useEffect(() => {
        if (pluginUrl && !htmlContent) {
            setIsLoading(true);
            fetch(pluginUrl)
                .then(res => res.text())
                .then(html => { setContent(html); setIsLoading(false); })
                .catch(() => {
                    setContent('<div style="color:red;font-family:sans-serif;padding:2rem;">Failed to load plugin.</div>');
                    setIsLoading(false);
                });
        }
    }, [pluginUrl, htmlContent]);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
                <span className="text-sm font-medium text-white/40 tracking-widest uppercase">Loading Plugin…</span>
            </div>
        );
    }

    return (
        <iframe
            ref={iframeRef}
            srcDoc={content || ''}
            sandbox="allow-scripts"
            className="w-full h-full border-none"
            title="Plugin Sandbox"
        />
    );
}
