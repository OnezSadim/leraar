import { z } from 'zod';
import { createClient } from '@/lib/supabase/server'
import { AITool } from '@/lib/registry'

export const readWhatsappContextTool: AITool = {
    name: "read_whatsapp_context",
    description: "Read recent WhatsApp messages sent by the user for additional context.",
    parameters: z.object({
        limit: z.number().optional().describe("Number of messages to retrieve, defaults to 10.")
    }),
    execute: async (userId, { limit = 10 }) => {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('agent_messages')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'whatsapp_message')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            console.error('Error reading whatsapp context:', error);
            throw error;
        }

        return {
            success: true,
            messages: data || []
        }
    }
};
