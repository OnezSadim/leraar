'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getUserPreferences() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

    return data
}

export async function updateGeminiApiKey(apiKey: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('user_preferences')
        .upsert({
            user_id: user.id,
            gemini_api_key: apiKey,
            updated_at: new Date().toISOString()
        })

    if (error) throw error

    revalidatePath('/dashboard')
    return { success: true }
}

export async function deleteGeminiApiKey() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('user_preferences')
        .update({
            gemini_api_key: null,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/dashboard')
    return { success: true }
}

export async function updateMagisterCredentials(creds: { url?: string, username?: string, password?: string }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('user_preferences')
        .upsert({
            user_id: user.id,
            magister_url: creds.url,
            magister_username: creds.username,
            magister_password: creds.password,
            updated_at: new Date().toISOString()
        })

    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath('/settings')
    return { success: true }
}

export async function updateGoogleCalendarCredentials(creds: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('user_preferences')
        .upsert({
            user_id: user.id,
            google_calendar_credentials: creds,
            updated_at: new Date().toISOString()
        })

    if (error) throw error

    revalidatePath('/settings')
    return { success: true }
}

export async function updateLanguage(language: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('user_preferences')
        .upsert({
            user_id: user.id,
            language: language,
            updated_at: new Date().toISOString()
        })

    if (error) throw error

    revalidatePath('/settings')
    revalidatePath('/dashboard')
    return { success: true }
}
