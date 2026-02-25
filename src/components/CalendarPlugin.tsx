'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { syncCalendarEvents } from '@/lib/google-calendar';

export default function CalendarPlugin({ userId }: { userId: string }) {
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        if (!userId) return;
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);
        // Check connection
        const { data: prefs } = await supabase
            .from('user_preferences')
            .select('google_calendar_credentials')
            .eq('user_id', userId)
            .single();

        const creds = prefs?.google_calendar_credentials as any;
        setIsConnected(!!creds?.refresh_token);

        // Fetch events
        const now = new Date().toISOString();
        const { data: dbEvents } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', userId)
            .gte('start_time', now)
            .order('start_time', { ascending: true })
            .limit(10);

        setEvents(dbEvents || []);
        setLoading(false);
    };

    const handleConnect = () => {
        window.location.href = '/api/calendar/auth';
    };

    const handleSync = async () => {
        setSyncing(true);
        await syncCalendarEvents(userId);
        await fetchData();
        setSyncing(false);
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-white/50">
                <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl overflow-hidden relative group">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                        <Calendar className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-white tracking-wide">Proactive Scheduling</h2>
                </div>
                {isConnected && (
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10 text-white/70 hover:text-white"
                        title="Sync with Google Calendar"
                    >
                        <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                )}
            </div>

            {!isConnected ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 bg-yellow-500/10 rounded-full border border-yellow-500/20 mb-2">
                        <AlertCircle className="w-8 h-8 text-yellow-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white/90">Google Calendar Not Connected</h3>
                    <p className="text-sm text-white/50 max-w-xs">
                        Connect your calendar to let the AI automatically schedule study sessions for your upcoming tests.
                    </p>
                    <button
                        onClick={handleConnect}
                        className="mt-4 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transform hover:-translate-y-0.5"
                    >
                        Connect Google Calendar
                    </button>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/40 space-y-3">
                            <CheckCircle className="w-10 h-10 opacity-30" />
                            <p>No upcoming tests or study sessions.</p>
                        </div>
                    ) : (
                        events.map((event) => {
                            const date = new Date(event.start_time);
                            const isTest = event.is_test;

                            return (
                                <div
                                    key={event.id}
                                    className={`p-4 rounded-2xl border transition-all ${isTest
                                            ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                                            : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                                        }`}
                                >
                                    <div className="flex w-full justify-between items-start mb-2">
                                        <h4 className="text-white/90 font-medium">{event.summary}</h4>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${isTest ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                                            }`}>
                                            {isTest ? 'TEST' : 'STUDY'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col space-y-1 mt-3 text-sm text-white/60">
                                        <div className="flex items-center space-x-2">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>{date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>
                                                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                                {new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        {isTest && event.proactive_outreach_status === 'sent' && (
                                            <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-red-500/20 text-indigo-300 text-xs">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                <span>AI Reachout Sent</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Background Glow */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none" />
        </div>
    );
}
