import { MagisterClient, MagisterDeadline } from '../src/lib/magister';

// Mock Supabase Client for Testing
const mockSupabase = {
    from: (table: string) => ({
        select: (cols: string) => ({
            eq: (col: string, val: any) => ({
                single: async () => {
                    if (table === 'user_preferences') {
                        return { data: { magister_url: 'school.magister.net', magister_username: 'zeno', magister_password: 'password123' } };
                    }
                    if (table === 'study_queue') {
                        return { data: null }; // Simulate no existing deadline
                    }
                    return { data: null };
                }
            })
        }),
        insert: (data: any) => ({
            select: () => ({
                single: async () => ({ data: { id: 'new-queue-item-id', ...data }, error: null })
            }),
            then: (cb: any) => cb({ error: null })
        })
    })
};

async function testSyncLogic() {
    console.log('--- STARTING MAGISTER SYNC TEST ---');

    // 1. Initialize Client
    const prefs = { magister_url: 'school.magister.net', magister_username: 'zeno', magister_password: 'password123' };
    console.log('Using Preferences:', { ...prefs, magister_password: '****' });

    const client = new MagisterClient(prefs.magister_url);
    const loggedIn = await client.login(prefs.magister_username, prefs.magister_password);
    console.log('Login successful:', loggedIn);

    const deadlines = await client.getDeadlines(new Date(), new Date());
    console.log(`Fetched ${deadlines.length} deadlines.`);

    for (const deadline of deadlines) {
        console.log(`\nProcessing Deadline: ${deadline.title}`);

        // Mocking the check and insert flow
        const testInfo = `${deadline.title} (${deadline.type})`;
        console.log(`Checking if "${testInfo}" exists in study_queue...`);

        // Simulate insertion
        console.log(`[ACTION] Inserting into study_queue: ${testInfo}`);

        // Trigger Accountability Agent Task
        const agentMessage = {
            content: `I've detected a new deadline from Magister: "${deadline.title}". Would you like me to be your accountability agent for this? I can help you plan your study sessions and check in on your progress.`,
            type: 'accountability_request',
            metadata: {
                deadline_id: deadline.id,
                queue_item_id: 'mocked-id',
                title: deadline.title,
                due_date: deadline.start
            }
        };

        console.log(`[ACTION] Creating AGENT MESSAGE:`);
        console.log(`  Type: ${agentMessage.type}`);
        console.log(`  Content: ${agentMessage.content}`);
    }

    console.log('\n--- SYNC TEST COMPLETE ---');
}

testSyncLogic().catch(console.error);
