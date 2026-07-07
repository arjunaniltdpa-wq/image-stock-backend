import { generateAISEO } from "./lib/aiWriter.js";

async function test() {

    const result = await generateAISEO({

        title: "Futuristic Cyberpunk City Alley Neon Lights",

        category: "technology",

        tags: [
            "Cyberpunk",
            "City",
            "Neon",
            "Night"
        ],

        keywords: [
            "Cyberpunk",
            "Neon City",
            "Technology Wallpaper"
        ],

        width: 3840,

        height: 2160

    });

    console.log(result);

}

test();s