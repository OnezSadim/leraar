import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

// Maximum file size: 20 MB
const MAX_SIZE = 20 * 1024 * 1024

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const mimeType = file.type
        const fileName = file.name.toLowerCase()

        let text = ''

        // --- Word documents (.docx) ---
        if (
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileName.endsWith('.docx')
        ) {
            const result = await mammoth.extractRawText({ buffer })
            text = result.value
        }

        // --- Legacy Word (.doc) — mammoth also handles these ---
        else if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
            try {
                const result = await mammoth.extractRawText({ buffer })
                text = result.value
            } catch {
                return NextResponse.json({ error: 'This .doc file format is not fully supported. Try saving as .docx first.' }, { status: 422 })
            }
        }

        // --- PDF --- 
        else if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
            // Use pdfjs-dist (legacy build for Node.js compatibility)
            // We dynamically import to avoid SSR issues
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
            const pdf = await loadingTask.promise

            const pageTexts: string[] = []
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i)
                const content = await page.getTextContent()
                const pageText = content.items
                    .filter((item) => 'str' in item && typeof (item as { str?: unknown }).str === 'string')
                    .map(item => (item as { str: string }).str)
                    .join(' ')
                pageTexts.push(pageText)
            }
            text = pageTexts.join('\n\n')
        }

        // --- ODT (OpenDocument Text) ---
        else if (
            mimeType === 'application/vnd.oasis.opendocument.text' ||
            fileName.endsWith('.odt')
        ) {
            // mammoth does not support ODT directly — return a helpful message
            return NextResponse.json({
                error: 'ODT files are not yet directly supported. Please save as .docx or .pdf first.'
            }, { status: 422 })
        }

        // --- Plain text / Markdown ---
        else if (
            mimeType.startsWith('text/') ||
            fileName.endsWith('.txt') ||
            fileName.endsWith('.md')
        ) {
            text = buffer.toString('utf-8')
        }

        // --- Images — return empty; client should handle with AI vision if needed ---
        else if (mimeType.startsWith('image/')) {
            return NextResponse.json({
                error: 'Image files: please paste the text content manually, or use the Gemini AI chat to analyze images.'
            }, { status: 422 })
        }

        else {
            return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 415 })
        }

        if (!text.trim()) {
            return NextResponse.json({ error: 'Could not extract any text from this file. It may be image-based or password-protected.' }, { status: 422 })
        }

        return NextResponse.json({ text: text.trim() })
    } catch (err: unknown) {
        console.error('[extract-text] Error:', err)
        const message = err instanceof Error ? err.message : 'Internal server error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
