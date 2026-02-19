'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getWhatsAppStatus() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
        .from('whatsapp_connection')
        .select('*')
        .eq('user_id', user.id)
        .single()

    return data
}

export async function startWhatsAppConnection() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Set status to connecting
    await supabase
        .from('whatsapp_connection')
        .upsert({
            user_id: user.id,
            status: 'connecting',
            updated_at: new Date().toISOString()
        })

    // In a real scenario, we would trigger a background process or a webhook
    // to the dedicated whatsapp service. For this demo, we'll assume the service
    // is running and will update the status/qr_code when ready.

    revalidatePath('/settings')
    return { success: true }
}

export async function disconnectWhatsApp() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('whatsapp_connection')
        .update({
            status: 'disconnected',
            qr_code: null,
            session_data: null,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/settings')
    return { success: true }
}
