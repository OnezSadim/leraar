'use client'

import React, { useRef, useState, useEffect } from 'react';
import { usePluginBridge } from '@/lib/hooks/usePluginBridge';
import { ToggleLeft, ToggleRight, Settings } from 'lucide-react';

interface PluginViewportProps {
    pluginUrl?: string; // URL to fetch the plugin HTML if not provided directly
    htmlContent?: string; // Direct HTML content string
    materialData: any; // JSON material to feed the plugin
    knowledgeProfile?: any; // Optional: structured AI knowledge gap payload
    onProgress?: (data: any) => void;
    onQuizResult?: (data: any) => void;
    onNextChapter?: () => void;
}

export default function PluginViewport({
    pluginUrl,
    htmlContent,
    materialData,
    knowledgeProfile,
    onProgress,
    onQuizResult,
    onNextChapter
}: PluginViewportProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mode, setMode] = useState<'manual' | 'auto'>('manual');
    const [content, setContent] = useState<string | null>(htmlContent || null);
    const [isLoading, setIsLoading] = useState(!htmlContent);

    // Initialize the communication bridge
    const { sendMessage } = usePluginBridge({
        iframeRef,
        pluginData: materialData,
        knowledgeProfile,
        onProgress,
        onQuizResult,
        onNextChapter,
        mode
    });

    // Notify plugin if mode changes after initialization
    useEffect(() => {
        sendMessage('MODE_CHANGED', { mode });
    }, [mode, sendMessage]);

    // Fetch HTML if a pluginUrl is provided instead of raw htmlContent
    useEffect(() => {
        if (pluginUrl && !htmlContent) {
            setIsLoading(true);
            fetch(pluginUrl)
                .then(res => res.text())
                .then(html => {
                    setContent(html);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error('Failed to load plugin:', err);
                    setContent('<div style="color:red; font-family:sans-serif; padding:1rem;">Failed to load plugin.</div>');
                    setIsLoading(false);
                });
        }
    }, [pluginUrl, htmlContent]);

    return (
        <div className="w-full flex md:flex-row flex-col gap-4">
            {/* Control Bar (Side or Top) */}
            <div className="flex flex-row md:flex-col gap-4 shrink-0 p-4 bg-white/5 border border-white/10 rounded-2xl md:w-48 items-center bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-lg">
                <div className="flex items-center gap-2 text-white/80 font-semibold mb-2">
                    <Settings className="h-5 w-5 text-indigo-400" />
                    <span className="text-sm">Plugin Settings</span>
                </div>

                <div className="w-full h-px bg-white/10" />

                <div className="flex flex-col items-center w-full gap-3 mt-2">
                    <span className="text-xs uppercase tracking-widest text-white/50 font-black">Mode</span>
                    <button
                        onClick={() => setMode(m => m === 'manual' ? 'auto' : 'manual')}
                        className="flex items-center gap-3 w-full justify-center py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                    >
                        {mode === 'manual' ? (
                            <><ToggleLeft className="text-white/40 h-6 w-6" /><span className="text-sm font-medium text-white/80">Manual</span></>
                        ) : (
                            <><ToggleRight className="text-indigo-400 h-6 w-6" /><span className="text-sm font-medium text-indigo-400">Auto</span></>
                        )}
                    </button>
                    <p className="text-[10px] text-center text-white/40 leading-relaxed px-2">
                        {mode === 'manual'
                            ? "You control the pace. Click to advance."
                            : "Auto-advances based on voice or timers."}
                    </p>
                </div>
            </div>

            {/* Viewport Frame */}
            <div className="flex-grow flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/10 rounded-3xl min-h-[500px] overflow-hidden relative shadow-2xl backdrop-blur-3xl shadow-black/50">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                        <div className="h-10 w-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                        <span className="text-sm font-medium text-indigo-400/80 tracking-widest uppercase">Loading Plugin Workspace</span>
                    </div>
                ) : (
                    <iframe
                        ref={iframeRef}
                        srcDoc={content || ''}
                        sandbox="allow-scripts" // Crucial: No allow-same-origin, so it has an opaque origin
                        className="w-full h-full rounded-2xl border-none absolute inset-0 bg-transparent"
                        title="Plugin Sandbox Viewport"
                    />
                )}
            </div>
        </div>
    );
}
