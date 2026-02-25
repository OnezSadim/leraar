export interface Subject {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export interface Material {
    id: string;
    user_id?: string;
    subject_id: string;
    chapter_id?: string;
    title: string;
    description?: string;
    /** @deprecated use description */
    overview?: string;
    content?: string;
    content_text?: string;
    content_hash?: string;
    media_urls?: string[];
    video_source?: string;
    file_type?: string;
    sort_order?: number;
    segments?: unknown[];
    deltas?: unknown[];
    subject_tags?: string[];
    education_system_tags?: string[];
    practice_questions?: {
        question: string;
        answer: string;
    }[];
    original_material_id?: string | null;
    sync_original_updates?: boolean;
    upvotes?: number;
    downvotes?: number;
    helped_me_pass?: number;
    fork_count?: number;
    trust_score?: number;
    created_at: string;
}

export interface MaterialGroup {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    materials?: Material[];
}

export interface MaterialGroupItem {
    group_id: string;
    material_id: string;
}
