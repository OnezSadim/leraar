/**
 * Media optimization utilities to ensure heavy processing is done client-side
 * before any data hits the server.
 */

// Maximum dimensions for standard uploaded images
const MAX_IMAGE_WIDTH = 1200;
const JPEG_QUALITY = 0.7;

/**
 * Compresses and downscales an image file/blob to a base64 Data URI
 * optimized for storage and fast transmission.
 */
export async function compressImage(source: File | Blob | string): Promise<string> {
    return new Promise((resolve, reject) => {
        let objectUrl = '';
        const img = new Image();

        img.onload = () => {
            // Clean up object URL if we created one
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }

            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > MAX_IMAGE_WIDTH) {
                const ratio = MAX_IMAGE_WIDTH / width;
                width = MAX_IMAGE_WIDTH;
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // White background assuming JPEG output
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Return a base64 string optimized at 70% quality
            const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            resolve(dataUrl);
        };

        img.onerror = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image for compression.'));
        };

        // Handle different source types
        if (typeof source === 'string') {
            img.src = source;
        } else {
            objectUrl = URL.createObjectURL(source);
            img.src = objectUrl;
        }
    });
}

/**
 * Extracts a thumbnail from a video file at the 1-second mark using a temporary
 * video element. Prevents uploading the entire binary to the server.
 */
export async function extractVideoThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const objectUrl = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
            // Seek to 1 second or 50% of the video if it's super short
            video.currentTime = Math.min(1, video.duration / 2 || 0);
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

            URL.revokeObjectURL(objectUrl);
            resolve(thumbnailDataUrl);
        };

        video.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load video for thumbnail extraction.'));
        };

        video.src = objectUrl;
    });
}
