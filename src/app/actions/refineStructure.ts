"use server";

import { getModel, withRetry } from "@/lib/ai";
import { Segment } from "@/lib/chunkingUtils";

export async function refineStructureWithAI(rawText: string, apiKey?: string): Promise<Segment[]> {
    const prompt = `
    You are an expert document structural parser. I have extracted raw text from a document.
    Your job is to identify the logical sections (e.g., Chapters, Modules, Weeks, Lessons, or just generic Headers) and the content blocks beneath them.

    Format the result EXACTLY using this recursive schema. Return a JSON array of "Segment" objects.
    
    type SegmentType = "heading" | "content";

    interface Segment {
      id: string; // generate a random unique ID (e.g. UUID)
      type: SegmentType; 
      title?: string; // If type is "heading", what is the title?
      text?: string;  // If type is "content", what is the raw text block?
      children?: Segment[]; // If type is "heading", put the content blocks or sub-headings inside here
    }

    Rules:
    - Never summarize or rewrite the text. Copy the original text exactly.
    - Group paragraphs into logical "heading" wrappers based on the natural flow of the document.
    - If there are no obvious headers, just return an array of "content" segments.
    - RETURN ONLY VALID JSON. No markdown ticks, no extra chat.

    Raw Document Text:
    ${rawText.substring(0, 15000)} // Limit to prevent massive payload issues
    `;

    try {
        const text = await withRetry(async () => {
            const model = getModel(apiKey);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        });

        const jsonStr = text.replace(/```json|```/g, '').trim();
        let segments = [];
        try {
            segments = JSON.parse(jsonStr);
        } catch (e) {
            const start = jsonStr.indexOf('[');
            const end = jsonStr.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                segments = JSON.parse(jsonStr.substring(start, end + 1));
            } else {
                throw e;
            }
        }
        return segments;
    } catch (error: any) {
        console.error("AI Refinement failed:", error);
        throw new Error("AI failed to refine the document structure.");
    }
}
