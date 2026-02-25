/**
 * WhatsApp Background Service
 * This script runs the whatsapp-web.js client and syncs with the Supabase database.
 * Run this with: ts-node scripts/whatsapp-service.ts
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Need service role for background updates
const supabase = createClient(supabaseUrl, supabaseKey);

async function runService(userId: string) {
    console.log(`[WhatsApp Service] Starting for user: ${userId}`);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: userId }),
        puppeteer: {
            handleSIGINT: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
    });

    client.on('qr', async (qr: string) => {
        console.log('[WhatsApp Service] QR Code generated');
        const qrContent = await qrcode.toDataURL(qr);

        await supabase
            .from('whatsapp_connection')
            .upsert({
                user_id: userId,
                qr_code: qrContent,
                status: 'connecting',
                updated_at: new Date().toISOString()
            });
    });

    client.on('ready', async () => {
        console.log('[WhatsApp Service] Client is ready!');

        await supabase
            .from('whatsapp_connection')
            .update({
                status: 'connected',
                qr_code: null,
                phone_number: client.info.wid.user,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        // Start Proactive Outreach Cron Job (Runs every hour)
        setInterval(async () => {
            console.log(`[WhatsApp Service] Running proactive outreach check for ${userId}...`);
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            // Query for tests in the next 7 days that are pending outreach
            const { data: tests } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', userId)
                .eq('is_test', true)
                .eq('proactive_outreach_status', 'pending')
                .gte('start_time', now.toISOString())
                .lte('start_time', nextWeek.toISOString());

            if (tests && tests.length > 0) {
                for (const test of tests) {
                    // Check if there's any non-test study session scheduled BEFORE this test
                    const { data: studySessions } = await supabase
                        .from('calendar_events')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('is_test', false)
                        .gte('start_time', now.toISOString())
                        .lte('start_time', test.start_time)
                        .limit(1);

                    if (!studySessions || studySessions.length === 0) {
                        // User has no study sessions scheduled. Proactively reach out!
                        const testDate = new Date(test.start_time);
                        const daysAway = Math.floor((testDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
                        const dayString = daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : `in ${daysAway} days`;

                        const msgStr = `Hi! I noticed you have a test on **${test.summary}** exactly ${dayString}. You don't have any study sessions scheduled for it. Would you like me to find a time for us to sit down and prepare?`;

                        // Send message
                        const phoneNumberId = client.info.wid._serialized;
                        await client.sendMessage(phoneNumberId, msgStr);

                        // Log message in AI Context
                        await supabase.from('agent_messages').insert({
                            user_id: userId,
                            content: msgStr,
                            type: 'whatsapp_message_outbound',
                            metadata: {
                                to: phoneNumberId,
                                timestamp: new Date().toISOString(),
                                proactive_reason: 'upcoming_test'
                            }
                        });

                        // Update status so we don't spam
                        await supabase
                            .from('calendar_events')
                            .update({ proactive_outreach_status: 'sent' })
                            .eq('id', test.id);
                    } else {
                        // Study sessions exist, mark as handled so we don't keep picking it up
                        await supabase
                            .from('calendar_events')
                            .update({ proactive_outreach_status: 'none' })
                            .eq('id', test.id);
                    }
                }
            }
        }, 60 * 60 * 1000); // 1 hour
    });

    client.on('message', async (msg: any) => {
        console.log(`[WhatsApp Service] Message received: ${msg.body}`);

        // Store the message as an 'action' or 'context' for the AI
        await supabase
            .from('agent_messages')
            .insert({
                user_id: userId,
                content: msg.body,
                type: 'whatsapp_message',
                metadata: {
                    from: msg.from,
                    timestamp: new Date().toISOString()
                }
            });

        // Optional: If the message is for the AI, trigger a processing event
    });

    client.on('disconnected', async (reason: string) => {
        console.log('[WhatsApp Service] Client disconnected:', reason);

        await supabase
            .from('whatsapp_connection')
            .update({
                status: 'disconnected',
                qr_code: null,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
    });

    try {
        await client.initialize();
    } catch (err) {
        console.error('[WhatsApp Service] Initialization error:', err);
    }
}

// For this demo, we assume the first user for simplicity.
// In a real production app, this would be a manager that handles multiple clients.
async function main() {
    const { data: users } = await supabase.from('user_preferences').select('user_id');
    if (users && users.length > 0) {
        // Start for all users who have requested a connection
        for (const user of users) {
            const { data: conn } = await supabase
                .from('whatsapp_connection')
                .select('status')
                .eq('user_id', user.user_id)
                .single();

            if (conn && conn.status === 'connecting' || conn?.status === 'connected') {
                runService(user.user_id);
            }
        }
    }
}

main();
