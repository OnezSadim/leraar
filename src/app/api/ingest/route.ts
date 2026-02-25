import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IngestionItem } from '@/components/IngestionProvider';

export async function POST(request: Request) {
    try {
        const supabase = await createClient(); // uses the project's standard app-router supabase client

        // Ensure the user is authenticated 
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { items, chapterId, subjectId } = body as {
            items: IngestionItem[],
            chapterId?: string,
            subjectId?: string
        };

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items provided' }, { status: 400 });
        }

        // Process items in order they were arranged in the UI
        const recordsToInsert = items.map((item, index) => {
            return {
                user_id: user.id,
                // Link to context if provided
                chapter_id: chapterId || null,
                subject_id: subjectId || null,

                // Core data
                title: item.originalName,
                description: item.description,
                content_text: item.contentText, // This allows for full-text search indexing on PG side
                media_urls: item.images, // We store base64 strings directly for now as per "client-side first" low-energy concept, but realistically these could be uploaded to S3/Supabase Storage.
                video_source: item.videoSourceUrl,
                file_type: item.type,

                // Tags
                subject_tags: item.subjectTags,
                education_system_tags: item.educationSystemTags,

                // Forking and Dupes
                original_material_id: item.originalMaterialId || null,
                content_hash: item.contentHash || null,

                // The explicit sort order from the drag-and-drop UI
                sort_order: index,

                created_at: new Date().toISOString()
            };
        });

        // Insert into a generic materials table. 
        // Depending on the exact schema established in previous chat context "Global Material Search", 
        // it likely uses 'materials' or 'study_materials'.
        const { data, error } = await supabase
            .from('materials')
            .insert(recordsToInsert)
            .select();

        if (error) {
            console.error("Supabase insert error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Successfully ingested ${items.length} materials.`,
            data
        }, { status: 200 });

    } catch (err: any) {
        console.error('Ingestion error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
