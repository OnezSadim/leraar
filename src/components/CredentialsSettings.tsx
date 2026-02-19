'use client'

import { useState, useEffect } from 'react'
import { Key, ShieldCheck, ShieldAlert, Loader2, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getUserPreferences, updateGeminiApiKey, deleteGeminiApiKey } from '@/lib/actions/user-actions'

export default function CredentialsSettings() {
    const [apiKey, setApiKey] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')
    const [existingKey, setExistingKey] = useState<boolean>(false)
    const [showKey, setShowKey] = useState(false)

    useEffect(() => {
        fetchPrefs()
    }, [])

    async function fetchPrefs() {
        const prefs = await getUserPreferences()
        if (prefs?.gemini_api_key) {
            setExistingKey(true)
            setApiKey(prefs.gemini_api_key)
        }
    }

    const handleSave = async () => {
        if (!apiKey) return
        setIsSaving(true)
        setStatus('idle')
        setMessage('')

        try {
            await updateGeminiApiKey(apiKey)
            setStatus('success')
            setMessage('API Key saved successfully!')
            setExistingKey(true)
            setTimeout(() => setStatus('idle'), 3000)
        } catch (error: any) {
            setStatus('error')
            setMessage(error.message || 'Failed to save API key')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to remove your API key? This will fall back to the system default.')) return
        setIsDeleting(true)
        try {
            await deleteGeminiApiKey()
            setApiKey('')
            setExistingKey(false)
            setStatus('success')
            setMessage('API Key removed.')
            setTimeout(() => setStatus('idle'), 3000)
        } catch (error: any) {
            setStatus('error')
            setMessage(error.message || 'Failed to remove API key')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Key className="h-5 w-5 text-indigo-300" />
                        AI Credentials
                    </h2>
                    <p className="text-white/40 text-xs mt-1">Manage your private Google Gemini API key securely.</p>
                </div>
                {existingKey ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                        <ShieldAlert className="h-3 w-3 text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Using Default</span>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="relative">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 block ml-1">
                        Google Gemini API Key
                    </label>
                    <div className="relative group/input">
                        <input
                            type={showKey ? 'text' : 'password'}
                            placeholder={existingKey ? '••••••••••••••••••••••••••••' : 'Enter your AIStudio API Key'}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-mono text-sm"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <button
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors text-[10px] font-bold uppercase"
                        >
                            {showKey ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </div>

                {status !== 'idle' && (
                    <div className={`p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                        {status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span className="text-xs font-medium">{message}</span>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !apiKey}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 ${status === 'success'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                            }`}
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isSaving ? 'Saving...' : 'Save Credential'}
                    </button>

                    {existingKey && (
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="px-4 py-3.5 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/40 text-white/40 hover:text-red-400 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                    )}
                </div>

                <p className="text-[10px] text-white/20 leading-relaxed px-1 italic">
                    Note: Your key is stored in your private user profile and is only used to power your AI sessions.
                    If no key is provided, the platform's default shared key will be used (subject to rate limits).
                </p>
            </div>
        </section>
    )
}
