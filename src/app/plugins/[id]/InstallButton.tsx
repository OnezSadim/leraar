'use client';

import { useState, useEffect, useTransition } from 'react';
import { Download, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { installPlugin, uninstallPlugin, getInstalledPluginIds } from '@/lib/actions/plugin-install-actions';

interface InstallButtonProps {
    pluginId: string;
}

export default function InstallButton({ pluginId }: InstallButtonProps) {
    const [isInstalled, setIsInstalled] = useState<boolean | null>(null); // null = loading
    const [isPending, startTransition] = useTransition();
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        getInstalledPluginIds().then((ids) => {
            setIsInstalled(ids.includes(pluginId));
        });
    }, [pluginId]);

    const handleToggle = () => {
        startTransition(async () => {
            if (isInstalled) {
                await uninstallPlugin(pluginId);
                setIsInstalled(false);
            } else {
                await installPlugin(pluginId);
                setIsInstalled(true);
                setFlash(true);
                setTimeout(() => setFlash(false), 1800);
            }
        });
    };

    if (isInstalled === null) {
        return (
            <div className="h-12 w-48 rounded-2xl bg-white/10 animate-pulse" />
        );
    }

    return (
        <button
            onClick={handleToggle}
            disabled={isPending}
            className={`group relative flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 shadow-lg
                ${isInstalled
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:scale-[1.02]'
                    : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:scale-[1.03] hover:shadow-violet-500/40 shadow-violet-500/20'
                }
                ${flash ? 'animate-bounce' : ''}
                disabled:opacity-60 disabled:cursor-not-allowed
            `}
        >
            {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : isInstalled ? (
                <Trash2 className="w-4 h-4" />
            ) : (
                <Download className="w-4 h-4" />
            )}
            {isPending
                ? 'Working...'
                : isInstalled
                    ? 'Uninstall Plugin'
                    : 'Install Plugin'}
            {isInstalled && !isPending && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-1" />
            )}
        </button>
    );
}
