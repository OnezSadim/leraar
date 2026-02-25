'use client'

import { useState, useRef, useEffect } from 'react'
import {
    Sparkles,
    X,
    Send,
    Calendar as CalendarIcon,
    BrainCircuit,
    Loader2
} from 'lucide-react'
import { chatWithSchedulingAssistant } from '@/lib/actions/scheduling-actions'
import CredentialGuard from './CredentialGuard'

interface Message {
    role: 'assistant' | 'user';
    content: string;
    toolsUsed?: string[];
}

export default function SchedulingAssistant({ onClose, queueItemId }: { onClose: () => void, queueItemId?: string }) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Hey, do you want to plan when to learn this? I've seen it takes about 2 hours to master."
        }
    ])
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMessage = input.trim()
        const newMessages = [...messages, { role: 'user' as const, content: userMessage }]

        setMessages(newMessages)
        setInput('')
        setIsProcessing(true)

        try {
            // Get current browser time in a readable format
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
                currentTime,
                queueItemId
            )

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.content,
                toolsUsed: response.toolsUsed
            }])
        } catch (error) {
            console.error('Error chatting with assistant:', error)
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Please try again." }])
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-[#121216] border border-white/10 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-h-[80vh] animate-in zoom-in-95 duration-300"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                            <BrainCircuit className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Scheduling Assistant</h2>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Active Planning</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Credential Check */}
                <div className="px-6 pt-4">
                    <CredentialGuard credentialType="gemini" feature="AI Scheduling Assistant" compact />
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                        >
                            <div className={`
                max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed relative group
                ${m.role === 'user'
                                    ? 'bg-indigo-500 text-white rounded-tr-none shadow-lg shadow-indigo-500/20'
                                    : 'bg-white/5 text-white/80 border border-white/10 rounded-tl-none'}
              `}>
                                {m.content}

                                {m.role === 'assistant' && m.toolsUsed && m.toolsUsed.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                        {m.toolsUsed.map((tool, index) => (
                                            <div key={index} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold uppercase tracking-wider text-indigo-300/80">
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
                        </div>
                    ))}
                    {isProcessing && (
                        <div className="flex justify-start animate-in fade-in">
                            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none flex gap-1">
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 border-t border-white/5 bg-white/5">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="e.g. I'm available tonight at 8"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isProcessing}
                            className="p-3 bg-indigo-500 hover:bg-indigo-400 disabled:bg-white/10 disabled:text-white/20 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="mt-3 text-[10px] text-white/20 text-center font-medium">
                        I'll learn your preferences and schedule as we chat.
                    </p>
                </div>
            </div>
        </div>
    )
}
