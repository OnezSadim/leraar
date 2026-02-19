'use server'

import { createClient } from '@/lib/supabase/server';
import { listEvents } from '@/lib/google-calendar';
import { planAccountabilitySchedule } from '@/lib/ai';
import { revalidatePath } from 'next/cache';

export async function syncAndCheckCalendar() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Fetch user preferences and current queue
    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

    const { data: queueItems } = await supabase
        .from('study_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending');

    const { data: schedules } = await supabase
        .from('user_schedules')
        .select(`
            *,
            queue_item:study_queue(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'upcoming');

    // 2. Fetch Google Calendar events for the next 3 days (focused window)
    const now = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(now.getDate() + 3);

    let calendarEvents = [];
    try {
        calendarEvents = await listEvents(user.id, now, windowEnd);
    } catch (e) {
        console.error('Calendar sync failed:', e);
        return { success: false, error: 'Calendar credentials invalid or missing.' };
    }

    // 3. Ask Gemini to analyze the situation
    const analysis = await planAccountabilitySchedule(
        user.id,
        queueItems || [],
        prefs,
        calendarEvents,
        prefs?.gemini_api_key
    );

    const parsedAnalysis = JSON.parse(analysis);

    // 4. Store the agent's message/suggestion (if any)
    if (parsedAnalysis.explanation) {
        await supabase.from('agent_messages').insert({
            user_id: user.id,
            content: parsedAnalysis.explanation,
            type: 'calendar_sync',
            metadata: parsedAnalysis
        });
    }

    revalidatePath('/dashboard');
    return { success: true, analysis: parsedAnalysis };
}

export async function approveProposedSession(session: any) {
    // Implementation for approving a session and adding it to the DB/Calendar
}
