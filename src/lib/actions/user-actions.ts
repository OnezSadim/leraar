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
