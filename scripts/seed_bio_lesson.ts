import { preprocessMaterial } from '../src/lib/ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BIO_LESSON = {
    title: "Cellular Respiration: Powering the Cell",
    content: `
    Cellular respiration is the process by which cells convert biochemical energy from nutrients into adenosine triphosphate (ATP). 
    It is a multi-step process that occurs primarily in the mitochondria, the "powerhouses" of the cell.

    1. Glycolysis:
    Occurs in the cytoplasm. A single molecule of glucose is broken down into two molecules of pyruvate, producing a net gain of 2 ATP and 2 NADH. This stage is anaerobic (does not require oxygen).

    2. The Link Reaction & Krebs Cycle:
    Pyruvate entering the mitochondria is converted into Acetyl-CoA. This then enters the Krebs Cycle (Citric Acid Cycle) in the mitochondrial matrix. The cycle produces ATP, NADH, and FADH2, and releases carbon dioxide as a byproduct.

    3. The Electron Transport Chain (ETC) & Chemiosmosis:
    The final and most productive stage, occurring on the inner mitochondrial membrane (cristae). High-energy electrons from NADH and FADH2 power the pumping of protons across the membrane, creating a gradient. This gradient drives ATP synthase to produce a large amount of ATP (about 32-34 molecules). Oxygen acts as the final electron acceptor, combining with protons to form water.

    4. Summary of Energy Yield:
    Total ATP production per glucose molecule varies but is typically around 36-38 ATP in ideal conditions.
    `
};

async function run() {
    console.log("Starting preprocessing for:", BIO_LESSON.title);

    // 1. Insert Material
    const { data: material, error: mError } = await supabase
        .from('materials')
        .insert({
            subject_id: 'biology', // Assumes 'biology' exists or will be created
            title: BIO_LESSON.title,
            overview: "A deep dive into Glycolysis, the Krebs Cycle, and the Electron Transport Chain.",
            content: BIO_LESSON.content,
        })
        .select()
        .single();

    if (mError) {
        console.error("Error inserting material:", mError);
        return;
    }

    console.log("Material created:", material.id);

    // 2. Preprocess with AI
    const sectioned = await preprocessMaterial(BIO_LESSON.title, BIO_LESSON.content);
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
