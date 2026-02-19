'use server'

import { createClient } from '@/lib/supabase/server';
import { MagisterClient, MagisterDeadline } from '@/lib/magister';
import { revalidatePath } from 'next/cache';

export async function syncMagisterDeadlines() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Fetch Magister Credentials
    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('magister_url, magister_username, magister_password')
        .eq('user_id', user.id)
        .single();

    if (!prefs?.magister_url || !prefs?.magister_username || !prefs?.magister_password) {
        return { success: false, error: 'Magister credentials missing. Please set them in Settings.' };
    }

    // 2. Clear/Fetch Magister Deadlines
    const client = new MagisterClient(prefs.magister_url);
    const loggedIn = await client.login(prefs.magister_username, prefs.magister_password);
    if (!loggedIn) {
        return { success: false, error: 'Failed to login to Magister. Check your credentials.' };
    }

    const now = new Date();
    const endWindow = new Date();
    endWindow.setDate(now.getDate() + 30); // Look ahead 30 days

    const deadlines = await client.getDeadlines(now, endWindow);

    // 3. Process Deadlines
    let addedCount = 0;
    for (const deadline of deadlines) {
        // Check if already in queue (using a unique identifier or title/start combo)
        // For simplicity, we'll check by title and scheduled time if available, 
        // but study_queue doesn't have a direct 'start_time' for the test, 
        // it uses 'test_info'.

        const testInfo = `${deadline.title} (${deadline.type})`;

        const { data: existing } = await supabase
            .from('study_queue')
            .select('id')
            .eq('user_id', user.id)
            .eq('test_info', testInfo)
            .single();

        if (!existing) {
            // Add to study queue
            const { data: newItem, error: insertError } = await supabase
                .from('study_queue')
                .insert({
                    user_id: user.id,
                    test_info: testInfo,
                    status: 'pending',
                    estimated_time_seconds: 7200, // Default 2 hours for a new deadline
                })
                .select()
                .single();

            if (insertError) {
                console.error('Error inserting deadline:', insertError);
                continue;
            }

            // 4. Trigger Accountability Agent Task
            // The user wants the agent to ask about the accountability agent.
            await supabase.from('agent_messages').insert({
                user_id: user.id,
                content: `I've detected a new deadline from Magister: "${deadline.title}". Would you like me to be your accountability agent for this? I can help you plan your study sessions and check in on your progress.`,
                type: 'accountability_request',
                metadata: {
                    deadline_id: deadline.id,
                    queue_item_id: newItem.id,
                    title: deadline.title,
                    due_date: deadline.start
                }
            });

            addedCount++;
        }
    }

    revalidatePath('/dashboard');
    return { success: true, addedCount };
}
