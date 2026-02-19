import { createClient } from '@/lib/supabase/server'
import { updateUserKnowledge, updateUserPreferences } from '@/lib/accountability'
import { searchGlobalMaterials, importMaterialToUser } from './material-actions'

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any;
    execute: (userId: string, args: any) => Promise<any>;
}

export const AGENT_TOOLS: Record<string, ToolDefinition> = {
    schedule_session: {
        name: "schedule_session",
        description: "Schedule a new study session for the user",
        parameters: {
            type: "object",
            properties: {
                startTime: { type: "string", description: "ISO 8601 string for the session start time" },
                durationMinutes: { type: "number", description: "Duration of the session in minutes" },
                topic: { type: "string", description: "Topic or focus of the study session" },
                queueItemId: { type: "string", description: "Optional ID of a pending queue item to associate" }
            },
            required: ["startTime", "durationMinutes", "topic"]
        },
        execute: async (userId, { startTime, durationMinutes, topic, queueItemId }) => {
            const supabase = await createClient()
            let qId = queueItemId

            if (!qId) {
                const { data: newQ } = await supabase.from('study_queue').insert({
                    user_id: userId,
                    test_info: topic,
                    status: 'scheduled',
                    estimated_time_seconds: durationMinutes * 60
                }).select().single()
                if (newQ) qId = newQ.id
            }

            if (qId) {
                const { error } = await supabase.from('user_schedules').insert({
                    user_id: userId,
                    queue_item_id: qId,
                    scheduled_start: startTime,
                    duration_seconds: durationMinutes * 60,
                    status: 'upcoming'
                })
                if (error) throw error

                await supabase.from('study_queue').update({ status: 'scheduled' }).eq('id', qId)
                return { success: true, message: `Scheduled ${topic} for ${new Date(startTime).toLocaleString()}` }
            }
            return { success: false, error: "Missing queue item" }
        }
    },
    add_note: {
        name: "add_note",
        description: "Save a note about the user's learning progress, context, or key details for later recall",
        parameters: {
            type: "object",
            properties: {
                content: { type: "string", description: "The content of the note" },
                category: {
                    type: "string",
                    enum: ["learning_context", "reminder", "general"],
                    description: "Category of the note"
                }
            },
            required: ["content", "category"]
        },
        execute: async (userId, { content, category }) => {
            const supabase = await createClient()
            const { error } = await supabase.from('user_notes').insert({
                user_id: userId,
                content: content,
                category: category
            })
            if (error) throw error
            return { success: true, note: content }
        }
    },
    update_knowledge: {
        name: "update_knowledge",
        description: "Update the user's knowledge profile based on their description of what they know",
        parameters: {
            type: "object",
            properties: {
                knowledgeText: { type: "string", description: "Natural language description of user knowledge" }
            },
            required: ["knowledgeText"]
        },
        execute: async (userId, { knowledgeText }) => {
            const res = await updateUserKnowledge(userId, knowledgeText)
            return { success: true, updatedAssessment: res.updatedAssessment }
        }
    },
    join_group: {
        name: "join_group",
        description: "Join a study group by its ID",
        parameters: {
            type: "object",
            properties: {
                groupId: { type: "string", description: "The UUID of the group to join" }
            },
            required: ["groupId"]
        },
        execute: async (userId, { groupId }) => {
            const supabase = await createClient()
            const { error } = await supabase.from('group_subscriptions').insert({
                user_id: userId,
                group_id: groupId
            })
            if (error) throw error
            return { success: true, message: "Successfully joined the group" }
        }
    },
    search_materials: {
        name: "search_materials",
        description: "Search the global library or groups for study materials (books, chapters, topics)",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "The search query (e.g., 'Biology Chapter 5')" }
            },
            required: ["query"]
        },
        execute: async (userId, { query }) => {
            return await searchGlobalMaterials(query)
        }
    },
    import_material: {
        name: "import_material",
        description: "Import a discovered material or group into the user's active library",
        parameters: {
            type: "object",
            properties: {
                materialId: { type: "string", description: "The UUID of the material to import" },
                groupId: { type: "string", description: "Optional UUID of the group to join simultaneously" }
            },
            required: ["materialId"]
        },
        execute: async (userId, { materialId, groupId }) => {
            return await importMaterialToUser(materialId, groupId)
        }
    }
}

export function getAgentToolDefinitions() {
    return Object.values(AGENT_TOOLS).map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
    }))
}

export async function executeAgentTool(userId: string, name: string, args: any) {
    const tool = AGENT_TOOLS[name];
    if (!tool) throw new Error(`Tool ${name} not found`);
    return await tool.execute(userId, args);
}
