import { google } from 'googleapis';
import { createClient } from './supabase/server';

export interface CalendarCredentials {
    client_id: string;
    client_secret: string;
    refresh_token: string;
}

export async function getCalendarClient(userId: string) {
    const supabase = await createClient();
    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('google_calendar_credentials')
        .eq('user_id', userId)
        .single();

    if (!prefs?.google_calendar_credentials) {
        throw new Error('Google Calendar credentials not found');
    }

    const creds = prefs.google_calendar_credentials as unknown as CalendarCredentials;

    if (!creds.client_id || !creds.client_secret || !creds.refresh_token) {
        throw new Error('Incomplete Google Calendar credentials. Need client_id, client_secret, and refresh_token.');
    }

    const oauth2Client = new google.auth.OAuth2(
        creds.client_id,
        creds.client_secret
    );

    oauth2Client.setCredentials({
        refresh_token: creds.refresh_token
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function listEvents(userId: string, timeMin: Date, timeMax: Date) {
    const calendar = await getCalendarClient(userId);
    const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
    });

    return response.data.items || [];
}

export async function createStudyEvent(userId: string, event: { summary: string, description?: string, startTime: string, endTime: string }) {
    const calendar = await getCalendarClient(userId);
    const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
            summary: `[Leraar AI] ${event.summary}`,
            description: event.description || 'Study session managed by Leraar AI.',
            start: { dateTime: event.startTime },
            end: { dateTime: event.endTime },
            extendedProperties: {
                private: {
                    leraar_ai_event: 'true'
                }
            }
        }
    });

    return response.data;
}

export async function updateStudyEvent(userId: string, eventId: string, updates: { startTime?: string, endTime?: string, summary?: string }) {
    const calendar = await getCalendarClient(userId);
    const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: {
            ...(updates.summary && { summary: `[Leraar AI] ${updates.summary}` }),
            ...(updates.startTime && { start: { dateTime: updates.startTime } }),
            ...(updates.endTime && { end: { dateTime: updates.endTime } }),
        }
    });

    return response.data;
}

export async function deleteStudyEvent(userId: string, eventId: string) {
    const calendar = await getCalendarClient(userId);
    await calendar.events.delete({
        calendarId: 'primary',
        eventId
    });
}
