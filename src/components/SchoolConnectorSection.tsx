'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    School,
    Puzzle,
    Download,
    CheckCircle,
    Loader2,
    ExternalLink,
    Search,
    ShieldCheck,
    ArrowRight
} from 'lucide-react'
import { getPublicPlugins } from '@/app/plugins/actions'
import { installPlugin, getInstalledPluginIds } from '@/lib/actions/plugin-install-actions'

// Map connector_type → settings anchor where user enters credentials
const CONNECTOR_SETTINGS_MAP: Record<string, string> = {
    magister: '#magister',
    somtoday: '#somtoday',
    google_classroom: '#calendar',
    // fallback for unknown connectors
    default: '#magister',
}

function connectorSettingsAnchor(connectorType: string | null): string {
    if (!connectorType) return CONNECTOR_SETTINGS_MAP.default
    return CONNECTOR_SETTINGS_MAP[connectorType] ?? CONNECTOR_SETTINGS_MAP.default
}

export default function SchoolConnectorSection() {
    const router = useRouter()

    const [search, setSearch] = useState('')
    const [plugins, setPlugins] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [installedIds, setInstalledIds] = useState<string[]>([])
    const [installing, setInstalling] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            setLoading(true)
            // Fetch plugins that are school connectors (connector_type is set)
            const all = await getPublicPlugins({ searchTerm: search })
            const connectors = (all as any[]).filter(
                (p) => p.connector_type || p.plugin_type === 'connector'
            )
            setPlugins(connectors)
            const ids = await getInstalledPluginIds()
            setInstalledIds(ids)
            setLoading(false)
        }
        load()
    }, [search])

    async function handleInstall(pluginId: string, connectorType: string | null) {
        setInstalling(pluginId)
        try {
            await installPlugin(pluginId)
            setInstalledIds((prev) => [...prev, pluginId])

            // Auto-redirect to the credential settings for this connector
            const anchor = connectorSettingsAnchor(connectorType)
            router.push(`/settings${anchor}`)
        } catch {
            // silently let the UI reflect the installed state
        } finally {
            setInstalling(null)
        }
    }

    return (
        <section id="school-connector" className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group scroll-mt-24 col-span-full">
            <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/5 rounded-full -mr-28 -mt-28 blur-[80px] group-hover:bg-emerald-500/10 transition-colors" />

            {/* Header */}
            <div className="flex items-start justify-between mb-6 relative">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <School className="h-5 w-5 text-emerald-300" />
                        Connect to School System
                    </h2>
                    <p className="text-white/40 text-xs mt-1">
                        Install a school connector plugin and we&apos;ll guide you straight to the credential setup.
                    </p>
                </div>
                <a
                    href="/plugins"
                    className="flex items-center gap-1.5 text-xs font-bold text-white/30 hover:text-white transition-colors"
                >
                    <ExternalLink className="h-3.5 w-3.5" /> Full Marketplace
                </a>
            </div>

            {/* Search */}
            <div className="relative mb-5">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                <input
                    type="text"
                    placeholder="Search school connectors..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                />
            </div>

            {/* Connector list */}
            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 text-white/20 animate-spin" />
                </div>
            ) : plugins.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-3 text-center">
                    <div className="p-3 bg-white/5 rounded-2xl">
                        <Puzzle className="h-8 w-8 text-white/20" />
                    </div>
                    <p className="text-white/30 text-sm">No school connector plugins found.</p>
                    <a
                        href="/plugins"
                        className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                        Browse full marketplace <ArrowRight className="h-3 w-3" />
                    </a>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {plugins.map((plugin) => {
                        const isInstalled = installedIds.includes(plugin.id)
                        const isInstalling = installing === plugin.id

                        return (
                            <div
                                key={plugin.id}
                                className="flex items-center gap-4 p-4 bg-black/30 border border-white/8 rounded-2xl hover:border-emerald-500/20 transition-all group/card"
                            >
                                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0">
                                    <School className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-white truncate">{plugin.name}</p>
                                    <p className="text-xs text-white/40 truncate">
                                        {plugin.connector_type
                                            ? plugin.connector_type.charAt(0).toUpperCase() + plugin.connector_type.slice(1)
                                            : 'School Connector'}
                                    </p>
                                </div>
                                {isInstalled ? (
                                    <div className="flex items-center gap-1.5 shrink-0" title="Installed — click to configure">
                                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                                        <a
                                            href={`/settings${connectorSettingsAnchor(plugin.connector_type)}`}
                                            className="text-[11px] font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300"
                                        >
                                            Configure
                                        </a>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleInstall(plugin.id, plugin.connector_type)}
                                        disabled={isInstalling}
                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 disabled:opacity-60"
                                    >
                                        {isInstalling ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Download className="h-3.5 w-3.5" />
                                        )}
                                        {isInstalling ? 'Installing…' : 'Install'}
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* If no connectors at all, show a note */}
            {!loading && plugins.length > 0 && (
                <p className="mt-4 text-[11px] text-white/20 text-center">
                    <ShieldCheck className="inline h-3 w-3 mr-1" />
                    Installing a connector will immediately take you to its credential setup screen.
                </p>
            )}
        </section>
    )
}
