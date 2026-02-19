'use client'

import { useState, useEffect } from 'react'
import {
    X,
    Upload,
    Info,
    Plus,
    Check,
    AlertCircle,
    Loader2,
    BookOpen
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { processMaterialAction } from '@/lib/actions/study-actions'
import { Subject } from '@/types/database'

interface MaterialImportProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function MaterialImport({ onClose, onSuccess }: MaterialImportProps) {
    const supabase = createClient()
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('cs')

    useEffect(() => {
        const fetchSubjects = async () => {
            const { data } = await supabase.from('subjects').select('*')
            if (data) setSubjects(data)
        }
        fetchSubjects()
    }, [])

    const handleImport = async () => {
        if (!input.trim()) return
        setError(null)
        setIsProcessing(true)

        try {
            // "Super Baseline" format parsing: Title | Overview | Content | [Questions]
            const parts = input.split('|').map(p => p.trim())

            if (parts.length < 3) {
                throw new Error('Invalid format. Please use: Title | Overview | Content | [Optional Questions]')
            }

            const title = parts[0]
            const overview = parts[1]
            const content = parts[2]
            const questionsPart = parts[3] || ''

            const practiceQuestions = questionsPart ? questionsPart.split(';').map(q => {
                const [question, answer] = q.split(':').map(s => s.trim())
                return { question: question || q, answer: answer || 'Explain in your own words' }
            }) : []

            // 1. Get user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('You must be logged in to import materials')

            // 2. Insert material
            const { data: material, error: insertError } = await supabase
                .from('materials')
                .insert({
                    title,
                    overview,
                    content,
                    practice_questions: practiceQuestions,
                    subject_id: selectedSubjectId
                })
                .select()
                .single()

            if (insertError) throw insertError

            // Trigger preprocessing
            await processMaterialAction(material.id)

            setSuccess(true)
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 2000)

        } catch (err: any) {
            setError(err.message || 'Failed to process material')
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-[#0f1115] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/40">
                            <Upload className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Import Material</h2>
                            <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mt-1">Super Baseline Processor</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-2xl hover:bg-white/5 text-white/30 hover:text-white transition-all hover:rotate-90 duration-300"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto">
                    {/* Instructions */}
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-4 right-4 text-indigo-500/20 group-hover:text-indigo-500/40 transition-colors">
                            <Info className="h-12 w-12" />
                        </div>
                        <h3 className="text-indigo-300 font-bold mb-3 flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Formatting Instructions
                        </h3>
                        <p className="text-white/70 text-sm leading-relaxed mb-4">
                            Paste your study material below using our <span className="text-white font-bold underline decoration-indigo-500/50">Super Baseline</span> format:
                        </p>
                        <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-indigo-200 border border-white/5 select-all">
                            Title | Overview | Content | Q1:A1; Q2:A2
                        </div>
                    </div>

                    {/* Subject Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-white/40 uppercase tracking-widest px-1">Select Subject</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {subjects.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSubjectId(s.id)}
                                    className={`
                                        flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300
                                        ${selectedSubjectId === s.id
                                            ? 'bg-indigo-500/20 border-indigo-500/50 shadow-lg'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10'}
                                    `}
                                >
                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${s.color} shadow-sm`}>
                                        <BookOpen className="h-4 w-4 text-white" />
                                    </div>
                                    <span className={`text-xs font-bold ${selectedSubjectId === s.id ? 'text-white' : 'text-white/60'}`}>{s.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Input Field */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-black text-white/40 uppercase tracking-widest">Input Data</label>
                            <span className="text-[10px] text-white/20 font-medium">Auto-detected formatting: <span className="text-indigo-400">Pipes (|)</span></span>
                        </div>
                        <textarea
                            placeholder="Enter your data here..."
                            className="w-full h-48 bg-white/5 border border-white/10 rounded-3xl p-6 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none shadow-inner"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
                            <AlertCircle className="h-5 w-5 text-rose-500" />
                            <p className="text-rose-200 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
                            <Check className="h-5 w-5 text-emerald-500" />
                            <p className="text-emerald-200 text-sm font-medium">Material imported successfully! AI is sectioning now...</p>
                        </div>
                    )}

                    <button
                        onClick={handleImport}
                        disabled={!input.trim() || isProcessing || success}
                        className={`
                            w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-500 shadow-2xl flex items-center justify-center gap-3
                            ${input.trim() && !isProcessing && !success
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95'
                                : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'}
                        `}
                    >
                        {isProcessing ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Upload className="h-5 w-5" />
                        )}
                        {isProcessing ? 'Processing...' : 'Super Baseline Import'}
                    </button>
                </div>
            </div>
        </div>
    )
}
