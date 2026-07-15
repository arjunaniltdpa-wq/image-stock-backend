import ollama from "ollama";

const MODEL = "qwen2.5:7b";

const MIN_WORDS = 60;
const MAX_WORDS = 150;

const MAX_RETRY = 5;

function wordCount(text = "") {
    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}

function safeJSON(str) {

    try {

        return JSON.parse(str);

    }

    catch {

        return null;

    }

}


const writingStyles = [

`Write like an experienced stock photography editor.`,

`Write like a magazine writer using natural English.`,

`Write like a travel journalist describing a scene.`,

`Write like an editorial content writer.`,

`Write like a professional copywriter without sounding promotional.`

];

function randomStyle(){

    return writingStyles[
        Math.floor(
            Math.random()*writingStyles.length
        )
    ];

}

async function generateDescription(data){

    const cleanTitle = (data.title || "")
        .replace(/\|.*/, "")
        .replace(/free/gi, "")
        .replace(/\bhd\b/gi, "")
        .replace(/high resolution/gi, "")
        .replace(/background images?/gi, "")
        .replace(/wallpapers?/gi, "")
        .replace(/download/gi, "")
        .replace(/pixeora/gi, "")
        .replace(/\s+/g, " ")
        .trim();

    for(let attempt=1;attempt<=MAX_RETRY;attempt++){

        const prompt=`

Imagine this description will be published on a professional stock photography website.

The description should read as if written by a human editor, not an AI assistant.

Every image must have its own unique writing style.

Avoid using the same opening sentence across different images.

You are a professional editorial writer.

${randomStyle()}

Your job is to write ONE unique stock image description.

Do NOT write like AI.

Do NOT repeat phrases.

Write naturally.

Use active voice.

Length

Write exactly TWO balanced paragraphs.

Paragraph 1:
Write 4–5 complete sentences describing the scene.

Paragraph 2:
Write 4–5 complete sentences explaining realistic uses.

Each paragraph should contain approximately 45–70 words.

Do not write short paragraphs.

Do not finish early.

The total description should naturally be around 80-140 words.

Do not stop after one paragraph.

Do not return short descriptions.

Image Information

Before answering, check:

✓ Description contains 80–140 words.

✓ Two balanced paragraphs.

✓ Human writing style.

✓ Natural English.

✓ No repeated phrases.

✓ No keyword stuffing.

Do not exaggerate.

Do not use marketing language.

Do not make assumptions about sustainability, luxury, innovation, future technology, or environmental benefits unless clearly implied by the metadata.

Write in an objective editorial tone similar to Adobe Stock or Shutterstock.

If any rule fails, rewrite the description before returning.

Title:
${cleanTitle}

Category:
${data.category}

Secondary Category:
${data.secondaryCategory||""}

Keywords:
${(data.keywords||[]).join(", ")}

Tags:
${(data.tags||[]).join(", ")}

Only describe what can reasonably be inferred.

Do not invent impossible details.

Return ONLY JSON.

{
"description":""
}

`;


        try{

            const res = await ollama.chat({

                model: MODEL,

                format: "json",

                options: {

                    temperature: 0.9,

                    num_predict: 450,

                    top_p: 0.95,

                    repeat_penalty: 1.15

                },

                messages: [

                    {

                        role: "user",

                        content: prompt

                    }

                ]

            });

            console.log("--------------------------------");
            console.log(res.message.content);
            console.log("--------------------------------");

            const json=safeJSON(res.message.content);

            if(!json) continue;

            if(!json.description) continue;

            const words=wordCount(json.description);

            console.log("Description:",words,"words");

            if (words < 60) {
                console.log(`Too short: ${words} words`);
                continue;
            }

            if (words > MAX_WORDS) {
                console.log(`Too long: ${words} words`);
                continue;
            }

            return json.description.trim();

        }

        catch(e){

            console.log(e.message);

        }

    }

    throw new Error("Description generation failed.");

}

async function generateSEO(description){

    const prompt = `

You are an experienced SEO editor.

Generate metadata for this stock image description.

Description

${description}

Rules

Return ONLY valid JSON.

metaDescription

Maximum 155 characters.

Natural.

Readable.

SEO friendly.

alt

10-16 words.

Describe only the visible subject.

caption

Maximum 15 words.

One short sentence.

useCases

Return exactly five.

Each between 2 and 4 words.

Return only

{

"metaDescription":"",

"alt":"",

"caption":"",

"useCases":[
"",
"",
"",
"",
""
]

}

`;

    for(let attempt=1;attempt<=MAX_RETRY;attempt++){

        try{

            const res = await ollama.chat({

                model: MODEL,

                format: "json",

                options: {

                    temperature: 0.9,

                    num_predict: 450,

                    top_p: 0.95,

                    repeat_penalty: 1.15

                },

                messages: [

                    {

                        role: "user",

                        content: prompt

                    }

                ]

            });

            const json = safeJSON(res.message.content);

            if (!json) {
                console.log("Invalid JSON:");
                console.log(res.message.content);
                continue;
            }

            return{

                metaDescription:
                    json.metaDescription || "",

                alt:
                    json.alt || "",

                caption:
                    json.caption || "",

                useCases:
                    Array.isArray(json.useCases)
                        ? json.useCases
                        : []

            };

        }

        catch(e){

            console.log(e.message);

        }

    }

    return{

        metaDescription:"",

        alt:"",

        caption:"",

        useCases:[]

    };

}

export async function recreateOldImageSEO(data){

    const description =
        await generateDescription(data);

    const seo =
        await generateSEO(description);

    return{

        description,

        metaDescription:
            seo.metaDescription,

        alt:
            seo.alt,

        caption:
            seo.caption,

        useCases:
            seo.useCases

    };

}