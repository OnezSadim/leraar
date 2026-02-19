'use server'

import { createClient } from '@/lib/supabase/server'

export async function searchGlobalMaterials(query: string) {
    const supabase = await createClient()

    // Search in materials table (title and overview)
    const { data: materials, error: matError } = await supabase
        .from('materials')
        .select('*, subjects(name, color)')
        .or(`title.ilike.%${query}%,overview.ilike.%${query}%`)
        .limit(10)

    if (matError) {
        console.error("Error searching materials:", matError)
        return { materials: [], groups: [] }
    }

    // Search in groups (shared materials typically live here)
    const { data: groups, error: grpError } = await supabase
        .from('material_groups')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(5)

    if (grpError) {
        console.error("Error searching groups:", grpError)
    }

    return {
        materials: materials || [],
        groups: groups || []
    }
}

export async function importMaterialToUser(materialId: string, groupId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // If a groupId is provided, ensure user is subscribed to it
    if (groupId) {
        const { error: subError } = await supabase
            .from('group_subscriptions')
            .upsert({ user_id: user.id, group_id: groupId })

        if (subError) throw subError
    }

    // In this architecture, "importing" just means creating a session 
    // or ensuring it appears in their "active" list if we add a user_materials table later.
    // For now, we'll create an empty study session to mark it as 'active' for them.
    const { error: sessionError } = await supabase
        .from('study_sessions')
        .upsert({
            user_id: user.id,
            material_id: materialId,
            last_active: new Date().toISOString()
        }, { onConflict: 'user_id,material_id' })

    if (sessionError) throw sessionError

    return { success: true }
}
