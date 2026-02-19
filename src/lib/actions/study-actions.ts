'use server'

import { createClient } from '@/lib/supabase/server'
import {
    generateLearningBlocks,
    LearningBlock,
    gradeOpenAnswer,
    preprocessMaterial,
    SectionedMaterial
} from '@/lib/ai'

export async function getSessionState(userId: string, materialId: string) {
    const supabase = await createClient()
    const { data: session } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('material_id', materialId)
        .single()

    const { data: progress } = await supabase
        .from('user_progress')
        .select('concept, mastery_level')
        .eq('user_id', userId)
        .eq('material_id', materialId)

    const knowledgeMap: Record<string, string> = {}
    progress?.forEach(p => {
        knowledgeMap[p.concept] = p.mastery_level
    })

    return { session, knowledgeMap }
}

export async function getInitialAIBlocks(
    materialId: string,
    materialTitle: string,
    userKnowledge: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { session, knowledgeMap } = await getSessionState(user.id, materialId)

    const { data: sections } = await supabase
        .from('material_sections')
        .select('id, title, estimated_time_seconds')
        .eq('material_id', materialId)
        .order('order_index')

    const sectionsRemaining = sections?.map(s => ({
        id: s.id,
        title: s.title,
        estimatedSeconds: s.estimated_time_seconds
    })) || []

    const startTime = session?.start_time || new Date().toISOString()
    const predictionsHistory = session?.predictions_history || []

    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('gemini_api_key')
        .eq('user_id', user.id)
        .single()

    const blocks = await generateLearningBlocks(materialTitle, knowledgeMap, {
        sectionsRemaining,
        predictionsHistory,
        startTime
    }, [], userKnowledge, prefs?.gemini_api_key)

    // Ensure session exists
    if (!session) {
        await supabase.from('study_sessions').insert({
            user_id: user.id,
            material_id: materialId,
            start_time: startTime,
            predictions_history: []
        })
    }

    return blocks
}

export async function getNextAIBlocks(
    materialId: string,
    materialTitle: string,
    history: LearningBlock[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { session, knowledgeMap } = await getSessionState(user.id, materialId)

    const { data: sections } = await supabase
        .from('material_sections')
        .select('id, title, estimated_time_seconds')
        .eq('material_id', materialId)
        .order('order_index')

    const sectionsRemaining = sections?.map(s => ({
        id: s.id,
        title: s.title,
        estimatedSeconds: s.estimated_time_seconds
    })) || []

    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('gemini_api_key')
        .eq('user_id', user.id)
        .single()

    const blocks = await generateLearningBlocks(materialTitle, knowledgeMap, {
        lastSectionId: session?.current_section_id,
        sectionsRemaining,
        predictionsHistory: session?.predictions_history || [],
        startTime: session?.start_time || new Date().toISOString()
    }, history.slice(-5), undefined, prefs?.gemini_api_key)

    // Handle time prediction persistence
    const latestTimeBlock = [...blocks].reverse().find(b => b.timeEstimateRemaining);
    if (latestTimeBlock && latestTimeBlock.timeEstimateRemaining) {
        const [mins, secs] = latestTimeBlock.timeEstimateRemaining.split(':').map(Number);
        const totalSecs = (mins || 0) * 60 + (secs || 0);

        const newPrediction = {
            timestamp: new Date().toISOString(),
            predictedRemainingSeconds: totalSecs
        }

        await supabase.from('study_sessions').update({
            predictions_history: [...(session?.predictions_history || []), newPrediction],
            last_active: new Date().toISOString()
        }).eq('user_id', user.id).eq('material_id', materialId)
    }

    return blocks
}

export async function submitOpenAnswer(
    materialId: string,
    questionText: string,
    rubric: string,
    userAnswer: string,
    concepts: string[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('gemini_api_key')
        .eq('user_id', user.id)
        .single()

    const result = await gradeOpenAnswer(questionText, rubric, userAnswer, prefs?.gemini_api_key)

    if (result.isCorrect) {
        // Update progress for all concepts in this question
        for (const concept of concepts) {
            await supabase.from('user_progress').upsert({
                user_id: user.id,
                material_id: materialId,
                concept,
                mastery_level: 'mastered',
                last_updated: new Date().toISOString()
            }, { onConflict: 'user_id,material_id,concept' })
        }
    }

    return result
}

export async function loadSectionData(sectionId: string, materialId?: string) {
    const supabase = await createClient()
    const { data: section } = await supabase
        .from('material_sections')
        .select('*')
        .eq('id', sectionId)
        .single()

    if (section && materialId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            await supabase
                .from('study_sessions')
                .update({
                    current_section_id: sectionId,
                    last_active: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .eq('material_id', materialId)
        }
    }

    return section
}

export async function processMaterialAction(materialId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 1. Get material details
    const { data: material } = await supabase
        .from('materials')
        .select('*')
        .eq('id', materialId)
        .single()

    if (!material) throw new Error('Material not found')

    // 2. Get API key
    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('gemini_api_key')
        .eq('user_id', user.id)
        .single()

    // 3. Preprocess
    const sectioned = await preprocessMaterial(
        material.title,
        material.content,
        prefs?.gemini_api_key,
        material.practice_questions || []
    )

    // 4. Save sections and questions
    for (let i = 0; i < sectioned.sections.length; i++) {
        const s = sectioned.sections[i]
        const { data: section, error: secError } = await supabase
            .from('material_sections')
            .insert({
                material_id: materialId,
                title: s.title,
                content: s.content,
                concepts_covered: s.concepts,
                estimated_time_seconds: s.estimatedTimeSeconds,
                order_index: i
            })
            .select()
            .single()

        if (secError) {
            console.error("Error saving section:", secError)
            continue
        }

        if (s.questions && s.questions.length > 0) {
            const questions = s.questions.map(q => ({
                section_id: section.id,
                question_type: q.type,
                question_text: q.text,
                options: q.options || [],
                correct_answer: q.answer,
                concepts_tested: q.concepts || []
            }))

            await supabase.from('section_questions').insert(questions)
        }
    }

    return { success: true }
}
