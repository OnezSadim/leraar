import { saveResearchLog } from './actions/analytics-actions';

// Use Web Crypto API to hash strings client-side
async function hashStringSHA256(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface QuizResultEvent {
    concept?: string;
    correct: boolean;
    newScore?: number;
    timestamp: number;
}

interface AnalyticsSession {
    studentId: string;
    materialId: string;
    pluginName: string;
    startTime: number;
    quizResults: QuizResultEvent[];
}

const STORAGE_KEY_PREFIX = 'leraar_analytics_session_';

export class ClientAnalyticsLogger {
    private sessionId: string;
    private sessionData: AnalyticsSession | null = null;

    constructor(materialId: string, pluginName: string, studentId: string) {
        this.sessionId = `${materialId}_${pluginName}`;

        // Attempt to recover an interrupted session from sessionStorage
        const existingData = sessionStorage.getItem(STORAGE_KEY_PREFIX + this.sessionId);
        if (existingData) {
            try {
                this.sessionData = JSON.parse(existingData);
            } catch (e) {
                console.error('Failed to parse existing analytics session data', e);
            }
        }

        if (!this.sessionData) {
            this.sessionData = {
                studentId,
                materialId,
                pluginName,
                startTime: Date.now(),
                quizResults: []
            };
            this.saveToStorage();
        }
    }

    private saveToStorage() {
        if (this.sessionData) {
            sessionStorage.setItem(STORAGE_KEY_PREFIX + this.sessionId, JSON.stringify(this.sessionData));
        }
    }

    public logQuizResult(event: Omit<QuizResultEvent, 'timestamp'>) {
        if (!this.sessionData) return;

        this.sessionData.quizResults.push({
            ...event,
            timestamp: Date.now()
        });

        this.saveToStorage();
    }

    public async finishSession() {
        if (!this.sessionData) return;

        const durationSeconds = Math.floor((Date.now() - this.sessionData.startTime) / 1000);

        // Hash the student ID locally before sending it across the network
        const hashedStudentId = await hashStringSHA256(this.sessionData.studentId);

        // Call the server action to persist to the DB
        saveResearchLog(
            hashedStudentId,
            this.sessionData.materialId,
            this.sessionData.pluginName,
            durationSeconds,
            this.sessionData.quizResults
        );

        // Clear local storage
        sessionStorage.removeItem(STORAGE_KEY_PREFIX + this.sessionId);
        this.sessionData = null;
    }
}
