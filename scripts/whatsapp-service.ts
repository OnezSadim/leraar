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
