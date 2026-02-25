import DOMPurify from 'dompurify';
import { compressImage } from './mediaUtils';

// We dynamically import these to avoid breaking Next.js SSR since they depend on window/browser APIs
// Or we just rely on standard imports if we ensure this file is ONLY called client-side.
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up the PDF.js worker. Since we are in Next.js, pointing to the CDN is the most robust client-side approach
// without needing complex Webpack aliases just for the worker.
if (typeof window !== 'undefined' && 'Worker' in window) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export type ExtractedDocument = {
    text: string;
    images: string[];
};

/**
 * Generates a SHA-256 hash of the provided text string using the Web Crypto API.
 */
export async function generateContentHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts raw string text and compressed images from a PDF entirely on the client.
 */
export async function extractFromPDF(file: File): Promise<ExtractedDocument> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const optimizedImages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);

        // 1. Extract Text
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items.map((item: any) => item.str);
        fullText += pageStrings.join(' ') + '\n';

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
                    // Convert internal PDF.js Image object to a Canvas -> Base64
                    if (imageObj && imageObj.width && imageObj.height) {
                        const canvas = document.createElement('canvas');
                        canvas.width = imageObj.width;
                        canvas.height = imageObj.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            // Determine format
                            const imgData = new ImageData(
                                new Uint8ClampedArray(imageObj.data.buffer),
                                imageObj.width,
                                imageObj.height
                            );
                            ctx.putImageData(imgData, 0, 0);

                            // Compress via our core utility
                            const compressedDataUrl = await compressImage(canvas.toDataURL('image/jpeg'));
                            optimizedImages.push(compressedDataUrl);
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to extract an image on page ${pageNum}`, e);
                }
            }
        }
    }

    return {
        text: fullText.trim(),
        images: optimizedImages,
    };
}

/**
 * Extracts raw string text and compressed images from a DOCX entirely on the client.
 */
export async function extractFromDocx(file: File): Promise<ExtractedDocument> {
    const arrayBuffer = await file.arrayBuffer();

    const optimizedImages: string[] = [];

    // Custom image converter for mammoth that catches the image buffer 
    // and pipes it through our compression utility
    // @ts-ignore - Mammoth types missing "inline"
    const imageHandler = mammoth.images.inline(async (element: any) => {
        return element.read("base64").then(async (imageBuffer: any) => {
            const mimeType = element.contentType || "image/jpeg";
            const dataUri = `data:${mimeType};base64,${imageBuffer}`;

            try {
                const compressed = await compressImage(dataUri);
                optimizedImages.push(compressed);

                // Mammoth requires returning an object with the src for the generated HTML.
                // Even though we mostly care about the text, we return the src just in case
                return { src: compressed };
            } catch (e) {
                console.error("Failed to compress word document image", e);
                return { src: dataUri };
            }
        });
    });

    // Extract HTML first (which triggers the imageHandler)
    const resultHTML = await mammoth.convertToHtml(
        { arrayBuffer },
        { convertImage: imageHandler }
    );

    // Extract raw text
    const resultText = await mammoth.extractRawText({ arrayBuffer });

    return {
        text: resultText.value.trim(),
        images: optimizedImages,
    };
}

/**
 * Strips tracking code, nasty scripts, and bloated attributes from pasted HTML
 */
export function sanitizeHTML(dirtyHtml: string): string {
    return DOMPurify.sanitize(dirtyHtml, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'li', 'ol', 'br', 'span', 'div', 'table', 'tr', 'td', 'th', 'tbody', 'thead'],
        ALLOWED_ATTR: ['href', 'target'], // keep it strictly semantic
    });
}
