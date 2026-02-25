'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
    ChevronLeft,
    BrainCircuit,
    Puzzle,
    Mic,
    LayoutGrid,
    Sparkles,
    ArrowRight,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    BookOpen,
    MessageSquare,
} from 'lucide-react'
import PluginViewport from '@/components/PluginViewport'
import { assessPriorKnowledge } from '@/lib/actions/study-actions'
import { getPublicPlugins } from '@/app/plugins/actions'
import { createClient } from '@/lib/supabase/client'
import { KnowledgeProfile } from '@/lib/ai'

// ── Types ──────────────────────────────────────────────────────────────────
type SessionPhase =
    | 'plugin_selection'
    | 'assessment'
    | 'processing'
    | 'active_session'

interface PluginCard {
    id: string
    name: string
    description: string | null
    plugin_type: string
    html_content?: string
}

// ── Static built-in plugin stubs (visible before user has published plugins) ──
const TYPE_META: Record<string, { color: string; icon: React.ReactNode; tagline: string }> = {
    tutor: {
        color: 'from-indigo-500 to-violet-600',
        icon: <MessageSquare className="w-7 h-7 text-white" />,
        tagline: 'Interactive AI-driven tutoring session',
    },
    flashcards: {
        color: 'from-blue-500 to-cyan-500',
        icon: <LayoutGrid className="w-7 h-7 text-white" />,
        tagline: 'Spaced-repetition flashcard drills',
    },
    narrator: {
        color: 'from-emerald-500 to-teal-600',
        icon: <Mic className="w-7 h-7 text-white" />,
        tagline: 'Audio-first narrated learning',
    },
    custom: {
        color: 'from-rose-500 to-pink-600',
        icon: <Puzzle className="w-7 h-7 text-white" />,
        tagline: 'Community-built learning plugin',
    },
}

