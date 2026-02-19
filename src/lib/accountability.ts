import { createClient } from './supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export interface BusySlot {
    day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    start: string; // HH:mm
    end: string;   // HH:mm
    label: string;
}

export interface UserPreferences {
    study_times: {
        avoid: string[];
        preferred: string[];
        busy_slots: BusySlot[];
    };
    knowledge_assessment: Record<string, any>;
}

export interface QueueItem {
    id: string;
    user_id: string;
    material_id?: string;
    test_info?: string;
    status: 'pending' | 'scheduled' | 'completed' | 'resolved';
    estimated_time_seconds: number;
    created_at: string;
}

/**
 * Estimates the time required for a queue item based on text info.
 */
export async function estimateQueueItemTime(text: string): Promise<number> {
    const prompt = `
    Analyze the following study material or test information and estimate the total time in SECONDS 
    required for an average student to master it.
    
    Info: ${text}
    
    RETURN ONLY THE NUMBER (SECONDS).
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const seconds = parseInt(response.text().trim().replace(/[^0-9]/g, ''), 10);
        return isNaN(seconds) ? 3600 : seconds; // Default to 1 hour if failed
    } catch (error) {
        console.error('Error estimating time:', error);
        return 3600;
    }
}

import { listEvents } from './google-calendar';

/**
 * Proposes a study schedule based on user preferences and availability.
 */
export async function proposeSchedule(
    userId: string,
    queueItemId: string,
    durationSeconds: number
): Promise<{ startTime: string; duration: number; conflictDetected?: boolean; suggestedReason?: string }> {
    const supabase = await createClient();

    // 1. Get user preferences
    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

    const preferences: UserPreferences = prefs || {
        study_times: { avoid: ['morning'], preferred: ['afternoon', 'evening'], busy_slots: [] },
        knowledge_assessment: {}
    };

    // 2. Fetch Google Calendar events for the next week
    let calendarEvents: any[] = [];
    try {
        const now = new Date();
        const oneWeekLater = new Date();
        oneWeekLater.setDate(now.getDate() + 7);
        calendarEvents = await listEvents(userId, now, oneWeekLater);
    } catch (e) {
        console.warn('Could not fetch calendar events, falling back to basic logic:', e);
    }

    // 3. Simple conflict-aware scheduling
    const now = new Date();
    const suggestion = new Date(now);
    suggestion.setDate(now.getDate() + 1); // Start looking from tomorrow

    // Basic heuristic: check preferred slots and verify no calendar conflict
    const preferredHours = preferences.study_times.preferred.includes('afternoon') ? 14 : 19;
    suggestion.setHours(preferredHours, 0, 0, 0);

    // Simple conflict check (find if any event overlaps with this 1-hour slot)
    const endTime = new Date(suggestion.getTime() + durationSeconds * 1000);
    const hasConflict = calendarEvents.some(event => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date);
        const eventEnd = new Date(event.end?.dateTime || event.end?.date);
        return (suggestion < eventEnd && endTime > eventStart);
    });

    if (hasConflict) {
        // Find next free slot (very basic: next day)
        suggestion.setDate(suggestion.getDate() + 1);
        return {
            startTime: suggestion.toISOString(),
            duration: durationSeconds,
            conflictDetected: true,
            suggestedReason: 'Conflict detected in your Google Calendar at the original preferred time.'
        };
    }

    return {
        startTime: suggestion.toISOString(),
        duration: durationSeconds
    };
}

/**
 * Updates the user's knowledge assessment based on their input.
 */
export async function updateUserKnowledge(
    userId: string,
    knowledgeText: string
): Promise<{ updatedAssessment: Record<string, any> }> {
    const supabase = await createClient();

    // 1. Get current preferences
    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

    const currentAssessment = prefs?.knowledge_assessment || {};

    // 2. Use Gemini to extract concepts and mastery levels
    const prompt = `
    Analyze the following statement from a student about what they know:
    "${knowledgeText}"

    Extract key concepts and their mastery levels (either 'mastered' or 'familiar').
    Existing knowledge: ${JSON.stringify(currentAssessment)}

    RETURN ONLY A JSON OBJECT representing the new/updated knowledge assessment:
    {
      "concept_name": "mastery_level"
    }
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonStr = response.text().replace(/```json|```/g, '').trim();
        const newKnowledge = JSON.parse(jsonStr);

        const updatedAssessment = { ...currentAssessment, ...newKnowledge };

        // 3. Persist to DB
        await supabase
            .from('user_preferences')
            .upsert({
                user_id: userId,
                knowledge_assessment: updatedAssessment,
                updated_at: new Date().toISOString()
            });

        return { updatedAssessment };
    } catch (error) {
        console.error('Error updating knowledge:', error);
        return { updatedAssessment: currentAssessment };
    }
}

/**
 * Updates user study preferences (busy slots, preferred times).
 */
export async function updateUserPreferences(
    userId: string,
    preferenceUpdate: Partial<UserPreferences['study_times']>
): Promise<UserPreferences['study_times']> {
    const supabase = await createClient();

    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('study_times')
        .eq('user_id', userId)
        .single();

    const currentStudyTimes = prefs?.study_times || { avoid: ['morning'], preferred: ['afternoon', 'evening'], busy_slots: [] };
    const updatedStudyTimes = { ...currentStudyTimes, ...preferenceUpdate };

    await supabase
        .from('user_preferences')
        .upsert({
            user_id: userId,
            study_times: updatedStudyTimes,
            updated_at: new Date().toISOString()
        });

    return updatedStudyTimes;
}
