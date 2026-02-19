/**
 * Simple Magister API client implementation.
 * Note: Magister 6 API uses OIDC/OAuth2 for authentication.
 */

export interface MagisterDeadline {
    id: number;
    title: string;
    description: string;
    start: string;
    end: string;
    type: string; // e.g., 'huiswerk', 'toets'
}

export class MagisterClient {
    private baseUrl: string;
    private token: string | null = null;

    constructor(baseUrl: string) {
        // Ensure baseUrl is something like school.magister.net
        this.baseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
        if (!this.baseUrl.endsWith('/api')) {
            this.baseUrl = `${this.baseUrl}/api`;
        }
    }

    /**
     * Authenticates with Magister.
     * In a real scenario, this involves a complex OIDC flow.
     * For this implementation, we assume we might need to handle basic or a simpler flow
     * if provided credentials allow it, or just use the storage.
     */
    async login(username: string, password: string): Promise<boolean> {
        // This is a placeholder for the actual login logic which is non-trivial for Magister
        // (often requiring browser-based interaction or specific mobile API keys).
        // For the sake of this integration, we'll simulate the token acquisition.
        console.log(`[Magister] Attempting login for ${username} at ${this.baseUrl}`);

        // Realistic Magister 6 login is complex. Most wrappers use a token from a previous session
        // or a specific mobile endpoint. We'll set a mock token for now to show the flow.
        this.token = 'MOCK_MAGISTER_TOKEN';
        return true;
    }

    async getDeadlines(from: Date, until: Date): Promise<MagisterDeadline[]> {
        if (!this.token) throw new Error('Not authenticated');

        const fromStr = from.toISOString().split('T')[0];
        const untilStr = until.toISOString().split('T')[0];

        // Endpoint for 'afspraken' (appointments)
        const url = `${this.baseUrl}/personen/me/afspraken?van=${fromStr}&tot=${untilStr}`;

        try {
            // Real fetch would be:
            // const response = await fetch(url, { headers: { 'Authorization': `Bearer ${this.token}` } });
            // const data = await response.json();

            // Mocking the response for development/verification
            console.log(`[Magister] Fetching deadlines from ${url}`);

            return [
                {
                    id: 101,
                    title: 'Wiskunde Toets: Hoofdstuk 4',
                    description: 'Differentiequotiënten en hellingen.',
                    start: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
                    end: new Date(Date.now() + 86400000 * 2 + 3600000).toISOString(),
                    type: 'Toets'
                },
                {
                    id: 102,
                    title: 'Geschiedenis Verslag: Koude Oorlog',
                    description: 'Inleveren voor 17:00.',
                    start: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
                    end: new Date(Date.now() + 86400000 * 5).toISOString(),
                    type: 'Huiswerk'
                }
            ];
        } catch (error) {
            console.error('[Magister] Error fetching deadlines:', error);
            return [];
        }
    }
}
