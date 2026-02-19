import { GoogleGenerativeAI } from '@google/generative-ai';

const defaultGenAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
const defaultModel = defaultGenAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' }
});

function getModel(apiKey?: string) {
    if (!apiKey) return defaultModel;
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: 'application/json' }
    });
}

export interface LearningBlock {
    id: string;
    type: 'content' | 'question' | 'open_question' | 'action';
    text: string;
    options?: string[];
    answer?: string;
    action?: 'load_section' | 'load_question';
    sectionId?: string;
    concepts?: string[];
    timeEstimateRemaining?: string; // e.g. "4:30"
}

export interface SectionQuestion {
    text: string;
    type: 'mcq' | 'open';
    options?: string[];
    answer: string;
    concepts: string[];
}

export interface Section {
    title: string;
    content: string;
    concepts: string[];
    questions: SectionQuestion[];
    estimatedTimeSeconds: number;
}

export interface SectionedMaterial {
    sections: Section[];
}

async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 2000
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isRetryable =
                error.message?.includes('429') ||
                error.status === 429 ||
                error.message?.includes('503') ||
                error.status === 503;

            if (isRetryable && i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                console.warn(`[Leraar AI] Brain is Busy (Error: ${error.status || '429'}). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

/**
 * Preprocesses raw material content into logical sections with associated questions and time estimates.
 */
export async function preprocessMaterial(
    title: string,
    content: string,
    apiKey?: string,
    providedQuestions: { question: string, answer: string }[] = []
): Promise<SectionedMaterial> {
    const questionsPrompt = providedQuestions.length > 0
        ? `I have some pre-written questions. Please distribute them into the relevant sections or use them as inspiration for the questions you generate:\n${JSON.stringify(providedQuestions, null, 2)}`
        : '';

    const prompt = `
    You are an expert curriculum designer. 
    Split the following educational material into logical sections. 
    For each section:
    1. Give it a title.
    2. Extract/Rewrite the core content (bite-sized).
    3. Identify 2-3 key concepts.
    4. Provide 2 questions (MCQ and Open). If I provided questions below, use them for the relevant sections.
    5. Estimate the time in SECONDS it will take an average student to master this section (reading + answering questions).

    ${questionsPrompt}

    Material Title: ${title}
    Material Content:
    ${content}

    RETURN ONLY A JSON OBJECT matching this schema:
    {
      "sections": [
        {
          "title": "string",
          "content": "string",
          "concepts": ["string"],
          "estimatedTimeSeconds": number,
          "questions": [
            { "text": "string", "type": "mcq", "options": ["string"], "answer": "string", "concepts": ["string"] },
            { "text": "string", "type": "open", "answer": "string", "concepts": ["string"] }
          ]
        }
      ]
    }
    `;

    const text = await withRetry(async () => {
        const model = getModel(apiKey);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    });

    const jsonStr = text.replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // Fallback: search for the first { and last }
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            return JSON.parse(jsonStr.substring(start, end + 1));
        }
        throw e;
    }
}

/**
 * Grades an open-ended answer.
 */
export async function gradeOpenAnswer(
    question: string,
    rubric: string,
    userAnswer: string,
    apiKey?: string
): Promise<{ isCorrect: boolean; feedback: string; masteredConcepts: string[] }> {
    const prompt = `
    You are a fair and encouraging teacher. Grade the user's answer to the following question based on the provided rubric.
    
    Question: ${question}
    Rubric: ${rubric}
    User Answer: ${userAnswer}

    Instructions:
    1. Determine if the user has demonstrated understanding (isCorrect: true/false).
    2. Provide constructive, brief feedback.
    3. List the concepts the user has shown mastery of if they are correct.

    RETURN ONLY JSON:
    {
      "isCorrect": boolean,
      "feedback": "string",
      "masteredConcepts": ["string"]
    }
    `;

    const text = await withRetry(async () => {
        const model = getModel(apiKey);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    });

    const jsonStr = text.replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            return JSON.parse(jsonStr.substring(start, end + 1));
        }
        throw e;
    }
}

export async function generateLearningBlocks(
    materialTitle: string,
    knowledgeMap: Record<string, string>,
    currentSessionState: {
        lastSectionId?: string;
        sectionsRemaining: { title: string; estimatedSeconds: number }[];
        predictionsHistory: { timestamp: string; predictedRemainingSeconds: number }[];
        startTime: string;
    },
    history: LearningBlock[] = [],
    userAssessment?: string,
    apiKey?: string
): Promise<LearningBlock[]> {
    const isInitial = history.length === 0;

    const prompt = `
    You are Leraar AI, a premium learning assistant.
    Material: ${materialTitle}
    
    User Knowledge Roadmap:
    ${JSON.stringify(knowledgeMap, null, 2)}
    
    User Self-Assessment:
    ${userAssessment || 'None provided'}
    
    Session Progress:
    Remaining sections (USE THESE IDs): ${JSON.stringify(currentSessionState.sectionsRemaining)}
    Previous predictions: ${JSON.stringify(currentSessionState.predictionsHistory)}
    Session started at: ${currentSessionState.startTime}

    Conversation History (Last 5 blocks):
    ${history.map(b => `[${b.type}] ID: ${b.id} - ${b.text.substring(0, 100)}...`).join('\n')}

    Goal: Decide the next logical step and provide an updated time estimation.
    
    CRITICAL RULES:
    1. If you want to teach a concept from the "Remaining sections" list, you MUST return an 'action' block with "action": "load_section" and the correct "sectionId" from the list above.
    2. CONSULT THE USER KNOWLEDGE ROADMAP. If a section covers concepts the user has already mastered, SKIP it and explain why (briefly).
    3. DO NOT write your own long explanations if a section in the list covers the topic. Use the sections!
    4. Use 'content' blocks only for brief transitions, feedback, or "connective tissue" between sections.
    5. NEVER repeat content already in history.
    6. NEVER use a duplicate ID. Generate a unique, random string for each block ID.
    
    Output Format:
    Return a JSON array of blocks.
    
    [{
      "id": "unique_string",
      "type": "content" | "question" | "open_question" | "action",
      "text": "Brief bridge/intro text (if content type) or empty",
      "timeEstimateRemaining": "M:SS",
      "action": "load_section",
      "sectionId": "THE_ID_FROM_THE_REMAINING_SECTIONS_LIST"
    }]
  `;

    try {
        console.log('--- Calling Gemini AI ---');
        const text = await withRetry(async () => {
            const model = getModel(apiKey);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        });

        const jsonStr = text.replace(/```json|```/g, '').trim();
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            const start = jsonStr.indexOf('[');
            const end = jsonStr.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                return JSON.parse(jsonStr.substring(start, end + 1));
            }
            throw e;
        }
    } catch (error: any) {
        return [{
            id: Date.now().toString(),
            type: 'content',
            text: `Brain fog encountered. (Error: ${error.message?.substring(0, 50)})`
        }];
    }
}
