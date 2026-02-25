import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const { data: prefs } = await supabase
        .from('user_preferences')
        .select('google_calendar_credentials')
        .eq('user_id', user.id)
        .single();

    const creds = prefs?.google_calendar_credentials as any;

    if (!creds || !creds.client_id || !creds.client_secret) {
        return NextResponse.redirect(new URL('/?error=missing_credentials', request.url));
    }

    const redirectUri = new URL('/api/calendar/callback', request.url).toString();

    const oauth2Client = new google.auth.OAuth2(
        creds.client_id,
        creds.client_secret,
        redirectUri
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);

        if (tokens.refresh_token) {
            // Update preferences with the new refresh token
            const updatedCreds = {
                client_id: creds.client_id,
                client_secret: creds.client_secret,
                refresh_token: tokens.refresh_token
            };

            await supabase
                .from('user_preferences')
                .update({ google_calendar_credentials: updatedCreds })
                .eq('user_id', user.id);
        }

        return NextResponse.redirect(new URL('/', request.url));
    } catch (error) {
        console.error('Error exchanging OAuth code:', error);
        return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
    }
}
