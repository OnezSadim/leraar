import { z } from 'zod';
import { createClient } from '@/lib/supabase/server'
import { AITool } from '@/lib/registry'

export const navigateSiteTool: AITool = {
    name: "navigate_site",
    description: "Navigate the user to a different page within the application (e.g. /dashboard, /settings, /materials).",
    parameters: z.object({
        path: z.string().describe("The relative URL path to navigate to, starting with /")
    }),
    execute: async (userId, { path }) => {
        const supabase = await createClient()

        // For this demo tool, we just log the intent to the db as an agent message
        // A real robust implementation might use Server Actions redirection, 
        // or a client-side listener that polls for "navigation" intents.
        await supabase
            .from('agent_messages')
            .insert({
                user_id: userId,
                content: `Navigating to ${path}`,
                type: 'system_navigation',
                metadata: { path }
            })

        return {
            success: true,
            message: `Navigation to ${path} has been triggered.`
        }
    }
};
