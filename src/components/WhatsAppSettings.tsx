'use client'

import { useState, useEffect } from 'react'
import { getWhatsAppStatus, startWhatsAppConnection, disconnectWhatsApp } from '@/lib/actions/whatsapp-actions'
import { Loader2, QrCode, MessageSquare, CheckCircle, XCircle } from 'lucide-react'

export function WhatsAppSettings() {
    const [status, setStatus] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 5000) // Poll for updates
        return () => clearInterval(interval)
    }, [])

    async function fetchStatus() {
        try {
            const data = await getWhatsAppStatus()
            setStatus(data)
        } catch (err) {
            console.error('Failed to fetch WhatsApp status:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleConnect() {
        setActionLoading(true)
        try {
            await startWhatsAppConnection()
            await fetchStatus()
        } catch (err) {
            alert('Failed to start connection')
        } finally {
            setActionLoading(false)
        }
    }

    async function handleDisconnect() {
        if (!confirm('Are you sure you want to disconnect WhatsApp?')) return
        setActionLoading(true)
        try {
            await disconnectWhatsApp()
            await fetchStatus()
        } catch (err) {
            alert('Failed to disconnect')
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )

    return (
        <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">WhatsApp Connection</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications and chat with your AI assistant.</p>
                    </div>
                </div>
                <div>
                    {!status || status.status === 'disconnected' ? (
                        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">Disconnected</span>
                    ) : status.status === 'connecting' ? (
                        <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-600 text-xs font-medium animate-pulse">Connecting...</span>
                    ) : (
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-600 text-xs font-medium">Connected</span>
                    )}
                </div>
            </div>

            {(!status || status.status === 'disconnected') && (
                <div className="pt-2">
                    <button
                        onClick={handleConnect}
                        disabled={actionLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                        Connect WhatsApp
                    </button>
                </div>
            )}

            {status?.status === 'connecting' && (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl space-y-4">
                    {status.qr_code ? (
                        <>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Scan this QR code with WhatsApp</p>
                            <div className="p-4 bg-white rounded-lg shadow-inner">
                                <img src={status.qr_code} alt="WhatsApp QR Code" className="w-48 h-48" />
                            </div>
                            <p className="text-xs text-gray-500 text-center max-w-[200px]">
                                Go to Settings {'>'} Linked Devices on your phone to scan.
                            </p>
                        </>
                    ) : (
                        <>
                            <Loader2 className="w-10 h-10 animate-spin text-green-500" />
                            <p className="text-sm text-gray-500">Generating QR Code...</p>
                        </>
                    )}
                </div>
            )}

            {status?.status === 'connected' && (
                <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg flex items-start gap-3 border border-green-100 dark:border-green-900/20">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">Successfully Connected</p>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                Your bot is now connected to {status.phone_number}. You can now receive study reminders directly on WhatsApp.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleDisconnect}
                        disabled={actionLoading}
                        className="w-full border border-red-200 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Disconnect WhatsApp
                    </button>
                </div>
            )}
        </div>
    )
}
