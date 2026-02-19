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
    Clock
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

type StudyPhase = 'assessment' | 'processing' | 'learning'

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
    const bottomRef = useRef<HTMLDivElement>(null)

    const materialId = (initialData as any).id;
    const title = (initialData as any).name || (initialData as Material).title;

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [learningBlocks, currentBlockIndex])

    const handleStartStudy = async () => {
        setPhase('processing')
        try {
            const blocks = await getInitialAIBlocks(materialId, title, userKnowledge);
            await processBlocks(blocks as LearningBlock[])
            setPhase('learning')
        } catch (error) {
            console.error("AI Start Study Error:", error)
            alert("Something went wrong. Check console.")
            setPhase('assessment')
        }
    }

    const processBlocks = async (blocks: LearningBlock[]) => {
        const processedBlocks: LearningBlock[] = []
        let latestTime = timeRemaining;

        for (const block of blocks) {
            if (block.timeEstimateRemaining) {
                latestTime = block.timeEstimateRemaining;
            }

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

        if (latestTime) setTimeRemaining(latestTime);
        setLearningBlocks(prev => [...prev, ...processedBlocks])
        setCurrentBlockIndex(learningBlocks.length)
    }

    const handleNext = async () => {
        if (currentBlockIndex < learningBlocks.length - 1) {
            setCurrentBlockIndex(currentBlockIndex + 1)
        } else {
            setIsGeneratingNext(true)
            try {
                const nextBlocks = await getNextAIBlocks(materialId, title, learningBlocks as any);
                if (nextBlocks && nextBlocks.length > 0) {
                    await processBlocks(nextBlocks as LearningBlock[])
                    setCurrentBlockIndex(currentBlockIndex + 1)
                }
            } catch (error) {
                console.error("AI Next Block Error:", error)
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
                materialId,
                currentBlock.text,
                currentBlock.answer || '',
                openAnswer,
                currentBlock.concepts || []
            )
            const updatedBlocks = [...learningBlocks]
            updatedBlocks[currentBlockIndex] = {
                ...currentBlock,
                userAnswer: openAnswer,
                isCorrect: result.isCorrect,
                feedback: result.feedback
            }
            setLearningBlocks(updatedBlocks)
            setOpenAnswer('')
        } catch (error) {
            console.error("Open Answer Error:", error)
        } finally {
            setIsAnswering(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white">
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all flex items-center gap-2">
                        <ChevronLeft className="h-5 w-5" />
                        <span className="text-sm font-medium">Exit Session</span>
                    </button>
                    <div className="flex items-center gap-6">
                        {timeRemaining && (
                            <div className="flex items-center gap-2 text-indigo-400">
                                <Clock className="h-4 w-4" />
                                <span className="text-xs font-black tracking-widest uppercase">{timeRemaining} left</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(currentBlockIndex + 1) / (learningBlocks.length + 5) * 100}%` }} />
                            </div>
                            <span className="text-[10px] uppercase tracking-widest font-black text-indigo-400">Progress</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-32 max-w-3xl mx-auto px-6">
                {phase === 'assessment' && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="space-y-4">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20">
                                <BrainCircuit className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-4xl font-black tracking-tight">What do you <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">already know</span>?</h1>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative group focus-within:border-indigo-500/50 transition-colors">
                                <textarea
                                    className="w-full min-h-[200px] bg-transparent border-none outline-none resize-none text-white/80 placeholder:text-white/10 text-lg leading-relaxed"
                                    placeholder="Describe your current level..."
                                    value={userKnowledge}
                                    onChange={(e) => setUserKnowledge(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleStartStudy}
                                disabled={!userKnowledge.trim()}
                                className="w-full py-5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-20 flex items-center justify-center gap-3"
                            >
                                Start Studying <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'processing' && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-500">
                        <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
                        <h2 className="text-xl font-bold text-white">Analyzing your input...</h2>
                    </div>
                )}

                {phase === 'learning' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        {learningBlocks.slice(0, currentBlockIndex + 1).map((block, idx) => (
                            <div key={`${block.id}-${idx}`} className={`p-8 rounded-3xl border transition-all duration-700 ${block.type === 'content' ? 'bg-white/5 border-white/5' : 'bg-indigo-500/10 border-indigo-500/20'} ${idx === currentBlockIndex ? 'animate-fade-in-up' : 'opacity-40 scale-[0.98]'}`}>
                                {block.type === 'content' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className="h-4 w-4 text-indigo-400" />
                                            <span className="text-[10px] uppercase font-black tracking-widest text-white/30">AI Explanation</span>
                                        </div>
                                        <p className="text-xl leading-relaxed text-white/90 font-medium whitespace-pre-wrap">{block.text}</p>
                                        {block.concepts && (
                                            <div className="flex gap-2 pt-2">
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
                                                    className={`px-6 py-4 rounded-2xl border text-left transition-all ${block.userAnswer ? (option === block.answer ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : (option === block.userAnswer ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 opacity-50')) : 'bg-white/5 border-white/10 hover:border-indigo-500/50'}`}
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
                                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 italic text-white/60">
                                                    Your answer: {block.userAnswer}
                                                </div>
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
                        <div className="fixed bottom-0 left-0 right-0 p-8 flex justify-center z-50 pointer-events-none">
                            <div className="max-w-xs w-full pointer-events-auto">
                                {(!learningBlocks[currentBlockIndex]?.options || learningBlocks[currentBlockIndex]?.userAnswer) && (
                                    <button onClick={handleNext} disabled={isGeneratingNext} className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isGeneratingNext ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continue Study <ArrowRight className="h-5 w-5" /></>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
