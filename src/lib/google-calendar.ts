'use server';

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

export async function createStudyEvent(userId: string, event: { summary: string, description?: string, startTime: string, endTime: string, isTest?: boolean }) {
    const calendar = await getCalendarClient(userId);
    const summaryStr = event.isTest ? event.summary : `[Leraar AI] ${event.summary}`;

    const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
            summary: summaryStr,
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

    const supabase = await createClient();
    if (response.data.id) {
        await supabase.from('calendar_events').insert({
            user_id: userId,
            google_event_id: response.data.id,
            summary: summaryStr,
            start_time: event.startTime,
            end_time: event.endTime,
            is_test: event.isTest || false,
            proactive_outreach_status: 'none'
        });
    }

    return response.data;
}

export async function updateStudyEvent(userId: string, eventId: string, updates: { startTime?: string, endTime?: string, summary?: string }) {
    const calendar = await getCalendarClient(userId);
    const summaryStr = updates.summary ? `[Leraar AI] ${updates.summary}` : undefined;

    const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: {
            ...(summaryStr && { summary: summaryStr }),
            ...(updates.startTime && { start: { dateTime: updates.startTime } }),
            ...(updates.endTime && { end: { dateTime: updates.endTime } }),
        }
    });

    const supabase = await createClient();
    await supabase.from('calendar_events').update({
        ...(summaryStr && { summary: summaryStr }),
        ...(updates.startTime && { start_time: updates.startTime }),
        ...(updates.endTime && { end_time: updates.endTime }),
    }).eq('google_event_id', eventId).eq('user_id', userId);

    return response.data;
}

export async function deleteStudyEvent(userId: string, eventId: string) {
    const calendar = await getCalendarClient(userId);
    await calendar.events.delete({
        calendarId: 'primary',
        eventId
    });

    const supabase = await createClient();
    await supabase.from('calendar_events').delete().eq('google_event_id', eventId).eq('user_id', userId);
}

export async function syncCalendarEvents(userId: string) {
    try {
        const timeMin = new Date();
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 30); // Sync next 30 days

        const items = await listEvents(userId, timeMin, timeMax);
        const supabase = await createClient();

        for (const item of items) {
            if (!item.id || !item.summary || !item.start?.dateTime || !item.end?.dateTime) continue;

            // Upsert based on google_event_id
            const isTest = item.summary.toLowerCase().includes('test') || item.summary.toLowerCase().includes('exam') || item.summary.toLowerCase().includes('toets');

            // Check if exists
            const { data: existing } = await supabase
                .from('calendar_events')
                .select('id, proactive_outreach_status')
                .eq('google_event_id', item.id)
                .single();

            if (existing) {
                await supabase.from('calendar_events').update({
                    summary: item.summary,
                    start_time: item.start.dateTime,
                    end_time: item.end.dateTime,
                    is_test: isTest
                }).eq('id', existing.id);
            } else {
                await supabase.from('calendar_events').insert({
                    user_id: userId,
                    google_event_id: item.id,
                    summary: item.summary,
                    start_time: item.start.dateTime,
                    end_time: item.end.dateTime,
                    is_test: isTest,
                    proactive_outreach_status: isTest ? 'pending' : 'none'
                });
            }
        }
        return { success: true, count: items.length };
    } catch (error) {
        console.error('Sync failed:', error);
        return { success: false, error };
    }
}
