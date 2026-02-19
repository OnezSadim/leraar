'use server'

import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
    updateUserKnowledge,
    updateUserPreferences,
    UserPreferences,
    BusySlot
} from '@/lib/accountability'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

// Define tools for the AI agent
const tools = [
    {
        name: "schedule_session",
        description: "Schedule a new study session for the user",
        parameters: {
            type: "object",
            properties: {
                startTime: { type: "string", description: "ISO 8601 string for the session start time" },
                durationMinutes: { type: "number", description: "Duration of the session in minutes" },
                topic: { type: "string", description: "Topic or focus of the study session" }
            },
            required: ["startTime", "durationMinutes", "topic"]
        }
    },
    {
        name: "add_note",
        description: "Save a note about the user's learning progress, context, or key details to remember later",
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
        }
    },
    {
        name: "resolve_queue_item",
        description: "Mark a queue item as resolved or scheduled",
        parameters: {
            type: "object",
            properties: {
                queueItemId: { type: "string", description: "The ID of the queue item to resolve" },
                status: { type: "string", enum: ["scheduled", "resolved"], description: "The new status" }
            },
            required: ["queueItemId", "status"]
        }
    }
];

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

    const currentPrefs: UserPreferences = prefs || {
        study_times: { avoid: ['morning'], preferred: ['afternoon', 'evening'], busy_slots: [] },
        knowledge_assessment: {}
    }

    // 2. Build System Prompt with Rich Context
    const systemPrompt = `
    You are an Autonomous Accountability Agent for a personalized learning platform. 
    Your goal is to actively manage the student's schedule, remember their context, and ensure they learn effectively.
    
    You have permission to take actions on behalf of the user using the provided tools.

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
    
    CURRENT FOCUS ITEM ID: ${currentQueueItemId || 'None'}
    =======================

    INSTRUCTIONS:
    1. **Be Proactive**: If the user mentions a conflict, effectively reschedule. If they mention a struggle, note it down.
    2. **Use Tools**: 
       - If the user agrees to a time, call \`schedule_session\`.
       - If the user mentions a constraint or learning context (e.g., "I'm bad at physics"), call \`add_note\`.
       - If you schedule a session for a queue item, also call \`resolve_queue_item\`.
    3. **Natural Dialogue**: After calling tools, confirm the action naturally to the user.

    CRITICAL: 
    - Always check the "Recurring Busy Slots" and "Upcoming Schedule" before suggesting a time.
    - Do not hallucinate actions. Only use the provided tools.
    - If you update preferences (like new recurring slots), you can still output the JSON block for preferences along with tool calls.
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

    const augmentedPrompt = `
    ${systemPrompt}

    TO USE A TOOL, output a JSON block like this:
    \`\`\`json
    {
      "tool": "tool_name",
      "arguments": { ... }
    }
    \`\`\`
    
    You can output multiple tool blocks if needed. You can also output the standard preference update JSON block from before.
    
    User Message: ${messages[messages.length - 1].content}
    `;

    const result = await chat.sendMessage(augmentedPrompt);
    const responseText = result.response.text();

    // 3. Process Tool Calls & Updates
    const jsonMatches = responseText.matchAll(/```json\s*([\s\S]*?)\s*```/g);
    let cleanResponseText = responseText.replace(/```json\s*[\s\S]*?\s*```/g, '');
    cleanResponseText = cleanResponseText.replace(/^\s*[\r\n]/gm, '').trim();

    for (const match of jsonMatches) {
        try {
            const data = JSON.parse(match[1]);

            // Handle Standard Preference Updates
            if (data.preference_update) {
                await updateUserPreferences(user.id, data.preference_update);
            }
            if (data.knowledge_update) {
                await updateUserKnowledge(user.id, data.knowledge_update);
            }

            // Handle Tool Calls
            if (data.tool === "schedule_session") {
                const { startTime, durationMinutes, topic } = data.arguments;
                // Create a placeholder queue item if none exists for ad-hoc sessions
                let qId = currentQueueItemId;

                if (!qId) {
                    const { data: newQ } = await supabase.from('study_queue').insert({
                        user_id: user.id,
                        test_info: topic,
                        status: 'scheduled',
                        estimated_time_seconds: durationMinutes * 60
                    }).select().single();
                    if (newQ) qId = newQ.id;
                }

                if (qId) {
                    await supabase.from('user_schedules').insert({
                        user_id: user.id,
                        queue_item_id: qId,
                        scheduled_start: startTime,
                        duration_seconds: durationMinutes * 60,
                        status: 'upcoming'
                    });

                    // Also mark the queue item as scheduled if it was pending
                    await supabase.from('study_queue')
                        .update({ status: 'scheduled' })
                        .eq('id', qId);
                }
            }

            if (data.tool === "add_note") {
                await supabase.from('user_notes').insert({
                    user_id: user.id,
                    content: data.arguments.content,
                    category: data.arguments.category
                });
            }

            if (data.tool === "resolve_queue_item") {
                await supabase.from('study_queue')
                    .update({ status: data.arguments.status })
                    .eq('id', data.arguments.queueItemId);
            }

        } catch (e) {
            console.error("Error parsing AI tool call:", e);
        }
    }

    return cleanResponseText;
}
