'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    X,
    Upload,
    Info,
    Plus,
    Check,
    AlertCircle,
    Loader2,
    BookOpen,
    Search,
    FileText,
    File,
    FileImage
} from 'lucide-react'
import CredentialGuard from './CredentialGuard'
import { createClient } from '@/lib/supabase/client'
import { processMaterialAction } from '@/lib/actions/study-actions'
import { Subject } from '@/types/database'

interface MaterialImportProps {
    onClose: () => void;
    onSuccess: () => void;
}

// Supported document types for upload
const SUPPORTED_FILE_TYPES = {
    'application/pdf': { label: 'PDF', icon: FileText, color: 'text-rose-400' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'Word', icon: File, color: 'text-blue-400' },
    'application/msword': { label: 'Word (Legacy)', icon: File, color: 'text-blue-400' },
    'application/vnd.oasis.opendocument.text': { label: 'ODT', icon: File, color: 'text-emerald-400' },
    'text/plain': { label: 'Text', icon: FileText, color: 'text-white/60' },
    'text/markdown': { label: 'Markdown', icon: FileText, color: 'text-purple-400' },
    'image/png': { label: 'PNG Image', icon: FileImage, color: 'text-yellow-400' },
    'image/jpeg': { label: 'JPEG Image', icon: FileImage, color: 'text-yellow-400' },
}

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.odt,.txt,.md,.png,.jpg,.jpeg'

type InputMode = 'text' | 'file'

async function extractTextFromFile(file: File): Promise<string> {
    // For plain text and markdown, read directly
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target?.result as string || '')
            reader.onerror = reject
            reader.readAsText(file)
        })
    }

    // For PDF, Word etc — we send to the Gemini File API route
    // For now we return a placeholder instruction that the server action can work with
    // The file is uploaded via FormData to our API route
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/extract-text', { method: 'POST', body: formData })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `Failed to extract text from ${file.name}`)
    }
    const { text } = await res.json()
    return text
}

