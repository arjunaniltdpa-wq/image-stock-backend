import ollama from "ollama";

export async function generateAISEO(data) {

const prompt = `
You are a senior SEO content editor for Pixeora.

Pixeora contains two types of content:

1. Stock Images
2. Wallpapers

Write content similar to Adobe Stock, Shutterstock and Getty Images.

================================================
CONTENT TYPE
================================================

Content Type:
${data.contentType || "stock"}

If Content Type = stock

• Focus on commercial and creative uses.
• Mention websites, blogs, presentations, advertising, marketing, print and social media naturally.

If Content Type = wallpaper

• Focus on the visual appearance.
• Mention desktop wallpapers, mobile backgrounds, lock screens, tablet wallpapers, gaming setups and digital backgrounds naturally.

Never force commercial wording for wallpapers.

================================================
GOAL
================================================

Generate ORIGINAL human-readable SEO content.

The image itself is NOT available.

Only use the supplied metadata.

Never invent details that are not reasonably implied.

If something is uncertain, keep the wording general.

================================================
WRITING STYLE
================================================

Write naturally.

Use short and medium sentences.

Reading level:
Grade 7-8.

Use active voice.

Avoid robotic wording.

Avoid repeating the title.

Avoid repeating keywords.

Avoid filler.

Never sound like AI.

================================================
DO NOT USE THESE WORDS
================================================

stunning
beautiful
amazing
awesome
perfect
premium
masterpiece
high quality
high-quality
excellent
fantastic
breathtaking
gorgeous
incredible
best
ultimate

================================================
DESCRIPTION
================================================

The description MUST contain between 120 and 160 words.

Write EXACTLY TWO paragraphs.

Paragraph 1 (70-85 words)

Describe naturally:

• main subject
• important objects
• colors (if implied)
• lighting (if implied)
• composition
• background
• perspective

Describe only what can reasonably be inferred.

Do not list features.

Do not repeat keywords.

Paragraph 2 (60-75 words)

If Content Type = stock

Explain natural creative uses like websites, blogs, marketing, presentations, print, branding, advertising and social media.

If Content Type = wallpaper

Explain natural display uses like desktop wallpaper, mobile background, tablet wallpaper, gaming setup, monitor background and digital screens.

Write naturally.

Do not use bullet points.

Do not repeat paragraph one.

================================================
META DESCRIPTION
================================================

Maximum 155 characters.

Natural.

Readable.

SEO friendly.

================================================
ALT TEXT
================================================

10-16 words.

Describe only the visible subject.

No branding.

No keyword stuffing.

================================================
CAPTION
================================================

Maximum 15 words.

One natural sentence.

================================================
USE CASES
================================================

Return EXACTLY FIVE.

Each between 2 and 4 words.

Examples:

Website Banner
Presentation Slide
Blog Header
Marketing Material
Desktop Wallpaper

================================================
INPUT
================================================

${JSON.stringify(data)}

================================================
QUALITY CHECK
================================================

Before returning:

✓ Description contains 110-140 words

✓ Natural English

✓ No repeated sentences

✓ No keyword stuffing

✓ No invented information

✓ Valid JSON only

If any rule fails, rewrite before returning.

================================================
OUTPUT
================================================

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

    const wordCount = result.description
        ? result.description.trim().split(/\s+/).length
        : 0;

    if (wordCount < 110) {
        console.warn(`⚠ Description only ${wordCount} words`);
    }

    return {
        description: result.description?.trim() || "",
        metaDescription: result.metaDescription?.trim() || "",
        alt: result.alt?.trim() || "",
        caption: result.caption?.trim() || "",
        useCases: Array.isArray(result.useCases) ? result.useCases : []
    };

}