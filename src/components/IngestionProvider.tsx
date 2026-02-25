"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { extractFromPDF, extractFromDocx, Segment } from "@/lib/chunkingUtils";
import { compressImage, extractVideoThumbnail } from "@/lib/mediaUtils";
import { generateContentHash } from "@/lib/documentUtils";
import { checkDuplicates, DuplicateMatch } from "@/app/actions/checkDuplicates";

export type ProcessStatus = "idle" | "processing" | "done" | "error";
export type FileType = "pdf" | "word" | "image" | "video" | "text" | "unknown";

export interface IngestionItem {
    id: string;
    originalName: string;
    type: FileType;
    status: ProcessStatus;
    progressMessage: string;
    description: string;
    contentText: string;
    images: string[]; // Base64 strings
    videoSourceUrl?: string; // Captured if it's a video
    segments: Segment[]; // Semantic chunks for the preview UI
    contentHash?: string; // SHA-256 hash of extracted text
    duplicateMatches?: DuplicateMatch[]; // Populated if server detects collisions
    originalMaterialId?: string; // Added if user chooses to Fork
    subjectTags: string[];
    educationSystemTags: string[];
}

interface IngestionContextType {
    items: IngestionItem[];
    addFiles: (files: File[]) => void;
    updateItemDescription: (id: string, description: string) => void;
    updateVideoUrl: (id: string, url: string) => void;
    updateItemSegments: (id: string, segments: Segment[]) => void;
    updateItemTags: (id: string, type: 'subject' | 'educationSystem', tags: string[]) => void;
    updateOriginalMaterialId: (id: string, originalId: string | null) => void;
    removeItem: (id: string) => void;
    reorderItems: (startIndex: number, endIndex: number) => void;
}

const IngestionContext = createContext<IngestionContextType | undefined>(undefined);

export function IngestionProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<IngestionItem[]>([]);

    // Internal helper to update a specific item
    const updateItem = (id: string, updates: Partial<IngestionItem>) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    };

    const getFileType = (file: File): FileType => {
        if (file.type === "application/pdf") return "pdf";
        if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith(".docx")) return "word";
        if (file.type.startsWith("image/")) return "image";
        if (file.type.startsWith("video/")) return "video";
        if (file.type === "text/plain") return "text";
        return "unknown";
    };

    const processFileBackground = async (file: File, id: string, type: FileType) => {
        try {
            updateItem(id, { status: "processing", progressMessage: "Analyzing file type..." });

            if (type === "pdf") {
                updateItem(id, { progressMessage: "Extracting text and media from PDF..." });
                const { text, images, segments } = await extractFromPDF(file);
                const contentHash = await generateContentHash(text);
                updateItem(id, { contentText: text, images, segments, contentHash, status: "done", progressMessage: "PDF Extracted" });

                // Fire async duplicate check
                checkDuplicates(contentHash, file.name).then(matches => {
                    if (matches.length > 0) updateItem(id, { duplicateMatches: matches });
                });
            }

            else if (type === "word") {
                updateItem(id, { progressMessage: "Parsing DOCX contents..." });
                const { text, images, segments } = await extractFromDocx(file);
                const contentHash = await generateContentHash(text);
                updateItem(id, { contentText: text, images, segments, contentHash, status: "done", progressMessage: "Word Doc Extracted" });

                checkDuplicates(contentHash, file.name).then(matches => {
                    if (matches.length > 0) updateItem(id, { duplicateMatches: matches });
                });
            }

            else if (type === "image") {
                updateItem(id, { progressMessage: "Optimizing image client-side..." });
                const optimized = await compressImage(file);
                updateItem(id, { images: [optimized], status: "done", progressMessage: "Image Compressed" });
            }

            else if (type === "video") {
                updateItem(id, { progressMessage: "Extracting video poster frame..." });
                const thumbnail = await extractVideoThumbnail(file);
                updateItem(id, { images: [thumbnail], status: "done", progressMessage: "Video Thumbnail Captured. Awaiting URL." });
            }

            else if (type === "text") {
                const text = await file.text();
                const defaultSegment: Segment = { id: crypto.randomUUID(), type: "content", text };
                const contentHash = await generateContentHash(text);
                updateItem(id, { contentText: text, segments: [defaultSegment], contentHash, status: "done", progressMessage: "Text loaded" });

                checkDuplicates(contentHash, file.name).then(matches => {
                    if (matches.length > 0) updateItem(id, { duplicateMatches: matches });
                });
            }

            else {
                throw new Error("Unsupported file type");
            }
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            updateItem(id, { status: "error", progressMessage: `Failed: ${error instanceof Error ? error.message : "Unknown error"}` });
        }
    };

    const addFiles = useCallback((files: File[]) => {
        const newItems: IngestionItem[] = files.map((file) => {
            const type = getFileType(file);
            return {
                id: crypto.randomUUID(),
                originalName: file.name,
                type,
                status: "idle",
                progressMessage: "Queued",
                description: "",
                contentText: "",
                contentHash: "",
                duplicateMatches: [],
                images: [],
                segments: [],
                subjectTags: [],
                educationSystemTags: [],
            };
        });

        setItems((prev) => [...prev, ...newItems]);

        // Kick off background processing asynchronously for each file
        newItems.forEach((item, idx) => {
            const file = files[idx];
            processFileBackground(file, item.id, item.type);
        });
    }, []);

    const updateItemDescription = useCallback((id: string, description: string) => {
        updateItem(id, { description });
    }, []);

    const updateVideoUrl = useCallback((id: string, url: string) => {
        updateItem(id, { videoSourceUrl: url });
    }, []);

    const updateItemSegments = useCallback((id: string, segments: Segment[]) => {
        updateItem(id, { segments });
    }, []);

    const updateItemTags = useCallback((id: string, type: 'subject' | 'educationSystem', tags: string[]) => {
        if (type === 'subject') {
            updateItem(id, { subjectTags: tags });
        } else {
            updateItem(id, { educationSystemTags: tags });
        }
    }, []);

    const updateOriginalMaterialId = useCallback((id: string, originalId: string | null) => {
        if (originalId) {
            updateItem(id, { originalMaterialId: originalId, duplicateMatches: [] }); // Clear matches once resolved
        } else {
            updateItem(id, { originalMaterialId: undefined });
        }
    }, []);

    const removeItem = useCallback((id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const reorderItems = useCallback((startIndex: number, endIndex: number) => {
        setItems((prev) => {
            const result = Array.from(prev);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return result;
        });
    }, []);

    return (
        <IngestionContext.Provider value={{ items, addFiles, updateItemDescription, updateVideoUrl, updateItemSegments, updateItemTags, updateOriginalMaterialId, removeItem, reorderItems }}>
            {children}
        </IngestionContext.Provider>
    );
}

export function useIngestion() {
    const context = useContext(IngestionContext);
    if (context === undefined) {
        throw new Error("useIngestion must be used within an IngestionProvider");
    }
    return context;
}
