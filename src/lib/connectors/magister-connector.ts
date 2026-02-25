/**
 * Magister School Connector
 *
 * Wraps the existing MagisterClient to conform to the SchoolConnector interface.
 * Credentials are read from user_preferences (magister_url, magister_username, magister_password).
 * They are stored encrypted at rest by Supabase and are only accessible to the row owner (RLS).
 */
import { createClient } from '@/lib/supabase/server';
import { MagisterClient } from '@/lib/magister';
import { SchoolAssignment, SchoolConnector } from './types';

export class MagisterConnector implements SchoolConnector {
    readonly type = 'magister';

    async fetchData(userId: string): Promise<SchoolAssignment[]> {
        const supabase = await createClient();
        const { data: prefs } = await supabase
            .from('user_preferences')
            .select('magister_url, magister_username, magister_password')
            .eq('user_id', userId)
            .single();

        if (!prefs?.magister_url || !prefs?.magister_username || !prefs?.magister_password) {
            return []; // Not configured
        }

        try {
            const client = new MagisterClient(prefs.magister_url);
            await client.login(prefs.magister_username, prefs.magister_password);

            const from = new Date();
            const until = new Date();
            until.setDate(until.getDate() + 14); // Look 2 weeks ahead

            const deadlines = await client.getDeadlines(from, until);

            return deadlines.map((d) => ({
                id: String(d.id),
                title: d.title,
                description: d.description || null,
                dueDate: d.end || d.start,
                subject: null,
                type: d.type || null,
                source: 'magister',
                isTest: d.type?.toLowerCase().includes('toets') || d.type?.toLowerCase().includes('test') || false,
            }));
        } catch (error) {
            console.error('[MagisterConnector] Error fetching data:', error);
            return [];
        }
    }
}
