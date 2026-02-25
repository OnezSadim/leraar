'use client';

import PluginViewport from '@/components/PluginViewport';

// Dummy material data for sandbox preview
const DEMO_MATERIAL = {
    title: 'Plugin Preview',
    content: 'This is a sandboxed live preview of the plugin. In a real study session, your material content will appear here.',
    sections: [
        { concept: 'Preview', content: 'This is a demonstration of the plugin in action.' }
    ]
};

export default function PluginPreview({ htmlContent }: { htmlContent: string }) {
    return (
        <div className="min-h-[450px]">
            <PluginViewport
                htmlContent={htmlContent}
                materialData={DEMO_MATERIAL}
                onProgress={(data) => console.log('Preview progress:', data)}
                onQuizResult={(data) => console.log('Preview quiz result:', data)}
                onNextChapter={() => console.log('Preview next chapter')}
            />
        </div>
    );
}
