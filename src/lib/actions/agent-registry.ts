import { z } from 'zod';
import { createClient } from '@/lib/supabase/server'
import { updateUserKnowledge, updateUserPreferences } from '@/lib/accountability'
import { searchGlobalMaterials, importMaterialToUser } from './material-actions'
import { AITool, registerTool, getGeminiTools, executeTool } from '@/lib/registry'
import { navigateSiteTool } from '@/lib/tools/navigation-tool'
import { readWhatsappContextTool } from '@/lib/tools/whatsapp-tool'
import { installPlugin, uninstallPlugin, getInstalledPlugins } from './plugin-install-actions'
import { MagisterConnector } from '@/lib/connectors/magister-connector'
import { GoogleCalendarConnector } from '@/lib/connectors/google-calendar-connector'
import { SchoolConnector } from '@/lib/connectors/types'

// 1. Schedule Session Tool
export const scheduleSessionTool: AITool = {
    name: "schedule_session",
    description: "Schedule a new study session for the user",
    parameters: z.object({
        startTime: z.string().describe("ISO 8601 string for the session start time"),
        durationMinutes: z.number().describe("Duration of the session in minutes"),
        topic: z.string().describe("Topic or focus of the study session"),
        queueItemId: z.string().optional().describe("Optional ID of a pending queue item to associate")
    }),
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
};

// 2. Add Note Tool
export const addNoteTool: AITool = {
    name: "add_note",
    description: "Save a note about the user's learning progress, context, or key details for later recall",
    parameters: z.object({
        content: z.string().describe("The content of the note"),
        category: z.enum(["learning_context", "reminder", "general"]).describe("Category of the note")
    }),
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
};

// 3. Update Knowledge Tool
export const updateKnowledgeTool: AITool = {
    name: "update_knowledge",
    description: "Update the user's knowledge profile based on their description of what they know",
    parameters: z.object({
        knowledgeText: z.string().describe("Natural language description of user knowledge")
    }),
    execute: async (userId, { knowledgeText }) => {
        const res = await updateUserKnowledge(userId, knowledgeText)
        return { success: true, updatedAssessment: res.updatedAssessment }
    }
};

// 4. Join Group Tool
export const joinGroupTool: AITool = {
    name: "join_group",
    description: "Join a study group by its ID",
    parameters: z.object({
        groupId: z.string().describe("The UUID of the group to join")
    }),
    execute: async (userId, { groupId }) => {
        const supabase = await createClient()
        const { error } = await supabase.from('group_subscriptions').insert({
            user_id: userId,
            group_id: groupId
        })
        if (error) throw error
        return { success: true, message: "Successfully joined the group" }
    }
};

// 5. Search Materials Tool
export const searchMaterialsTool: AITool = {
    name: "search_materials",
    description: "Search the global library or groups for study materials (books, chapters, topics)",
    parameters: z.object({
        query: z.string().describe("The search query (e.g., 'Biology Chapter 5')")
    }),
    execute: async (userId, { query }) => {
        return await searchGlobalMaterials(query)
    }
};

// 6. Import Material Tool
export const importMaterialTool: AITool = {
    name: "import_material",
    description: "Import a discovered material or group into the user's active library",
    parameters: z.object({
        materialId: z.string().describe("The UUID of the material to import"),
        groupId: z.string().optional().describe("Optional UUID of the group to join simultaneously")
    }),
    execute: async (userId, { materialId, groupId }) => {
        return await importMaterialToUser(materialId, groupId)
    }
};

// 7. Manage Plugins Tool
export const managePluginsTool: AITool = {
    name: "manage_plugins",
    description: "Install, uninstall, or list the user's installed plugins. Use this proactively when you detect the user would benefit from a specific plugin capability.",
    parameters: z.object({
        action: z.enum(['install', 'uninstall', 'list']).describe("Action to perform"),
        pluginId: z.string().optional().describe("UUID of the plugin (required for install/uninstall)"),
        reason: z.string().optional().describe("Brief reason why you are installing/uninstalling this plugin")
    }),
    execute: async (_userId, { action, pluginId }) => {
        if (action === 'list') {
            const plugins = await getInstalledPlugins();
            return {
                installed: plugins.map(p => ({
                    id: p.plugin_id,
                    name: p.plugin.name,
                    type: p.plugin.plugin_type,
                    connectorType: p.plugin.connector_type,
                }))
            };
        }
        if (!pluginId) return { success: false, error: 'pluginId is required for install/uninstall' };
        if (action === 'install') return installPlugin(pluginId);
        if (action === 'uninstall') return uninstallPlugin(pluginId);
        return { success: false, error: 'Unknown action' };
    }
};

// 8. Fetch School Data Tool
const CONNECTOR_MAP: Record<string, () => SchoolConnector> = {
    magister: () => new MagisterConnector(),
    google_classroom: () => new GoogleCalendarConnector(),
};

export const fetchSchoolDataTool: AITool = {
    name: "fetch_school_data",
    description: "Fetch upcoming assignments, tests, and deadlines from the user's installed school connectors (e.g. Magister, Google Classroom). Returns a unified list sorted by due date.",
    parameters: z.object({
        daysAhead: z.number().optional().describe("How many days ahead to look (default: 14)")
    }),
    execute: async (userId) => {
        const supabase = await createClient();
        const { data } = await supabase
            .from('installed_plugins')
            .select('plugin:plugin_id(connector_type)')
            .eq('user_id', userId);

        if (!data || data.length === 0) {
            return { assignments: [], message: 'No school connectors installed.' };
        }

        const installedConnectorTypes = data
            .map((row) => (row.plugin as unknown as { connector_type: string | null })?.connector_type)
            .filter((t): t is string => !!t && t in CONNECTOR_MAP);

        const uniqueTypes = [...new Set(installedConnectorTypes)];
        const allAssignments = await Promise.all(
            uniqueTypes.map((type) => CONNECTOR_MAP[type]().fetchData(userId))
        );

        const merged = allAssignments
            .flat()
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        return { assignments: merged, count: merged.length };
    }
};

// Register all tools
[
    scheduleSessionTool,
    addNoteTool,
    updateKnowledgeTool,
    joinGroupTool,
    searchMaterialsTool,
    importMaterialTool,
    navigateSiteTool,
    readWhatsappContextTool,
    managePluginsTool,
    fetchSchoolDataTool,
].forEach(registerTool);

// Export legacy functions bridging to the new registry for backward compatibility if needed, 
// though we will update scheduling-actions to use registry.ts directly.
export { getGeminiTools as getAgentToolDefinitions, executeTool as executeAgentTool };
