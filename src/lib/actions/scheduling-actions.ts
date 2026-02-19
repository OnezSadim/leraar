'use server'

import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
    UserPreferences,
} from '@/lib/accountability'
import {
    getAgentToolDefinitions,
    executeAgentTool
} from './agent-registry'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

export async function chatWithSchedulingAssistant(
    messages: { role: 'user' | 'assistant'; content: string }[],
    currentTime: string,
    currentQueueItemId?: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 1. Fetch Comprehensive Context
    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

    const { data: upcomingSchedules } = await supabase
        .from('user_schedules')
        .select('*, queue_item:study_queue(*)')
        .eq('user_id', user.id)
        .eq('status', 'upcoming')
        .gt('scheduled_start', new Date().toISOString())
        .order('scheduled_start', { ascending: true })
        .limit(5)

    const { data: recentNotes } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

    const { data: pendingQueue } = await supabase
        .from('study_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .limit(5)

    const { data: recentAgentMessages } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

    const { data: recentWhatsAppMessages } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'whatsapp_message')
        .order('created_at', { ascending: false })
        .limit(5)

    const currentPrefs: UserPreferences = prefs || {
        study_times: { avoid: ['morning'], preferred: ['afternoon', 'evening'], busy_slots: [] },
        knowledge_assessment: {}
    }

    // 2. Dynamic Tool Discovery
    const availableTools = getAgentToolDefinitions();

    // 3. Build System Prompt with Rich Context
    const systemPrompt = `
    You are an Autonomous Accountability Agent for a personalized learning platform. 
    Your goal is to actively manage the student's schedule, remember their context, and ensure they learn effectively.
    
    You have FULL ACCESS to act on the user's behalf through the tools listed below.

    === NEW CAPABILITY: MATERIAL DISCOVERY ===
    If the user mentions a specific topic, textbook, or chapter that you don't recognize in their context, you MUST use the \`search_materials\` tool to see if the content already exists in the global library.
    If you find relevant material, tell the user about it and offer to call \`import_material\`.

    === CURRENT CONTEXT ===
    TIME: ${currentTime}
    
    PREFERENCES: 
    - Avoid: ${JSON.stringify(currentPrefs.study_times.avoid)}
    - Preferred: ${JSON.stringify(currentPrefs.study_times.preferred)}
    - Recurring Busy Slots: ${JSON.stringify(currentPrefs.study_times.busy_slots)}

    UPCOMING SCHEDULE:
    ${upcomingSchedules?.map(s => `- ${new Date(s.scheduled_start).toLocaleString()}: ${s.queue_item?.test_info || 'Study Session'} (${s.duration_seconds / 60} min)`).join('\n') || "No upcoming sessions."}

    RECENT NOTES (MEMORY):
    ${recentNotes?.map(n => `- [${n.category}] ${n.content}`).join('\n') || "No recent notes."}

    PENDING TASK QUEUE:
    ${pendingQueue?.map(q => `- [ID: ${q.id}] ${q.test_info} (~${Math.round(q.estimated_time_seconds / 3600)}h)`).join('\n') || "Queue is empty."}
    
    RECENT AGENT MESSAGES (YOUR RECENT ASKS):
    ${recentAgentMessages?.map(m => `- [Type: ${m.type}] ${m.content}`).join('\n') || "No recent agent messages."}

    WHATSAPP MESSAGES (USER RECENT INPUTS):
    ${recentWhatsAppMessages?.map(m => `- [From: ${m.metadata?.from}] ${m.content}`).join('\n') || "No recent WhatsApp messages."}

    CURRENT FOCUS ITEM ID: ${currentQueueItemId || 'None'}
    =======================

    AVAILABLE TOOLS:
    ${JSON.stringify(availableTools, null, 2)}

    INSTRUCTIONS:
    1. **Be Proactive**: If the user mentions a conflict, rescheduling, or an interest, use the tools immediately.
    2. **Acting on Behalf**: You don't just "chat," you "act." If someone says "schedule this," call the tool.
    3. **Combined Response**: You can output multiple JSON tool call blocks in your response.
    4. **Natural Feedback**: Always explain what actions you took to the user.

    TO USE A TOOL, output a JSON block like this:
    \`\`\`json
    {
      "tool": "tool_name",
      "arguments": { ... }
    }
    \`\`\`
    
    CRITICAL: 
    - Always respect "Recurring Busy Slots" when scheduling.
    - If you update preferences (like new recurring slots), include a block:
      \`\`\`json
      { "preference_update": { ... } }
      \`\`\`
    `;

    // Validate history
    let historyMessages = messages.slice(0, -1);
    while (historyMessages.length > 0 && historyMessages[0].role !== 'user') {
        historyMessages.shift();
    }

    const chat = model.startChat({
        history: historyMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        })),
        generationConfig: {
            maxOutputTokens: 1000,
        },
    });

    const augmentedPrompt = `${systemPrompt}\n\nUser Message: ${messages[messages.length - 1].content}`;

    const result = await chat.sendMessage(augmentedPrompt);
    const responseText = result.response.text();

    const jsonMatches = responseText.matchAll(/```json\s*([\s\S]*?)\s*```/g);
    let cleanResponseText = responseText.replace(/```json\s*[\s\S]*?\s*```/g, '');
    cleanResponseText = cleanResponseText.replace(/^\s*[\r\n]/gm, '').trim();

    const toolsUsed: string[] = [];

    for (const match of jsonMatches) {
        try {
            const data = JSON.parse(match[1]);

            // Handle Standard Preference Updates (legacy support)
            if (data.preference_update) {
                const { updateUserPreferences } = await import('@/lib/accountability');
                await updateUserPreferences(user.id, data.preference_update);
                toolsUsed.push('update_preferences');
            }
            if (data.knowledge_update) {
                const { updateUserKnowledge } = await import('@/lib/accountability');
                await updateUserKnowledge(user.id, data.knowledge_update);
                toolsUsed.push('update_knowledge');
            }

            // Handle Registry Tools
            if (data.tool) {
                // If it's a schedule session, inject the currentQueueItemId if not provided
                if (data.tool === 'schedule_session' && !data.arguments.queueItemId) {
                    data.arguments.queueItemId = currentQueueItemId;
                }
                await executeAgentTool(user.id, data.tool, data.arguments);
                toolsUsed.push(data.tool);
            }

        } catch (e) {
            console.error("Error parsing AI tool call:", e);
        }
    }

    return {
        content: cleanResponseText,
        toolsUsed: Array.from(new Set(toolsUsed)) // Unique tools
    };
}
