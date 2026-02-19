export interface Subject {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export interface Material {
    id: string;
    subject_id: string;
    title: string;
    overview: string;
    content: string;
    practice_questions: {
        question: string;
        answer: string;
    }[];
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
