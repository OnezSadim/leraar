'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Sparkles,
    ArrowLeft,
    Send,
    Calendar as CalendarIcon,
    BrainCircuit,
    Loader2,
    Settings2
} from 'lucide-react'
import Link from 'next/link'
import { chatWithSchedulingAssistant } from '@/lib/actions/scheduling-actions'
import CredentialGuard from '@/components/CredentialGuard'

interface Message {
    role: 'assistant' | 'user'
    content: string
    toolsUsed?: string[]
}

export default function AssistantPage() {
    const router = useRouter()
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Hey! I'm your personal study assistant. I can help you plan study sessions, manage your schedule, and keep you on track. What would you like to work on?"
        }
    ])
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        // Auto-focus input on mount
        inputRef.current?.focus()
    }, [])

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return

        const userMessage = input.trim()
        const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
        setMessages(newMessages)
        setInput('')
        setIsProcessing(true)

        try {
            const currentTime = new Date().toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            })

            const response = await chatWithSchedulingAssistant(
                newMessages.map(m => ({ role: m.role, content: m.content })),
                currentTime
            )

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.content,
                toolsUsed: response.toolsUsed
            }])
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I'm having trouble connecting right now. Please try again in a moment."
            }])
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#09090c] flex flex-col">
            {/* Background glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/15 blur-[140px] rounded-full" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="relative z-10 border-b border-white/5 bg-[#09090c]/80 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all group flex items-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                            <span className="text-sm font-medium hidden sm:block">Back</span>
                        </button>
                        <div className="h-5 w-px bg-white/10" />
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/30">
                                <BrainCircuit className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-sm font-black text-white tracking-tight">Talk with Assistant</h1>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">AI Online</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Link
                        href="/settings#gemini"
                        className="p-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all"
                        title="AI Settings"
                    >
                        <Settings2 className="h-4 w-4" />
                    </Link>
                </div>
            </header>

            {/* Credential guard — full-width banner if no key */}
            <div className="relative z-10 max-w-3xl mx-auto w-full px-6 pt-4">
                <CredentialGuard credentialType="gemini" feature="Talk with Assistant" compact />
            </div>

            {/* Messages */}
            <main className="flex-1 overflow-y-auto relative z-10">
                <div className="max-w-3xl mx-auto px-6 py-6 space-y-6 pb-8">
                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={`flex gap-4 animate-in slide-in-from-bottom-2 duration-300 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {m.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1">
                                    <BrainCircuit className="h-4 w-4 text-indigo-400" />
                                </div>
                            )}
                            <div className={`
                                max-w-[75%] px-5 py-4 rounded-3xl text-sm leading-relaxed
                                ${m.role === 'user'
                                    ? 'bg-indigo-500 text-white rounded-tr-lg shadow-xl shadow-indigo-500/20'
                                    : 'bg-white/5 border border-white/8 text-white/85 rounded-tl-lg'}
                            `}>
                                <p className="whitespace-pre-wrap">{m.content}</p>
                                {m.role === 'assistant' && m.toolsUsed && m.toolsUsed.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-white/8">
                                        {m.toolsUsed.map((tool, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold uppercase tracking-wider text-indigo-300/80">
                                                {tool === 'schedule_session' ? (
                                                    <CalendarIcon className="h-3 w-3" />
                                                ) : (
                                                    <Sparkles className="h-3 w-3" />
                                                )}
                                                {tool.split('_').join(' ')}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {m.role === 'user' && (
                                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-1 text-xs font-black text-white/60">
                                    You
                                </div>
                            )}
                        </div>
                    ))}

                    {isProcessing && (
                        <div className="flex gap-4 justify-start animate-in fade-in">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                <BrainCircuit className="h-4 w-4 text-indigo-400" />
                            </div>
                            <div className="bg-white/5 border border-white/8 px-5 py-4 rounded-3xl rounded-tl-lg flex gap-1.5 items-center">
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input bar — sticky at bottom */}
            <footer className="relative z-10 border-t border-white/5 bg-[#09090c]/90 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <div className="flex gap-3 items-end">
                        <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-500/30 transition-all">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Ask me anything about your study schedule…"
                                className="w-full bg-transparent px-5 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isProcessing}
                            className="p-4 bg-indigo-500 hover:bg-indigo-400 disabled:bg-white/8 disabled:text-white/20 text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Send className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                    <p className="mt-2 text-[10px] text-white/15 text-center font-medium">
                        Press Enter to send · The assistant learns your schedule preferences as you chat
                    </p>
                </div>
            </footer>
        </div>
    )
}