const LEVEL_CONFIG = {
    beginner: { color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10', label: 'Beginner' },
    intermediate: { color: 'text-amber-400 border-amber-400/30 bg-amber-400/10', label: 'Intermediate' },
    advanced: { color: 'text-rose-400 border-rose-400/30 bg-rose-400/10', label: 'Advanced' },
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SessionPage() {
    const router = useRouter()
    const { id } = useParams<{ id: string }>()

    const [phase, setPhase] = useState<SessionPhase>('plugin_selection')
    const [plugins, setPlugins] = useState<PluginCard[]>([])
    const [selectedPlugin, setSelectedPlugin] = useState<PluginCard | null>(null)
    const [userAssessment, setUserAssessment] = useState('')
    const [knowledgeProfile, setKnowledgeProfile] = useState<KnowledgeProfile | null>(null)
    const [materialData, setMaterialData] = useState<any>(null)
    const [materialTitle, setMaterialTitle] = useState<string>('')
    const [loadingPlugins, setLoadingPlugins] = useState(true)
    const [assessmentError, setAssessmentError] = useState('')

    // ── Load material & plugins on mount ──────────────────────────────────
    useEffect(() => {
        const supabase = createClient()

        async function load() {
            // Fetch main material (or group)
            const [{ data: material }, { data: group }] = await Promise.all([
                supabase.from('materials').select('*').eq('id', id).single(),
                supabase
                    .from('material_groups')
                    .select('*, materials:material_group_items(material:materials(*))')
                    .eq('id', id)
                    .single(),
            ])

            if (material) {
                setMaterialData(material)
                setMaterialTitle(material.title || 'Study Session')
            } else if (group) {
                setMaterialData({
                    ...group,
                    materials: group.materials?.map((m: any) => m.material) ?? [],
                })
                setMaterialTitle((group as any).name || 'Study Session')
            }

            // Fetch community plugins
            const allPlugins = await getPublicPlugins({})
            setPlugins(allPlugins as PluginCard[])
            setLoadingPlugins(false)
        }

        load()
    }, [id])

    // ── Phase transitions ─────────────────────────────────────────────────
    function handleSelectPlugin(plugin: PluginCard) {
        setSelectedPlugin(plugin)
        setPhase('assessment')
    }

    async function handleStartAssessment() {
        if (!userAssessment.trim() || !selectedPlugin) return
        setAssessmentError('')
        setPhase('processing')
        try {
            const profile = await assessPriorKnowledge(id, materialTitle, userAssessment)
            setKnowledgeProfile(profile)
            setPhase('active_session')
        } catch (err: any) {
            console.error('Assessment error:', err)
            setAssessmentError('Something went wrong while analysing your response. Please try again.')
            setPhase('assessment')
        }
    }

    function handleExit() {
        router.push(`/study/${id}`)
    }

    // ── Render ─────────────────────────────────────────────────────────────
    const meta = selectedPlugin ? (TYPE_META[selectedPlugin.plugin_type] ?? TYPE_META.custom) : null

    return (
        <div className="min-h-screen bg-[#08080f] text-white flex flex-col overflow-hidden">
            {/* ── Fixed Header ─────────────────────────────────────────────────── */}
            <header
                className="
                    fixed top-0 left-0 right-0 z-50
                    h-16 px-6
                    flex items-center justify-between
                    bg-white/[0.03] backdrop-blur-2xl
                    border-b border-white/[0.06]
                    shadow-lg shadow-black/50
                "
            >
                {/* Left: Exit */}
                <button
                    onClick={handleExit}
                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group text-sm font-semibold"
                >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    Exit Session
                </button>

                {/* Centre: breadcrumb */}
                <div className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <BrainCircuit className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm font-bold text-white/70 hidden sm:block truncate max-w-xs">
                        {materialTitle || 'Study Session'}
                    </p>
                    {selectedPlugin && (
                        <>
                            <span className="text-white/20">/</span>
                            <span
                                className={`
                                    text-xs font-black uppercase tracking-widest px-2.5 py-1
                                    rounded-full bg-gradient-to-r ${TYPE_META[selectedPlugin.plugin_type]?.color ?? 'from-violet-500 to-purple-600'}
                                    text-white
                                `}
                            >
                                {selectedPlugin.name}
                            </span>
                        </>
                    )}
                </div>

                {/* Right: phase indicator */}
                <div className="flex items-center gap-2">
                    {(['plugin_selection', 'assessment', 'active_session'] as const).map((p, i) => (
                        <span
                            key={p}
                            className={`h-1.5 rounded-full transition-all duration-500 ${phase === p || (phase === 'processing' && i === 1)
                                ? 'w-6 bg-indigo-400'
                                : 'w-1.5 bg-white/10'
                                }`}
                        />
                    ))}
                </div>
            </header>

            {/* ── Content area (below fixed header, full remaining height) ────── */}
            <main className="flex-1 pt-16 flex flex-col">

                {/* ══ PHASE: plugin_selection ══════════════════════════════════════ */}
                {phase === 'plugin_selection' && (
                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Ambient orbs */}
                        <div className="fixed -top-32 -left-32 w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none" />
                        <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[130px] pointer-events-none" />

                        <div className="w-full max-w-5xl relative z-10">
                            {/* Heading */}
                            <div className="text-center mb-14">
                                <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 font-black mb-4">
                                    Step 1 of 3 · Choose your method
                                </p>
                                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                                    How do you want to{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                                        study today?
                                    </span>
                                </h1>
                                <p className="text-white/40 text-lg max-w-xl mx-auto">
                                    Select a learning plugin. Your experience will be personalised to your knowledge level.
                                </p>
                            </div>

                            {/* Plugin cards grid */}
                            {loadingPlugins ? (
                                <div className="flex justify-center py-24">
                                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                                </div>
                            ) : plugins.length === 0 ? (
                                <div className="text-center py-24 text-white/30 space-y-3">
                                    <Puzzle className="w-16 h-16 mx-auto opacity-30" />
                                    <p className="text-xl font-bold">No plugins in the marketplace yet.</p>
                                    <p className="text-sm">
                                        Visit the{' '}
                                        <button
                                            onClick={() => router.push('/plugins')}
                                            className="text-indigo-400 underline underline-offset-2"
                                        >
                                            Plugin Marketplace
                                        </button>{' '}
                                        to publish one!
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {plugins.map((plugin) => {
                                        const m = TYPE_META[plugin.plugin_type] ?? TYPE_META.custom
                                        return (
                                            <button
                                                key={plugin.id}
                                                onClick={() => handleSelectPlugin(plugin)}
                                                className="
                                                    group relative text-left p-6 rounded-3xl
                                                    bg-white/[0.04] hover:bg-white/[0.07]
                                                    border border-white/[0.07] hover:border-indigo-500/40
                                                    backdrop-blur-xl
                                                    transition-all duration-300
                                                    hover:shadow-2xl hover:shadow-indigo-500/10
                                                    hover:-translate-y-1
                                                    focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                                                "
                                            >
                                                {/* Glow on hover */}
                                                <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 bg-gradient-to-br ${m.color} transition-opacity duration-300`} style={{ opacity: 0 }} />

                                                {/* Icon */}
                                                <div
                                                    className={`
                                                        w-14 h-14 rounded-2xl flex items-center justify-center mb-5
                                                        bg-gradient-to-br ${m.color}
                                                        shadow-lg group-hover:scale-110 transition-transform duration-300
                                                    `}
                                                >
                                                    {m.icon}
                                                </div>

                                                {/* Text */}
                                                <h3 className="text-lg font-black mb-1 text-white">{plugin.name}</h3>
                                                <p className="text-sm text-white/40 leading-relaxed line-clamp-2 mb-4">
                                                    {plugin.description || m.tagline}
                                                </p>

                                                {/* Type badge */}
                                                <span
                                                    className={`
                                                        inline-block text-[10px] font-black uppercase tracking-widest
                                                        px-2.5 py-1 rounded-full
                                                        bg-gradient-to-r ${m.color} text-white
                                                    `}
                                                >
                                                    {plugin.plugin_type}
                                                </span>

                                                <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all duration-300" />
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══ PHASE: assessment ════════════════════════════════════════════ */}
                {phase === 'assessment' && selectedPlugin && meta && (
                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="fixed -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

                        <div className="w-full max-w-2xl relative z-10 space-y-8">
                            {/* Selected plugin badge */}
                            <div className="flex items-center gap-3 justify-center">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-lg`}>
                                    {meta.icon}
                                </div>
                                <span className="text-sm font-bold text-white/50">{selectedPlugin.name}</span>
                                <button
                                    onClick={() => setPhase('plugin_selection')}
                                    className="text-xs text-indigo-400 hover:underline ml-1"
                                >
                                    Change
                                </button>
                            </div>

                            {/* Heading */}
                            <div className="text-center space-y-3">
                                <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 font-black">
                                    Step 2 of 3 · Prior Knowledge
                                </p>
                                <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                                    What do you{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                                        already know?
                                    </span>
                                </h1>
                                <p className="text-white/40 text-base">
                                    The AI will personalise your session based on your current level. Be honest — there's no wrong answer.
                                </p>
                            </div>

                            {/* Textarea card */}
                            <div
                                className="
                                    bg-white/[0.04] backdrop-blur-xl
                                    border border-white/[0.08]
                                    focus-within:border-indigo-500/50
                                    rounded-3xl p-6 transition-colors duration-300
                                    shadow-2xl shadow-black/30
                                "
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <BrainCircuit className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs uppercase tracking-widest font-black text-white/30">
                                        Your Self-Assessment
                                    </span>
                                </div>
                                <textarea
                                    id="assessment-input"
                                    className="
                                        w-full min-h-[200px] bg-transparent border-none outline-none resize-none
                                        text-white/80 placeholder:text-white/15
                                        text-lg leading-relaxed
                                    "
                                    placeholder={`e.g. "I understand the basic concepts but struggle with the more advanced parts. I've seen introductory material but haven't practised much..."`}
                                    value={userAssessment}
                                    onChange={(e) => setUserAssessment(e.target.value)}
                                />
                                <p className="text-right text-xs text-white/20 mt-2">
                                    {userAssessment.length > 0 ? `${userAssessment.length} chars` : ''}
                                </p>
                            </div>

                            {/* Error */}
                            {assessmentError && (
                                <div className="flex items-center gap-3 text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-5 py-3 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {assessmentError}
                                </div>
                            )}

                            {/* CTA */}
                            <button
                                onClick={handleStartAssessment}
                                disabled={!userAssessment.trim()}
                                className="
                                    w-full py-5
                                    bg-gradient-to-r from-indigo-500 to-purple-600
                                    rounded-2xl font-black text-sm uppercase tracking-widest
                                    hover:scale-[1.02] active:scale-95 transition-all
                                    shadow-xl shadow-indigo-500/20
                                    disabled:opacity-20 disabled:cursor-not-allowed
                                    flex items-center justify-center gap-3
                                "
                            >
                                <Sparkles className="w-5 h-5" />
                                Analyse &amp; Start Session
                                <ArrowRight className="w-5 h-5" />
                            </button>

                            <p className="text-center text-white/20 text-xs">
                                Your response is analysed privately and never stored publicly.
                            </p>
                        </div>
                    </div>
                )}

                {/* ══ PHASE: processing ════════════════════════════════════════════ */}
                {phase === 'processing' && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-8 animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl animate-pulse" />
                            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                                <BrainCircuit className="w-10 h-10 text-white animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black">Mapping your knowledge…</h2>
                            <p className="text-white/40">
                                The AI is identifying gaps and tailoring your session.
                            </p>
                        </div>
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                )}

                {/* ══ PHASE: active_session ════════════════════════════════════════ */}
                {phase === 'active_session' && selectedPlugin && knowledgeProfile && (
                    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] animate-in fade-in duration-700">
                        {/* ── Knowledge Profile Banner ─────────────────────────────────── */}
                        <div
                            className="
                                mx-6 mt-4 mb-2 px-5 py-3
                                bg-white/[0.04] backdrop-blur-xl
                                border border-white/[0.07]
                                rounded-2xl
                                flex flex-wrap items-center gap-4
                            "
                        >
                            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-white/40 font-medium">Detected level:</span>
                                <span
                                    className={`
                                        text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full border
                                        ${LEVEL_CONFIG[knowledgeProfile.currentLevel]?.color ?? 'text-white/60'}
                                    `}
                                >
                                    {LEVEL_CONFIG[knowledgeProfile.currentLevel]?.label ?? knowledgeProfile.currentLevel}
                                </span>
                            </div>

                            {knowledgeProfile.recommendedFocus.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <BookOpen className="w-3.5 h-3.5 text-white/30" />
                                    <span className="text-white/30 text-xs font-bold">Focus:</span>
                                    {knowledgeProfile.recommendedFocus.slice(0, 3).map((f) => (
                                        <span
                                            key={f}
                                            className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold"
                                        >
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {knowledgeProfile.gaps.length > 0 && (
                                <p className="text-xs text-white/25 ml-auto hidden md:block max-w-xs truncate">
                                    Gaps: {knowledgeProfile.gaps.slice(0, 2).join(', ')}
                                    {knowledgeProfile.gaps.length > 2 ? ` +${knowledgeProfile.gaps.length - 2} more` : ''}
                                </p>
                            )}
                        </div>

                        {/* ── Full-height Plugin Viewport ──────────────────────────────── */}
                        <div className="flex-1 px-6 pb-6 min-h-0">
                            <div className="h-full rounded-3xl overflow-hidden border border-white/[0.07] shadow-2xl shadow-black/60">
                                <PluginViewport
                                    htmlContent={selectedPlugin.html_content}
                                    materialData={materialData}
                                    knowledgeProfile={knowledgeProfile}
                                    onProgress={(data) => console.log('[Session] Plugin progress:', data)}
                                    onQuizResult={(data) => console.log('[Session] Quiz result:', data)}
                                    onNextChapter={() => console.log('[Session] Next chapter requested')}
                                />
                            </div>
                        </div>

                        {/* ── Glassmorphic Floating HUD ────────────────────────────────────
                            Rendered OUTSIDE the plugin iframe — always accessible.
                            AI Help (bottom-right) + plugin badge (bottom-left).
                        */}
                        <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-3 pointer-events-none">
                            <button
                                onClick={() => router.push(`/study/${id}`)}
                                title="Get help from your AI assistant"
                                className="pointer-events-auto flex items-center gap-2.5 px-5 py-3 bg-white/[0.08] hover:bg-indigo-500/30 backdrop-blur-2xl border border-white/[0.12] hover:border-indigo-500/50 rounded-2xl text-white/70 hover:text-white font-bold text-sm shadow-2xl shadow-black/50 transition-all duration-300 hover:scale-105 active:scale-95 group"
                            >
                                <Sparkles className="w-4 h-4 text-indigo-400 group-hover:animate-pulse" />
                                AI Help
                            </button>
                        </div>
                        <div className="fixed bottom-8 left-8 z-[100] pointer-events-none">
                            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-xl shadow-black/40">
                                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${meta?.color ?? 'from-indigo-500 to-purple-600'} animate-pulse`} />
                                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">
                                    {selectedPlugin.name}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
