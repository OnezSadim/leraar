'use client'

import Link from 'next/link'
import { ShieldAlert, ArrowRight, Loader2 } from 'lucide-react'
import { useCredentialCheck } from '@/hooks/useCredentialCheck'

export type CredentialType = 'gemini' | 'magister' | 'calendar'

const CREDENTIAL_CONFIG: Record<CredentialType, {
    label: string
    description: string
    settingsHash: string
    accentColor: string
}> = {
    gemini: {
        label: 'Gemini AI Key',
        description: 'This feature requires a Google Gemini API key to generate AI content.',
        settingsHash: '#gemini',
        accentColor: 'amber',
    },
    magister: {
        label: 'Magister Credentials',
        description: 'This feature requires your Magister school login to be configured.',
        settingsHash: '#magister',
        accentColor: 'purple',
    },
    calendar: {
        label: 'Google Calendar',
        description: 'This feature requires your Google Calendar to be connected.',
        settingsHash: '#calendar',
        accentColor: 'blue',
    },
}

const ACCENT_CLASSES: Record<string, { bg: string; border: string; text: string; btn: string }> = {
    amber: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/25',
        text: 'text-amber-300',
        btn: 'bg-amber-500 hover:bg-amber-400',
    },
    purple: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/25',
        text: 'text-purple-300',
        btn: 'bg-purple-500 hover:bg-purple-400',
    },
    blue: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/25',
        text: 'text-blue-300',
        btn: 'bg-blue-500 hover:bg-blue-400',
    },
}

interface CredentialGuardProps {
    credentialType: CredentialType
    feature: string
    /** If true, renders children if credential is present; renders guard banner otherwise */
    blockChildren?: boolean
    children?: React.ReactNode
    /** If true, renders as a compact inline badge instead of a full banner */
    compact?: boolean
}

/**
 * Checks whether the required credential is present.
 * - When `blockChildren` is true: renders children if credential is OK, otherwise shows the guard banner.
 * - When `blockChildren` is false (default): always renders children AND shows the banner on top if missing.
 * - The `compact` prop renders a small pill-style alert instead of the full card.
 */
export default function CredentialGuard({
    credentialType,
    feature,
    blockChildren = false,
    children,
    compact = false,
}: CredentialGuardProps) {
    const creds = useCredentialCheck()
    const config = CREDENTIAL_CONFIG[credentialType]
    const accent = ACCENT_CLASSES[config.accentColor]

    const isMissing =
        credentialType === 'gemini' ? !creds.hasGeminiKey :
            credentialType === 'magister' ? !creds.hasMagisterCreds :
                !creds.hasCalendarCreds

    if (creds.isLoading) {
        if (blockChildren) {
            return (
                <div className="flex items-center justify-center py-8 text-white/30 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Checking credentials…</span>
                </div>
            )
        }
        return <>{children}</>
    }

    if (!isMissing) {
        return <>{children}</>
    }

    const banner = compact ? (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${accent.bg} ${accent.border} animate-in fade-in duration-300`}>
            <ShieldAlert className={`h-4 w-4 shrink-0 ${accent.text}`} />
            <p className={`text-xs font-semibold ${accent.text} flex-1`}>
                {feature} requires your <strong>{config.label}</strong> to be configured.
            </p>
            <Link
                href={`/settings${config.settingsHash}`}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg ${accent.btn} text-white text-[11px] font-black uppercase tracking-wider transition-all`}
            >
                Configure <ArrowRight className="h-3 w-3" />
            </Link>
        </div>
    ) : (
        <div className={`rounded-3xl border p-5 ${accent.bg} ${accent.border} animate-in slide-in-from-top-2 duration-300`}>
            <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-2xl ${accent.bg} border ${accent.border} shrink-0`}>
                    <ShieldAlert className={`h-6 w-6 ${accent.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className={`font-black text-sm uppercase tracking-wider mb-1 ${accent.text}`}>
                        Credential Required
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed">
                        <strong className="text-white/80">{feature}</strong> — {config.description}
                    </p>
                </div>
            </div>
            <Link
                href={`/settings${config.settingsHash}`}
                className={`mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-2xl ${accent.btn} text-white font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-95 shadow-lg`}
            >
                Configure {config.label} in Settings <ArrowRight className="h-4 w-4" />
            </Link>
        </div>
    )

    if (blockChildren) {
        return banner
    }

    return (
        <>
            {banner}
            {children}
        </>
    )
}