export default function MaterialImport({ onClose, onSuccess }: MaterialImportProps) {
    const supabase = createClient()
    const [inputMode, setInputMode] = useState<InputMode>('text')
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
    const [subjectSearch, setSubjectSearch] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [uploadedFile, setUploadedFile] = useState<File | null>(null)
    const [isExtracting, setIsExtracting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const fetchSubjects = async () => {
            const { data } = await supabase.from('subjects').select('*')
            if (data) {
                const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
                setSubjects(sorted)
                if (sorted.length > 0) setSelectedSubjectId(sorted[0].id)
            }
        }
        fetchSubjects()
    }, [])

    const filteredSubjects = subjects.filter(s =>
        s.name.toLowerCase().includes(subjectSearch.toLowerCase())
    )

    const handleFileSelect = useCallback(async (file: File) => {
        const isSupported = Object.keys(SUPPORTED_FILE_TYPES).includes(file.type) ||
            ACCEPTED_EXTENSIONS.split(',').some(ext => file.name.toLowerCase().endsWith(ext.replace('*', '')))

        if (!isSupported) {
            setError(`Unsupported file type. Please upload: PDF, Word, ODT, TXT, Markdown, or image.`)
            return
        }

        setUploadedFile(file)
        setError(null)
        setIsExtracting(true)

        try {
            const text = await extractTextFromFile(file)
            setInput(text)
            setInputMode('text') // Switch to text view so user can see/edit extracted content
        } catch (err: any) {
            setError(err.message || 'Failed to read file content.')
        } finally {
            setIsExtracting(false)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFileSelect(file)
    }, [handleFileSelect])

    const handleImport = async () => {
        if (!input.trim()) return
        setError(null)
        setIsProcessing(true)

        try {
            // Check if content is in "Super Baseline" pipe format or free-form text
            const parts = input.split('|').map(p => p.trim())

            let title: string
            let overview: string
            let content: string
            let practiceQuestions: { question: string; answer: string }[] = []

            if (parts.length >= 3) {
                // Structured pipe format
                title = parts[0]
                overview = parts[1]
                content = parts[2]
                const questionsPart = parts[3] || ''
                practiceQuestions = questionsPart ? questionsPart.split(';').map(q => {
                    const [question, answer] = q.split(':').map(s => s.trim())
                    return { question: question || q, answer: answer || 'Explain in your own words' }
                }) : []
            } else {
                // Free-form text (e.g. from a PDF/Word upload)
                // Use the filename as title, first paragraph as overview, rest as content
                const fileName = uploadedFile ? uploadedFile.name.replace(/\.[^/.]+$/, '') : 'Imported Material'
                const lines = input.split('\n').filter(l => l.trim())
                title = lines[0]?.slice(0, 120) || fileName
                overview = lines.slice(1, 3).join(' ').slice(0, 300) || 'Imported document'
                content = input
            }

            // 1. Get user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('You must be logged in to import materials')

            if (!selectedSubjectId) throw new Error('Please select a subject.')

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
            <div className="w-full max-w-5xl max-h-[92vh] bg-[#0f1115] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/40">
                            <Upload className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Import Material</h2>
                            <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mt-1">AI-Powered Ingestion Pipeline</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-2xl hover:bg-white/5 text-white/30 hover:text-white transition-all hover:rotate-90 duration-300"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Body — two-column layout on wide screens */}
                <div className="flex flex-col lg:flex-row overflow-hidden flex-1 min-h-0">

                    {/* LEFT: Subject Picker */}
                    <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col">
                        <div className="p-6 pb-3 shrink-0">
                            <label className="text-xs font-black text-white/40 uppercase tracking-widest block mb-3">Select Subject</label>
                            {/* Search bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                                <input
                                    type="text"
                                    placeholder="Search subjects..."
                                    value={subjectSearch}
                                    onChange={e => setSubjectSearch(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Scrollable subject list */}
                        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2 min-h-0 max-h-[180px] lg:max-h-none">
                            {filteredSubjects.length === 0 && (
                                <p className="text-white/20 text-xs text-center pt-6">No subjects found</p>
                            )}
                            {filteredSubjects.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSubjectId(s.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all duration-200
                                        ${selectedSubjectId === s.id
                                            ? 'bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                                            : 'bg-white/[0.03] border-white/5 hover:bg-white/10 hover:border-white/10'}
                                    `}
                                >
                                    <div className={`p-1.5 rounded-lg bg-gradient-to-br ${s.color} shadow-sm shrink-0`}>
                                        <BookOpen className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <span className={`text-sm font-semibold truncate ${selectedSubjectId === s.id ? 'text-white' : 'text-white/60'}`}>
                                        {s.name}
                                    </span>
                                    {selectedSubjectId === s.id && (
                                        <Check className="h-4 w-4 text-indigo-400 shrink-0 ml-auto" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Input */}
                    <div className="flex-1 p-8 overflow-y-auto space-y-6 min-h-0">

                        {/* Tab switcher */}
                        <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
                            <button
                                onClick={() => setInputMode('text')}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${inputMode === 'text' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-white/40 hover:text-white'}`}
                            >
                                Paste Text
                            </button>
                            <button
                                onClick={() => setInputMode('file')}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${inputMode === 'file' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-white/40 hover:text-white'}`}
                            >
                                Upload File
                            </button>
                        </div>

                        {inputMode === 'file' ? (
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    flex flex-col items-center justify-center gap-4 p-12 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300
                                    ${dragOver ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]' : 'border-white/10 bg-white/[0.02] hover:border-indigo-500/40 hover:bg-white/5'}
                                `}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={ACCEPTED_EXTENSIONS}
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileSelect(file)
                                    }}
                                />
                                {isExtracting ? (
                                    <>
                                        <Loader2 className="h-12 w-12 text-indigo-400 animate-spin" />
                                        <p className="text-white/60 font-semibold">Extracting content...</p>
                                    </>
                                ) : uploadedFile ? (
                                    <>
                                        <div className="p-4 bg-emerald-500/20 rounded-2xl border border-emerald-500/30">
                                            <Check className="h-10 w-10 text-emerald-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-bold text-lg">{uploadedFile.name}</p>
                                            <p className="text-white/40 text-sm mt-1">Content extracted — switch to &quot;Paste Text&quot; to review</p>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); setUploadedFile(null); setInput('') }}
                                            className="text-xs text-white/30 hover:text-rose-400 transition-colors mt-1"
                                        >
                                            Remove file
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                                            <Upload className="h-10 w-10 text-indigo-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-bold text-lg">Drop your file here</p>
                                            <p className="text-white/40 text-sm mt-1">or click to browse</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                                            {(['PDF', 'Word', 'ODT', 'TXT', 'Markdown', 'Image'] as const).map(type => (
                                                <span key={type} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/50 font-medium">
                                                    {type}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Instructions */}
                                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-5 relative overflow-hidden group">
                                    <div className="absolute top-4 right-4 text-indigo-500/20 group-hover:text-indigo-500/40 transition-colors">
                                        <Info className="h-10 w-10" />
                                    </div>
                                    <h3 className="text-indigo-300 font-bold mb-2 flex items-center gap-2 text-sm">
                                        <Plus className="h-4 w-4" />
                                        Super Baseline Format (optional)
                                    </h3>
                                    <p className="text-white/60 text-sm leading-relaxed mb-3">
                                        Structure your material for best AI results, or just paste free-form text:
                                    </p>
                                    <div className="bg-black/40 rounded-xl p-3 font-mono text-xs text-indigo-200 border border-white/5 select-all">
                                        Title | Overview | Content | Q1:A1; Q2:A2
                                    </div>
                                </div>

                                {/* Textarea */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-xs font-black text-white/40 uppercase tracking-widest">Input Data</label>
                                        <span className="text-[10px] text-white/20 font-medium">
                                            {input.length > 0 ? `${input.length.toLocaleString()} characters` : 'Paste or upload a file'}
                                        </span>
                                    </div>
                                    <textarea
                                        placeholder="Paste your study material here, or use the 'Upload File' tab for PDFs, Word documents, and more..."
                                        className="w-full h-56 bg-white/5 border border-white/10 rounded-3xl p-6 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none shadow-inner text-sm leading-relaxed"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
                                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                                <p className="text-rose-200 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
                                <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                                <p className="text-emerald-200 text-sm font-medium">Material imported successfully! AI is sectioning now...</p>
                            </div>
                        )}

                        <CredentialGuard credentialType="gemini" feature="AI Material Sectioning" compact />

                        <button
                            onClick={handleImport}
                            disabled={!input.trim() || isProcessing || success || !selectedSubjectId}
                            className={`
                                w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-500 shadow-2xl flex items-center justify-center gap-3
                                ${input.trim() && !isProcessing && !success && selectedSubjectId
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95'
                                    : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'}
                            `}
                        >
                            {isProcessing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Upload className="h-5 w-5" />
                            )}
                            {isProcessing ? 'Processing with AI...' : 'Import Material'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
