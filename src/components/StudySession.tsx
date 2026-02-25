'use client'

import { useState, useEffect, useRef } from 'react'
import {
    ChevronLeft,
    Send,
    Sparkles,
    CheckCircle2,
    Lightbulb,
    BookOpen,
    ArrowRight,
    BrainCircuit,
    Loader2,
    GraduationCap,
    Clock,
    Puzzle,
    X,
    Zap
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Material, MaterialGroup } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import {
    getInitialAIBlocks,
    getNextAIBlocks,
    submitOpenAnswer,
    loadSectionData
} from '@/lib/actions/study-actions'
import { getInstalledPlugins, type InstalledPlugin } from '@/lib/actions/plugin-install-actions'
import PluginViewport from './PluginViewport'
import { ClientAnalyticsLogger } from '@/lib/analytics'

type StudyPhase = 'assessment' | 'processing' | 'plugin-select' | 'learning'

interface StudySessionProps {
    initialData: Material | MaterialGroup
    isGroup: boolean
}

interface LearningBlock {
    id: string
    type: 'content' | 'question' | 'open_question' | 'action'
    text: string
    options?: string[]
    answer?: string
    userAnswer?: string
    isCorrect?: boolean
    action?: 'load_section' | 'load_question'
    sectionId?: string
    feedback?: string
    concepts?: string[]
    timeEstimateRemaining?: string
}

// The built-in interactive AI tutor, treated exactly like a plugin
const BUILTIN_PLUGIN = {
    id: '__builtin_interactive__',
    name: 'Interactive AI Tutor',
    description: 'AI-guided explanations, questions and adaptive learning blocks — built right in.',
    type: 'builtin',
    gradient: 'from-indigo-500 to-purple-600',
}

