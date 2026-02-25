'use client'

import { useState, useEffect } from 'react'
import { Key, ShieldCheck, ShieldAlert, Loader2, Save, Trash2, CheckCircle2, AlertCircle, Globe, User, Lock, Calendar, Languages } from 'lucide-react'
import { getUserPreferences, updateGeminiApiKey, deleteGeminiApiKey, updateMagisterCredentials, updateGoogleCalendarCredentials, updateLanguage } from '@/lib/actions/user-actions'

export default function CredentialsSettings() {
    // Gemini State
    const [apiKey, setApiKey] = useState('')
    const [isSavingGemini, setIsSavingGemini] = useState(false)
    const [isDeletingGemini, setIsDeletingGemini] = useState(false)
    const [geminiStatus, setGeminiStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [geminiMessage, setGeminiMessage] = useState('')
    const [existingKey, setExistingKey] = useState<boolean>(false)
    const [showKey, setShowKey] = useState(false)

    // Magister State
    const [magisterUrl, setMagisterUrl] = useState('')
    const [magisterUsername, setMagisterUsername] = useState('')
    const [magisterPassword, setMagisterPassword] = useState('')
    const [isSavingMagister, setIsSavingMagister] = useState(false)
    const [magisterStatus, setMagisterStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [magisterMessage, setMagisterMessage] = useState('')
    const [existingMagister, setExistingMagister] = useState(false)

    // Google Calendar State
    const [calendarCreds, setCalendarCreds] = useState('')
    const [isSavingCalendar, setIsSavingCalendar] = useState(false)
    const [calendarStatus, setCalendarStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [calendarMessage, setCalendarMessage] = useState('')
    const [existingCalendar, setExistingCalendar] = useState(false)

    // Language State
    const [language, setLanguage] = useState('en')
    const [isSavingLanguage, setIsSavingLanguage] = useState(false)

    useEffect(() => {
        fetchPrefs()
    }, [])

    async function fetchPrefs() {
        const prefs = await getUserPreferences()
        if (prefs?.gemini_api_key) {
            setExistingKey(true)
            setApiKey(prefs.gemini_api_key)
        }
        if (prefs?.magister_url) {
            setMagisterUrl(prefs.magister_url)
            setExistingMagister(true)
        }
        if (prefs?.magister_username) setMagisterUsername(prefs.magister_username)
        if (prefs?.magister_password) setMagisterPassword(prefs.magister_password)
        if (prefs?.google_calendar_credentials) {
            setCalendarCreds(JSON.stringify(prefs.google_calendar_credentials, null, 2))
            setExistingCalendar(Object.keys(prefs.google_calendar_credentials).length > 0)
        }
        if (prefs?.language) setLanguage(prefs.language)
    }

    const handleSaveGemini = async () => {
        if (!apiKey) return
        setIsSavingGemini(true)
        setGeminiStatus('idle')
        setGeminiMessage('')

        try {
            await updateGeminiApiKey(apiKey)
            setGeminiStatus('success')
            setGeminiMessage('API Key saved successfully!')
            setExistingKey(true)
            setTimeout(() => setGeminiStatus('idle'), 3000)
        } catch (error: any) {
            setGeminiStatus('error')
            setGeminiMessage(error.message || 'Failed to save API key')
        } finally {
            setIsSavingGemini(false)
        }
    }

    const handleDeleteGemini = async () => {
        if (!confirm('Are you sure you want to remove your API key? This will fall back to the system default.')) return
        setIsDeletingGemini(true)
        try {
            await deleteGeminiApiKey()
            setApiKey('')
            setExistingKey(false)
            setGeminiStatus('success')
            setGeminiMessage('API Key removed.')
            setTimeout(() => setGeminiStatus('idle'), 3000)
        } catch (error: any) {
            setGeminiStatus('error')
            setGeminiMessage(error.message || 'Failed to remove API key')
        } finally {
            setIsDeletingGemini(false)
        }
    }

    const handleSaveMagister = async () => {
        if (!magisterUrl || !magisterUsername || !magisterPassword) return
        setIsSavingMagister(true)
        setMagisterStatus('idle')
        setMagisterMessage('')

        try {
            await updateMagisterCredentials({
                url: magisterUrl,
                username: magisterUsername,
                password: magisterPassword
            })
            setMagisterStatus('success')
            setMagisterMessage('Magister credentials saved!')
            setExistingMagister(true)
            setTimeout(() => setMagisterStatus('idle'), 3000)
        } catch (error: any) {
            setMagisterStatus('error')
            setMagisterMessage(error.message || 'Failed to save credentials')
        } finally {
            setIsSavingMagister(false)
        }
    }

    const handleSaveCalendar = async () => {
        if (!calendarCreds) return
        setIsSavingCalendar(true)
        setCalendarStatus('idle')
        setCalendarMessage('')

        try {
            const parsed = JSON.parse(calendarCreds)
            await updateGoogleCalendarCredentials(parsed)
            setCalendarStatus('success')
            setCalendarMessage('Calendar credentials saved!')
            setExistingCalendar(true)
            setTimeout(() => setCalendarStatus('idle'), 3000)
        } catch (error: any) {
            setCalendarStatus('error')
            setCalendarMessage(error.message || 'Invalid JSON format')
        } finally {
            setIsSavingCalendar(false)
        }
    }

    const handleLanguageChange = async (newLang: string) => {
        setLanguage(newLang)
        setIsSavingLanguage(true)
        try {
            await updateLanguage(newLang)
        } catch (error) {
            console.error('Failed to update language:', error)
        } finally {
            setIsSavingLanguage(false)
        }
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Gemini Section */}
                <section id="gemini" className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group scroll-mt-24">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Key className="h-5 w-5 text-indigo-300" />
                                AI Credentials
                            </h2>
                            <p className="text-white/40 text-xs mt-1">Manage your Google Gemini API key.</p>
                        </div>
                        {existingKey ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                                <ShieldAlert className="h-3 w-3 text-amber-400" />
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Default</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 block ml-1">
                                Gemini API Key
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

                        {geminiStatus !== 'idle' && (
                            <div className={`p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${geminiStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                {geminiStatus === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <span className="text-xs font-medium">{geminiMessage}</span>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveGemini}
                                disabled={isSavingGemini || !apiKey}
                                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 ${geminiStatus === 'success'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                                    }`}
                            >
                                {isSavingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {isSavingGemini ? 'Saving...' : 'Save Gemini Key'}
                            </button>

                            {existingKey && (
                                <button
                                    onClick={handleDeleteGemini}
                                    disabled={isDeletingGemini}
                                    className="px-4 py-3.5 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/40 text-white/40 hover:text-red-400 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isDeletingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* Magister Section */}
                <section id="magister" className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group scroll-mt-24">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-purple-500/10 transition-colors" />

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Globe className="h-5 w-5 text-purple-300" />
                                Magister Login
                            </h2>
                            <p className="text-white/40 text-xs mt-1">Connect your Magister account to sync data.</p>
                        </div>
                        {existingMagister && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Linked</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 block ml-1">School URL</label>
                            <div className="relative">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                                <input
                                    type="text"
                                    placeholder="xxx.magister.net"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all text-sm"
                                    value={magisterUrl}
                                    onChange={(e) => setMagisterUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 block ml-1">Username</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all text-sm"
                                        value={magisterUsername}
                                        onChange={(e) => setMagisterUsername(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 block ml-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all text-sm"
                                        value={magisterPassword}
                                        onChange={(e) => setMagisterPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {magisterStatus !== 'idle' && (
                            <div className={`p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${magisterStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                {magisterStatus === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <span className="text-xs font-medium">{magisterMessage}</span>
                            </div>
                        )}

                        <button
                            onClick={handleSaveMagister}
                            disabled={isSavingMagister || !magisterUrl || !magisterUsername || !magisterPassword}
                            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 ${magisterStatus === 'success'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-purple-500 hover:bg-purple-400 text-white shadow-lg shadow-purple-500/20'
                                }`}
                        >
                            {isSavingMagister ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSavingMagister ? 'Saving...' : 'Save Magister Logic'}
                        </button>
                    </div>
                </section>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Google Calendar Section */}
                <section id="calendar" className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group scroll-mt-24">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/10 transition-colors" />

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-blue-300" />
                                Google Calendar
                            </h2>
                            <p className="text-white/40 text-xs mt-1">Sync your study sessions with Google Calendar.</p>
                        </div>
                        {existingCalendar && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Connected</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 block ml-1">JSON Credentials</label>
                            <textarea
                                placeholder='{ "client_id": "...", "client_secret": "..." }'
                                className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-mono text-xs resize-none"
                                value={calendarCreds}
                                onChange={(e) => setCalendarCreds(e.target.value)}
                            />
                        </div>

                        {calendarStatus !== 'idle' && (
                            <div className={`p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${calendarStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                {calendarStatus === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <span className="text-xs font-medium">{calendarMessage}</span>
                            </div>
                        )}

                        <button
                            onClick={handleSaveCalendar}
                            disabled={isSavingCalendar || !calendarCreds}
                            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 ${calendarStatus === 'success'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20'
                                }`}
                        >
                            {isSavingCalendar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSavingCalendar ? 'Saving...' : 'Save Calendar Config'}
                        </button>
                    </div>
                </section>

                {/* General Settings Section */}
                <section className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-colors" />

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Languages className="h-5 w-5 text-emerald-300" />
                                Interface Settings
                            </h2>
                            <p className="text-white/40 text-xs mt-1">Personalize your learning experience.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 block ml-1">Preferred Language</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'en', label: 'English', flag: '🇺🇸' },
                                    { id: 'nl', label: 'Nederlands', flag: '🇳🇱' }
                                ].map((lang) => (
                                    <button
                                        key={lang.id}
                                        onClick={() => handleLanguageChange(lang.id)}
                                        className={`
                                            flex items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all
                                            ${language === lang.id
                                                ? 'bg-emerald-500/20 border-emerald-500/40 text-white'
                                                : 'bg-black/40 border-white/5 text-white/40 hover:bg-white/5 hover:border-white/10'}
                                        `}
                                    >
                                        <span className="text-lg">{lang.flag}</span>
                                        <span className="text-sm font-bold">{lang.label}</span>
                                        {isSavingLanguage && language === lang.id && (
                                            <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                            <p className="text-[10px] text-amber-200/50 leading-relaxed italic">
                                Note: Changing the language will update the UI and AI default response language. Some study materials may remain in their original language.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
