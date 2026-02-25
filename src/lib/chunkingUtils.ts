import DOMPurify from 'dompurify';
import { compressImage } from './mediaUtils';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

export type SegmentType = "heading" | "content" | string; // Allows "Module", "Week", "Chapter", etc.

export interface Segment {
    id: string; // unique ID for sortable mapping
    type: SegmentType;
    title?: string; // Only for heading/wrapper types
    text?: string;  // For actual content blocks
    metadata?: { page?: number; originalFontSize?: number };
    children?: Segment[]; // A heading can contain child segments (content blocks, or sub-headings)
}

export type ExtractedDocument = {
    text: string;
    images: string[];
    segments: Segment[];
};

// --- PDF Parsing Logic ---

export async function extractFromPDF(file: File): Promise<ExtractedDocument> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const optimizedImages: string[] = [];
    const segments: Segment[] = [];

    let currentHeader: Segment | null = null;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);

        // 1. Extract Text & Detect Headers
        const textContent = await page.getTextContent();
        let currentParagraphBlocks: string[] = [];

        // We try to find the "base" font size for body text vs headers
        // 12px height is commonly standard text. Anything > 1.5x could be a header.
        for (const item of textContent.items as any[]) {
            const text = item.str.trim();
            if (!text) continue;

            fullText += text + ' ';

            const transform = item.transform;
            // transform[3] represents the approximated font height/size
            const fontSize = Math.abs(transform[3]);

            if (fontSize > 16) {
                // Suspected Header
                // Flush any trailing paragraph into current header or root
                if (currentParagraphBlocks.length > 0) {
                    const pText = currentParagraphBlocks.join(' ').trim();
                    const newContent: Segment = { id: crypto.randomUUID(), type: "content", text: pText, metadata: { page: pageNum } };
                    if (currentHeader && currentHeader.children) {
                        currentHeader.children.push(newContent);
                    } else {
                        segments.push(newContent);
                    }
                    currentParagraphBlocks = [];
                }

                // Start new header
                currentHeader = {
                    id: crypto.randomUUID(),
                    type: "heading",
                    title: text,
                    children: []
                };
                segments.push(currentHeader);
            } else {
                // Standard body text
                currentParagraphBlocks.push(text);
            }
        }

        // End of page flush
        if (currentParagraphBlocks.length > 0) {
            const pText = currentParagraphBlocks.join(' ').trim();
            const newContent: Segment = { id: crypto.randomUUID(), type: "content", text: pText, metadata: { page: pageNum } };
            if (currentHeader && currentHeader.children) {
                currentHeader.children.push(newContent);
            } else {
                segments.push(newContent);
            }
        }

        // 2. Extract Images (Iterate through the operator list)
        const operatorList = await page.getOperatorList();
        for (let i = 0; i < operatorList.fnArray.length; i++) {
            if (
                operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject ||
                // @ts-ignore
                operatorList.fnArray[i] === pdfjsLib.OPS.paintJpegXObject
            ) {
                const imageName = operatorList.argsArray[i][0];
                try {
                    const imageObj = await page.objs.get(imageName);
                    if (imageObj && imageObj.width && imageObj.height) {
                        const canvas = document.createElement('canvas');
                        canvas.width = imageObj.width;
                        canvas.height = imageObj.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            const imgData = new ImageData(
                                new Uint8ClampedArray(imageObj.data.buffer),
                                imageObj.width,
                                imageObj.height
                            );
                            ctx.putImageData(imgData, 0, 0);
                            const compressedDataUrl = await compressImage(canvas.toDataURL('image/jpeg'));
                            optimizedImages.push(compressedDataUrl);
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to extract an image`, e);
                }
            }
        }
    }

    return {
        text: fullText.trim(),
        images: optimizedImages,
        segments
    };
}

// --- DOCX Parsing Logic ---

export async function extractFromDocx(file: File): Promise<ExtractedDocument> {
    const arrayBuffer = await file.arrayBuffer();
    const optimizedImages: string[] = [];

    // @ts-ignore - Mammoth types missing "inline" image handlers
    const imageHandler = mammoth.images.inline(async (element: any) => {
        return element.read("base64").then(async (imageBuffer: any) => {
            const mimeType = element.contentType || "image/jpeg";
            const dataUri = `data:${mimeType};base64,${imageBuffer}`;
            try {
                const compressed = await compressImage(dataUri);
                optimizedImages.push(compressed);
                return { src: compressed };
            } catch (e) {
                return { src: dataUri };
            }
        });
    });

    // Extract HTML first to parse structural tags
    const { value: resultHTML } = await mammoth.convertToHtml(
        { arrayBuffer },
        { convertImage: imageHandler }
    );

    // Parse HTML into Segments using native DOMParser (browser environment)
    const parser = new DOMParser();
    const doc = parser.parseFromString(resultHTML, 'text/html');
    const segments: Segment[] = [];
    let currentHeader: Segment | null = null;
    let fullText = '';

    const nodes = Array.from(doc.body.childNodes);
    for (const node of nodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();
            const text = el.textContent || '';

            if (!text.trim() && tag !== 'img') continue; // skip empty
            fullText += text + '\n\n';

            if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
                // Start a new heading segment
                currentHeader = {
                    id: crypto.randomUUID(),
                    type: "heading",
                    title: text.trim(),
                    children: []
                };
                segments.push(currentHeader);
            } else if (tag === 'p' || tag === 'ul' || tag === 'ol' || tag === 'table') {
                // We map paragraphs, lists, and tables to "content" chunks
                // To keep it clean, we'll store the innerHTML instead of flat text if they want to retain formatting,
                // but the spec asked for raw text semantic chunks.
                // However, to support safe editing, we'll store the sanitized text.
                const newContent: Segment = {
                    id: crypto.randomUUID(),
                    type: "content",
                    text: text.trim()
                };

                if (currentHeader && currentHeader.children) {
                    currentHeader.children.push(newContent);
                } else {
                    segments.push(newContent);
                }
            }
        }
    }

    return {
        text: fullText.trim(),
        images: optimizedImages,
        segments
    };
}

export function sanitizeHTML(dirtyHtml: string): string {
    return DOMPurify.sanitize(dirtyHtml, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'li', 'ol', 'br', 'span', 'div', 'table', 'tr', 'td', 'th', 'tbody', 'thead'],
        ALLOWED_ATTR: ['href', 'target'],
    });
}
