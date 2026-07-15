import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Image from "./lib/models/Image.js";
import { recreateOldImageSEO } from "./lib/recreateOldImageSEO.js";

const END_DATE = new Date("2026-07-01T00:00:00.000Z");
const DAILY_LIMIT = 1000;

async function start() {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚀 Pixeora AI Migration Started");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");

    const images = await Image.find({

        uploadedAt: {
            $lt: END_DATE
        },

        migratedAI: {
            $ne: true
        }

    })
    .sort({
        uploadedAt: 1
    })
    .limit(DAILY_LIMIT);

    console.log(`📦 Images Found : ${images.length}`);
    console.log("");

    let success = 0;
    let failed = 0;

    const startTime = Date.now();

    for (let i = 0; i < images.length; i++) {

        const image = images[i];

        try {

            console.log("--------------------------------------------------");
            console.log(`[${i + 1}/${images.length}]`);
            console.log(image.title || image.name);

            const seo = await recreateOldImageSEO({

                title: image.title || image.name,

                category: image.category,

                secondaryCategory: image.secondaryCategory || "",

                keywords: image.keywords || [],

                tags: image.tags || []

            });

            await Image.updateOne(

                {

                    _id: image._id

                },

                {

                    $set: {

                        description: seo.description,

                        metaDescription: seo.metaDescription,

                        alt: seo.alt,

                        caption: seo.caption,

                        useCases: seo.useCases,

                        migratedAI: true,

                        descriptionUpdatedAt: new Date()

                    }

                }

            );

            success++;

            console.log("✅ Updated Successfully");
            console.log(`Total Success : ${success}`);

        }

        catch (err) {

            failed++;

            console.log("❌ Failed");
            console.log(err.message);

        }

    }

    const totalSeconds = Math.round((Date.now() - startTime) / 1000);

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Migration Completed");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Success : ${success}`);
    console.log(`❌ Failed  : ${failed}`);
    console.log(`⏱ Time    : ${totalSeconds} sec`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    process.exit();

}

start();