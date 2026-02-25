'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CredentialStatus {
    hasGeminiKey: boolean
    hasMagisterCreds: boolean
    hasCalendarCreds: boolean
    isLoading: boolean
}

export function useCredentialCheck(): CredentialStatus {
    const [status, setStatus] = useState<CredentialStatus>({
        hasGeminiKey: false,
        hasMagisterCreds: false,
        hasCalendarCreds: false,
        isLoading: true,
    })

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) {
                setStatus(s => ({ ...s, isLoading: false }))
                return
            }
            const { data } = await supabase
                .from('user_preferences')
                .select('gemini_api_key, magister_url, magister_username, magister_password, google_calendar_credentials')
                .eq('user_id', user.id)
                .single()

            setStatus({
                hasGeminiKey: !!data?.gemini_api_key,
                hasMagisterCreds: !!(data?.magister_url && data?.magister_username && data?.magister_password),
                hasCalendarCreds: !!(data?.google_calendar_credentials as any)?.refresh_token,
                isLoading: false,
            })
        })
    }, [])

    return status
}
