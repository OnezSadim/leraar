/**
 * Google Calendar School Connector
 *
 * Wraps the existing google-calendar.ts lib to implement SchoolConnector.
 * Fetches calendar events that look like tests, exams, or homework deadlines.
 */
import { listEvents } from '@/lib/google-calendar';
import { SchoolAssignment, SchoolConnector } from './types';

const TEST_KEYWORDS = ['toets', 'test', 'exam', 'exameen', 'proefwerk', 'deadline', 'inleveren'];

function looksLikeTest(summary: string): boolean {
    const lower = summary.toLowerCase();
    return TEST_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractSubject(summary: string): string | null {
    // Try to detect subject from common Dutch school patterns like "Biologie toets H4"
    const match = summary.match(/^([A-Za-zÀ-ÿ]+)\s/);
    return match ? match[1] : null;
}

export class GoogleCalendarConnector implements SchoolConnector {
    readonly type = 'google_classroom';

    async fetchData(userId: string): Promise<SchoolAssignment[]> {
        try {
            const from = new Date();
            const until = new Date();
            until.setDate(until.getDate() + 14);

            const events = await listEvents(userId, from, until);

            return events
                .filter((e) => e.summary && (e.start?.dateTime || e.start?.date))
                .map((e) => {
                    const dueDate = (e.start?.dateTime || e.start?.date)!;
                    const isTest = looksLikeTest(e.summary!);
                    return {
                        id: e.id!,
                        title: e.summary!,
                        description: e.description || null,
                        dueDate,
                        subject: extractSubject(e.summary!),
                        type: isTest ? 'test' : 'event',
                        source: 'google_classroom',
                        isTest,
                    };
                });
        } catch (error) {
            console.error('[GoogleCalendarConnector] Error fetching data:', error);
            return [];
        }
    }
}
