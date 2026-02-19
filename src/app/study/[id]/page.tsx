import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import StudySession from '@/components/StudySession'

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { id } = await params

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    // Try fetching as a single material first
    const { data: material } = await supabase
        .from('materials')
        .select('*')
        .eq('id', id)
        .single()

    if (material) {
        return <StudySession initialData={material} isGroup={false} />
    }

    // If not found, try fetching as a material group
    const { data: group } = await supabase
        .from('material_groups')
        .select(`
      *,
      materials:material_group_items(
        material:materials(*)
      )
    `)
        .eq('id', id)
        .single()

    if (group) {
        const formattedGroup = {
            ...group,
            materials: group.materials.map((m: any) => m.material)
        }
        return <StudySession initialData={formattedGroup} isGroup={true} />
    }

    return notFound()
}