export default function StudySession({ initialData, isGroup }: StudySessionProps) {
    const router = useRouter()
    const supabase = createClient()

    const [phase, setPhase] = useState<StudyPhase>('assessment')
    const [userKnowledge, setUserKnowledge] = useState('')
    const [learningBlocks, setLearningBlocks] = useState<LearningBlock[]>([])
    const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
    const [isAnswering, setIsAnswering] = useState(false)
    const [isGeneratingNext, setIsGeneratingNext] = useState(false)
    const [openAnswer, setOpenAnswer] = useState('')
    const [timeRemaining, setTimeRemaining] = useState<string | null>(null)

    // Plugin state
    const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([])
    const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)  // plugin id or '__builtin_interactive__'
    const [loadingPlugins, setLoadingPlugins] = useState(true)

    const bottomRef = useRef<HTMLDivElement>(null)
    const analyticsLoggerRef = useRef<ClientAnalyticsLogger | null>(null)

    const materialId = (initialData as any).id
    const title = (initialData as any).name || (initialData as Material).title

    // Load installed plugins on mount
    useEffect(() => {
        getInstalledPlugins().then(data => {
            setInstalledPlugins(data)
            setLoadingPlugins(false)
        })
    }, [])

    // Analytics
    useEffect(() => {
        if (selectedPlugin && selectedPlugin !== BUILTIN_PLUGIN.id) {
            supabase.auth.getUser().then(({ data: { user } }) => {
                const studentId = user ? user.id : 'anonymous'
                analyticsLoggerRef.current = new ClientAnalyticsLogger(materialId, selectedPlugin, studentId)
            })
        } else {
            analyticsLoggerRef.current?.finishSession()
            analyticsLoggerRef.current = null
        }
        return () => {
            analyticsLoggerRef.current?.finishSession()
            analyticsLoggerRef.current = null
        }
    }, [selectedPlugin, materialId])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [learningBlocks, currentBlockIndex])

    // Phase 1 → 2: begin AI knowledge analysis
    const handleStartAssessment = async () => {
        setPhase('processing')
        try {
            const blocks = await getInitialAIBlocks(materialId, title, userKnowledge)
            await processBlocks(blocks as LearningBlock[])
            setPhase('plugin-select')
        } catch (error) {
            console.error('AI Start Study Error:', error)
            setPhase('assessment')
        }
    }

    const processBlocks = async (blocks: LearningBlock[]) => {
        const processedBlocks: LearningBlock[] = []
        let latestTime = timeRemaining

        for (const block of blocks) {
            if (block.timeEstimateRemaining) latestTime = block.timeEstimateRemaining

            if (block.type === 'action' && block.action === 'load_section' && block.sectionId) {
                const section = await loadSectionData(block.sectionId, materialId)
                if (section) {
                    processedBlocks.push({
                        id: `section-${section.id}-${Date.now()}`,
                        type: 'content',
                        text: `${section.title}\n\n${section.content}`,
                        concepts: section.concepts_covered
                    })
                }
            } else {
                processedBlocks.push(block)
            }
        }

        if (latestTime) setTimeRemaining(latestTime)

        const oldLength = learningBlocks.length
        setLearningBlocks(prev => [...prev, ...processedBlocks])

        if (processedBlocks.length > 1) {
            const firstQ = processedBlocks.findIndex(b => b.type === 'question' || b.type === 'open_question')
            if (firstQ === -1) {
                setCurrentBlockIndex(oldLength + processedBlocks.length - 1)
            } else if (firstQ > 0) {
                setCurrentBlockIndex(oldLength + firstQ)
            } else {
                setCurrentBlockIndex(oldLength)
            }
        } else {
            setCurrentBlockIndex(oldLength)
        }
    }

    // Phase 3 → 4: plugin selected
    const handlePluginSelect = (pluginId: string) => {
        setSelectedPlugin(pluginId)
        setPhase('learning')
    }

    const handleNext = async () => {
        if (currentBlockIndex < learningBlocks.length - 1) {
            setCurrentBlockIndex(currentBlockIndex + 1)
        } else {
            setIsGeneratingNext(true)
            try {
                const nextBlocks = await getNextAIBlocks(materialId, title, learningBlocks as any)
                if (nextBlocks && nextBlocks.length > 0) {
                    await processBlocks(nextBlocks as LearningBlock[])
                    setCurrentBlockIndex(currentBlockIndex + 1)
                }
            } catch (error) {
                console.error('AI Next Block Error:', error)
            } finally {
                setIsGeneratingNext(false)
            }
        }
    }

    const handleAnswerMCQ = (option: string) => {
        const updatedBlocks = [...learningBlocks]
        const currentBlock = updatedBlocks[currentBlockIndex]
        if (currentBlock.type === 'question') {
            currentBlock.userAnswer = option
            currentBlock.isCorrect = option === currentBlock.answer
            setLearningBlocks(updatedBlocks)
            setIsAnswering(true)
            setTimeout(() => setIsAnswering(false), 800)
        }
    }

    const handleSubmitOpen = async () => {
        const currentBlock = learningBlocks[currentBlockIndex]
        if (currentBlock.type !== 'open_question') return
        setIsAnswering(true)
        try {
            const result = await submitOpenAnswer(
                materialId, currentBlock.text,
                currentBlock.answer || '', openAnswer, currentBlock.concepts || []
            )
            const updated = [...learningBlocks]
            updated[currentBlockIndex] = { ...currentBlock, userAnswer: openAnswer, isCorrect: result.isCorrect, feedback: result.feedback }
            setLearningBlocks(updated)
            setOpenAnswer('')
        } catch (error) {
            console.error('Open Answer Error:', error)
        } finally {
            setIsAnswering(false)
        }
    }

    // ─── Header (shared across phases) ───────────────────────────────────────────
    const header = (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0c]/90 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
                <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all flex items-center gap-2">
                    <ChevronLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">Exit</span>
                </button>
                <div className="flex items-center gap-4">
                    <h1 className="text-sm font-bold text-white/70 truncate max-w-[200px] sm:max-w-xs">{title}</h1>
                    {phase === 'learning' && selectedPlugin !== BUILTIN_PLUGIN.id && (
                        <button
                            onClick={() => { setSelectedPlugin(null); setPhase('plugin-select') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/40 hover:text-white text-xs font-bold transition-all"
                        >
                            <Puzzle className="h-3.5 w-3.5" /> Switch Plugin
                        </button>
                    )}
                    {timeRemaining && phase === 'learning' && (
                        <div className="flex items-center gap-2 text-indigo-400">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs font-black tracking-widest uppercase">{timeRemaining} left</span>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )

    // ─── PHASE: Assessment ────────────────────────────────────────────────────────
    if (phase === 'assessment') {
        return (
            <div className="min-h-screen bg-[#0a0a0c] text-white">
                {header}
                <main className="pt-20 pb-32 max-w-2xl mx-auto px-6">
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div>
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20">
                                <BrainCircuit className="h-7 w-7 text-white" />
                            </div>
                            <h1 className="text-4xl font-black tracking-tight mb-2">
                                What do you <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">already know</span>?
                            </h1>
                            <p className="text-white/40 text-sm">Tell the AI your current level so it can tailor the session to you.</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 focus-within:border-indigo-500/50 transition-colors">
                            <textarea
                                className="w-full min-h-[180px] bg-transparent border-none outline-none resize-none text-white/80 placeholder:text-white/15 text-lg leading-relaxed"
                                placeholder="e.g. I know the basics of photosynthesis but I struggle with the Calvin cycle..."
                                value={userKnowledge}
                                onChange={(e) => setUserKnowledge(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleStartAssessment}
                            disabled={!userKnowledge.trim()}
                            className="w-full py-5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-20 flex items-center justify-center gap-3"
                        >
                            Analyse & Continue <ArrowRight className="h-5 w-5" />
                        </button>
                    </div>
                </main>
            </div>
        )
    }

    // ─── PHASE: Processing ────────────────────────────────────────────────────────
    if (phase === 'processing') {
        return (
            <div className="min-h-screen bg-[#0a0a0c] text-white">
                {header}
                <div className="flex flex-col items-center justify-center min-h-screen gap-6">
                    <div className="relative">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 animate-pulse">
                            <BrainCircuit className="h-8 w-8 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-[#0a0a0c] flex items-center justify-center">
                            <Loader2 className="h-3 w-3 text-white animate-spin" />
                        </div>
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white">Analysing your knowledge…</h2>
                        <p className="text-white/30 text-sm mt-1">The AI is preparing a personalised session</p>
                    </div>
                </div>
            </div>
        )
    }

    // ─── PHASE: Plugin Selection ──────────────────────────────────────────────────
    if (phase === 'plugin-select') {
        const pluginCards = [
            BUILTIN_PLUGIN,
            ...installedPlugins
                .filter(p => p.plugin.html_content)
                .map(p => ({
                    id: p.plugin_id,
                    name: p.plugin.name,
                    description: p.plugin.description || 'Community learning plugin',
                    type: p.plugin.plugin_type,
                    gradient: p.plugin.plugin_type === 'flashcards' ? 'from-blue-500 to-cyan-500'
                        : p.plugin.plugin_type === 'narrator' ? 'from-emerald-500 to-teal-600'
                            : p.plugin.plugin_type === 'tutor' ? 'from-violet-500 to-purple-600'
                                : 'from-rose-500 to-pink-600',
                }))
        ]

        return (
            <div className="min-h-screen bg-[#0a0a0c] text-white">
                {header}
                <main className="pt-20 pb-20 max-w-3xl mx-auto px-6">
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="mb-10">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-6 shadow-xl shadow-violet-500/20">
                                <Puzzle className="h-7 w-7 text-white" />
                            </div>
                            <h1 className="text-4xl font-black tracking-tight mb-2">
                                Choose your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">learning mode</span>
                            </h1>
                            <p className="text-white/40 text-sm">Select how you want to study <strong className="text-white/60">{title}</strong>. You can switch anytime.</p>
                        </div>

                        {loadingPlugins ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="h-8 w-8 text-white/20 animate-spin" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {pluginCards.map(plugin => (
                                    <button
                                        key={plugin.id}
                                        onClick={() => handlePluginSelect(plugin.id)}
                                        className="group relative text-left p-6 rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/8 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] active:scale-95 overflow-hidden"
                                    >
                                        {/* Gradient glow */}
                                        <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${plugin.gradient} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`} />

                                        <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${plugin.gradient} shadow-lg mb-4`}>
                                            {plugin.type === 'builtin'
                                                ? <Zap className="h-6 w-6 text-white" />
                                                : plugin.type === 'flashcards'
                                                    ? <BookOpen className="h-6 w-6 text-white" />
                                                    : plugin.type === 'narrator'
                                                        ? <Sparkles className="h-6 w-6 text-white" />
                                                        : <Puzzle className="h-6 w-6 text-white" />}
                                        </div>

                                        <h3 className="text-lg font-black text-white mb-1">{plugin.name}</h3>
                                        <p className="text-white/40 text-sm leading-relaxed">{plugin.description}</p>

                                        {plugin.id === BUILTIN_PLUGIN.id && (
                                            <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
                                                <Zap className="h-2.5 w-2.5" /> Built-in
                                            </span>
                                        )}

                                        <div className="absolute right-5 bottom-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowRight className="h-5 w-5 text-white/40" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!loadingPlugins && installedPlugins.length === 0 && (
                            <p className="mt-6 text-center text-white/20 text-xs">
                                No plugins installed. <a href="/plugins" className="text-indigo-400 hover:text-indigo-300">Browse the marketplace →</a>
                            </p>
                        )}
                    </div>
                </main>
            </div>
        )
    }

    // ─── PHASE: Learning ──────────────────────────────────────────────────────────
    // Find the plugin data if a marketplace plugin was selected
    const activeInstalledPlugin = installedPlugins.find(p => p.plugin_id === selectedPlugin)

    // If a marketplace plugin is selected → full-screen iframe
    if (phase === 'learning' && selectedPlugin && selectedPlugin !== BUILTIN_PLUGIN.id) {
        return (
            <div className="fixed inset-0 bg-[#0a0a0c] z-50 flex flex-col">
                {header}
                <div className="flex-1 pt-14 overflow-hidden">
                    {activeInstalledPlugin ? (
                        <PluginViewport
                            htmlContent={activeInstalledPlugin.plugin.html_content}
                            materialData={initialData}
                            onProgress={(data) => console.log('Plugin Progress:', data)}
                            onQuizResult={(data) => {
                                console.log('Plugin Quiz Result:', data)
                                analyticsLoggerRef.current?.logQuizResult(data)
                            }}
                            onNextChapter={() => {
                                analyticsLoggerRef.current?.finishSession()
                                analyticsLoggerRef.current = null
                                setPhase('plugin-select')
                                setSelectedPlugin(null)
                            }}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-white/30">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ─── Built-in Interactive AI Tutor (full-page, scrollable) ───────────────────
    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white">
            {header}
            <main className="pt-20 pb-40 max-w-3xl mx-auto px-6">
                <div className="space-y-6">
                    {learningBlocks.slice(0, currentBlockIndex + 1).map((block, idx) => (
                        <div
                            key={`${block.id}-${idx}`}
                            className={`p-8 rounded-3xl border transition-all duration-700
                                ${block.type === 'content' ? 'bg-white/5 border-white/5' : 'bg-indigo-500/10 border-indigo-500/20'}
                                ${idx === currentBlockIndex ? 'animate-in fade-in slide-in-from-bottom-4 duration-700' : 'opacity-40 scale-[0.98]'}
                            `}
                        >
                            {block.type === 'content' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="h-4 w-4 text-indigo-400" />
                                        <span className="text-[10px] uppercase font-black tracking-widest text-white/30">AI Explanation</span>
                                    </div>
                                    <p className="text-xl leading-relaxed text-white/90 font-medium whitespace-pre-wrap">{block.text}</p>
                                    {block.concepts && (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {block.concepts.map(c => <span key={c} className="px-2 py-1 bg-white/5 rounded-md text-[10px] text-white/40">#{c}</span>)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {block.type === 'question' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <GraduationCap className="h-4 w-4 text-indigo-400" />
                                        <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Multiple Choice</span>
                                    </div>
                                    <h3 className="text-2xl font-bold">{block.text}</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {block.options?.map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => !block.userAnswer && handleAnswerMCQ(option)}
                                                className={`px-6 py-4 rounded-2xl border text-left transition-all ${block.userAnswer
                                                        ? option === block.answer ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                            : option === block.userAnswer ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                                                : 'bg-white/5 opacity-50'
                                                        : 'bg-white/5 border-white/10 hover:border-indigo-500/50'
                                                    }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {block.type === 'open_question' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb className="h-4 w-4 text-amber-400" />
                                        <span className="text-[10px] uppercase font-black tracking-widest text-amber-400">Open Question</span>
                                    </div>
                                    <h3 className="text-2xl font-bold">{block.text}</h3>
                                    {!block.userAnswer ? (
                                        <div className="space-y-4">
                                            <textarea
                                                className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-indigo-500/50 outline-none transition-all"
                                                placeholder="Type your answer here..."
                                                value={openAnswer}
                                                onChange={(e) => setOpenAnswer(e.target.value)}
                                            />
                                            <button
                                                onClick={handleSubmitOpen}
                                                disabled={!openAnswer.trim() || isAnswering}
                                                className="px-8 py-3 bg-indigo-500 rounded-xl font-bold text-sm flex items-center gap-2"
                                            >
                                                {isAnswering ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Submit Answer</>}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 italic text-white/60">Your answer: {block.userAnswer}</div>
                                            <div className={`p-4 rounded-2xl border ${block.isCorrect ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                                <p className="font-bold flex items-center gap-2 mb-1">
                                                    {block.isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                                    {block.isCorrect ? 'Correct!' : 'Feedback'}
                                                </p>
                                                <p className="text-sm">{block.feedback}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            </main>

            {/* Sticky Continue button */}
            <div className="fixed bottom-0 left-0 right-0 p-8 flex justify-center z-50 pointer-events-none">
                <div className="max-w-sm w-full pointer-events-auto space-y-3">
                    {(!learningBlocks[currentBlockIndex]?.options || learningBlocks[currentBlockIndex]?.userAnswer) && (
                        <button
                            onClick={handleNext}
                            disabled={isGeneratingNext}
                            className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isGeneratingNext ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continue <ArrowRight className="h-5 w-5" /></>}
                        </button>
                    )}
                    <button
                        onClick={() => { setPhase('plugin-select'); setSelectedPlugin(null) }}
                        className="w-full py-2.5 rounded-2xl text-white/20 hover:text-white/60 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        <Puzzle className="h-3.5 w-3.5" /> Switch Learning Mode
                    </button>
                </div>
            </div>
        </div>
    )
}
