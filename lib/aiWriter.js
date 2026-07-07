import ollama from "ollama";

export async function generateAISEO(data) {

    const prompt = `
You are a Senior SEO Content Writer for Pixeora, a professional stock image platform similar to Adobe Stock and Shutterstock.

Your job is to create ORIGINAL, HUMAN-WRITTEN SEO content for ONE stock image.

=========================
STRICT RULES
=========================

1. Describe ONLY what is visible.
2. Never invent people, animals, sounds, weather, stories or emotions.
3. Never guess anything outside the image.
4. Never repeat the title.
5. Never stuff keywords.
6. Never write like ChatGPT.
7. Never use marketing language.

DO NOT USE THESE WORDS:

stunning
amazing
beautiful
awesome
premium
perfect
best
incredible
high quality
high-quality
professional
masterpiece
breathtaking
excellent
fantastic
gorgeous

=========================
WRITING STYLE
=========================

Write like a real human editor.

Use simple English.

Reading level:
Around Grade 7-8.

Avoid long sentences.

Avoid repetition.

Do NOT start every description with:

"This image..."

"The image..."

"This stock image..."

Instead start naturally.

=========================
DESCRIPTION
=========================

Write between 120 and 150 words.

Write TWO short paragraphs.

Paragraph 1:

Describe

• main subject
• visible objects
• colors
• lighting
• composition
• background

Paragraph 2:

Describe practical uses such as

• websites
• presentations
• blogs
• social media
• marketing
• print
• education
• wallpapers

Never exaggerate.

=========================
META DESCRIPTION
=========================

Maximum 155 characters.

Natural.

SEO friendly.

=========================
ALT TEXT
=========================

10-18 words.

Describe ONLY the image.

No branding.

=========================
CAPTION
=========================

One short sentence.

Maximum 18 words.

=========================
USE CASES
=========================

Return exactly FIVE use cases.

Each use case should contain only 2-5 words.

Examples:

Website Banner
Presentation Slide
Blog Header
Marketing Material
Social Media Post

=========================
INPUT
=========================

The input contains:

Title
Category
Secondary Category
Tags
Keywords
Width
Height

Use these only as context.

Do NOT copy them directly.

Input:

${JSON.stringify(data)}

=========================
OUTPUT
=========================

Return ONLY valid JSON.

{
  "description":"",
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

    const response = await ollama.chat({
        model: "qwen2.5:7b",
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        format: "json"
    });

    let result;

    try {
        result = JSON.parse(response.message.content);
    } catch (e) {
        throw new Error("Invalid JSON returned by AI");
    }

    return {
        description: result.description?.trim() || "",
        metaDescription: result.metaDescription?.trim() || "",
        alt: result.alt?.trim() || "",
        caption: result.caption?.trim() || "",
        useCases: Array.isArray(result.useCases) ? result.useCases : []
    };
}