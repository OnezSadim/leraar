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

/**
 * Proposes a study schedule based on user preferences and availability.
 */
export async function proposeSchedule(
    userId: string,
    queueItemId: string,
    durationSeconds: number
): Promise<{ startTime: string; duration: number }> {
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

    // 2. Simple scheduling logic: find the next preferred time slot
    // In a real app, this would check a calendar or existing schedules.
    // For now, we'll suggest a time tomorrow in a preferred slot.

    const now = new Date();
    const suggestion = new Date(now);
    suggestion.setDate(now.getDate() + 1); // Tomorrow

    if (preferences.study_times.preferred.includes('afternoon')) {
        suggestion.setHours(14, 0, 0, 0);
    } else if (preferences.study_times.preferred.includes('evening')) {
        suggestion.setHours(19, 0, 0, 0);
    } else {
        suggestion.setHours(10, 0, 0, 0); // Fallback
    }

    // Handle "avoid" constraint (specifically morning)
    if (preferences.study_times.avoid.includes('morning') && suggestion.getHours() < 12) {
        suggestion.setHours(14, 0, 0, 0); // Push to afternoon
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
