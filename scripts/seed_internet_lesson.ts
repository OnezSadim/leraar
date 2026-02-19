import { preprocessMaterial } from '../src/lib/ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role for bypass RLS if needed, or just regular key if RLS allows
);

const INTERNET_LESSON = {
    title: "The Internet: A Web of Global Connections",
    content: `
    The internet is a global network of computers that communicate with each other using standardized protocols. 
    At its core, it's about moving data from point A to point B.
    
    1. IP Addresses and Packets:
    Every device on the internet has a unique address called an IP (Internet Protocol) address. Data is broken down into small chunks called "packets" before being sent. Each packet has a header containing the source and destination IP addresses.
    
    2. Routing and DNS:
    Routers are specialized computers that direct packets across the network. To make the internet human-friendly, we use DNS (Domain Name System), which acts like a phonebook, translating names like 'google.com' into IP addresses.
    
    3. HTTP and the World Wide Web:
    The World Wide Web (WWW) is just one service that runs on top of the internet. It uses the HTTP (Hypertext Transfer Protocol) to request and send web pages.
    
    4. Physical Infrastructure:
    The internet isn't magic; it's physical. It relies on massive undersea fiber-optic cables, data centers, and wireless towers to transmit signals at the speed of light.
  `
};

async function run() {
    console.log("Starting preprocessing for:", INTERNET_LESSON.title);

    // 1. Insert Material
    const { data: material, error: mError } = await supabase
        .from('materials')
        .insert({
            subject_id: 'cs',
            title: INTERNET_LESSON.title,
            overview: "Deep dive into IP, DNS, Routing, and the physical web.",
            content: INTERNET_LESSON.content,
        })
        .select()
        .single();

    if (mError) {
        console.error("Error inserting material:", mError);
        return;
    }

    console.log("Material created:", material.id);

    // 2. Preprocess with AI
    const sectioned = await preprocessMaterial(INTERNET_LESSON.title, INTERNET_LESSON.content);
    console.log(`AI split material into ${sectioned.sections.length} sections.`);

    // 3. Insert Sections and Questions
    for (let i = 0; i < sectioned.sections.length; i++) {
        const s = sectioned.sections[i];
        const { data: section, error: sError } = await supabase
            .from('material_sections')
            .insert({
                material_id: material.id,
                title: s.title,
                content: s.content,
                order_index: i,
                estimated_time_seconds: s.estimatedTimeSeconds || 300,
                concepts_covered: s.concepts
            })
            .select()
            .single();

        if (sError) {
            console.error("Error inserting section:", sError);
            continue;
        }

        console.log(`Inserted section: ${s.title}`);

        for (const q of s.questions) {
            await supabase.from('section_questions').insert({
                section_id: section.id,
                question_type: q.type,
                question_text: q.text,
                options: q.options || [],
                correct_answer: q.answer,
                concepts_tested: q.concepts
            });
        }
    }

    console.log("Preprocessing complete!");
}

run();
