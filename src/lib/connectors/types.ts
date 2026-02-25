/**
 * School Connector Types
 *
 * Standard interface all school data connectors must implement.
 * This allows the AI to call a single unified `fetch_school_data` command
 * regardless of which school systems the user has connected.
 */

export interface SchoolAssignment {
    id: string;
    title: string;
    description: string | null;
    dueDate: string;          // ISO 8601
    subject: string | null;
    type: string | null;      // e.g. 'toets', 'huiswerk', 'exam'
    source: string;           // 'magister' | 'canvas' | 'google_classroom'
    isTest: boolean;
}

export interface SchoolConnector {
    /** Identifier matching the plugin's connector_type column */
    readonly type: string;
    /** Fetch upcoming assignments/tests for the given user */
    fetchData(userId: string): Promise<SchoolAssignment[]>;
}
