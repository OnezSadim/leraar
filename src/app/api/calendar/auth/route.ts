import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('google_calendar_credentials')
        .eq('user_id', user.id)
        .single();

    const creds = prefs?.google_calendar_credentials as any;

    if (!creds || !creds.client_id || !creds.client_secret) {
        return NextResponse.json({ error: 'Missing client_id or client_secret in preferences' }, { status: 400 });
    }

    const redirectUri = new URL('/api/calendar/callback', request.url).toString();

    const oauth2Client = new google.auth.OAuth2(
        creds.client_id,
        creds.client_secret,
        redirectUri
    );

    const scopes = [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events'
    ];

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true,
        prompt: 'consent' // Force to get refresh token
    });

    return NextResponse.redirect(authorizationUrl);
}
