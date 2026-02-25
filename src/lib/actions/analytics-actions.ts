'use server';

import { createClient } from '@/lib/supabase/server';

export async function saveResearchLog(
    hashedStudentId: string,
    materialId: string,
    pluginName: string,
    durationSeconds: number,
    quizResults: any[]
) {
    try {
        const supabase = await createClient();

        // Ensure user is authenticated, though anonymous records are tied to user sessions implicitly
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('Cannot save research log: User not authenticated.');
            return { success: false, error: 'Unauthorized' };
        }

        const { error } = await supabase
            .from('research_logs')
            .insert({
                hashed_student_id: hashedStudentId,
                material_id: materialId,
                plugin_name: pluginName,
                duration_seconds: durationSeconds,
                quiz_results: quizResults
            });

        if (error) {
            console.error('Error saving research log:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('Failed to save research log:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}
