import { useEffect, useCallback } from 'react';

interface PluginBridgeProps {
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
    pluginData: any; // The JSON payload (material etc)
    knowledgeProfile?: any; // Optional: structured AI knowledge gap payload
    onProgress?: (data: any) => void;
    onQuizResult?: (data: any) => void;
    onNextChapter?: () => void;
    mode?: 'manual' | 'auto'; // to tell the plugin how to behave
}

export function usePluginBridge({
    iframeRef,
    pluginData,
    knowledgeProfile,
    onProgress,
    onQuizResult,
    onNextChapter,
    mode = 'manual'
}: PluginBridgeProps) {
    const sendMessage = useCallback(
        (type: string, payload: any = {}) => {
            if (iframeRef.current && iframeRef.current.contentWindow) {
                // Determine origin if needed, but since it's a srcdoc/sandbox, it's opaque. 
                // Using '*' is required for opaque origins, but we rely on the iframe reference itself for safety.
                iframeRef.current.contentWindow.postMessage({ type, payload }, '*');
            }
        },
        [iframeRef]
    );

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // In a strict environment we'd verify the source, but an opaque origin Sandbox doesn't have a stable `event.origin` (it's "null").
            // We ensure sanity by checking if event.source matches our iframe's contentWindow
            if (iframeRef.current && event.source !== iframeRef.current.contentWindow) {
                return;
            }

            const { type, payload } = event.data || {};

            switch (type) {
                case 'READY':
                    // Plugin is loaded and ready to receive data
                    sendMessage('INIT_DATA', {
                        material: pluginData,
                        mode: mode,
                        knowledgeProfile: knowledgeProfile ?? null
                    });
                    break;
                case 'PROGRESS_UPDATE':
                    if (onProgress) onProgress(payload);
                    break;
                case 'QUIZ_RESULT':
                    if (onQuizResult) onQuizResult(payload);
                    break;
                case 'NEXT_CHAPTER':
                    if (onNextChapter) onNextChapter();
                    break;
                default:
                    console.log('Unknown message type from plugin:', type, payload);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [iframeRef, pluginData, knowledgeProfile, mode, onProgress, onQuizResult, onNextChapter, sendMessage]);

    // Expose a way to explicitly send messages if needed by the parent component
    return { sendMessage };
}
