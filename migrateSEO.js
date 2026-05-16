// migrateSEO.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Image from "./lib/models/Image.js";
import { generateSEOFromFilename } from "./lib/seoGenerator.js";

dotenv.config();

// -----------------------------
// 1️⃣ Connect to MongoDB
// -----------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// -----------------------------
// 2️⃣ Update Function
// -----------------------------
async function updateSEO() {
  try {
    const images = await Image.find({}); // all images
    console.log(`🔹 Found ${images.length} images.`);

    let count = 0;

    for (const img of images) {
      const seo = generateSEOFromFilename(img.fileName);

      img.category = seo.category;
      img.title = seo.title;
      img.description = seo.description;
      img.alt = seo.alt;
      img.tags = seo.tags;

      await img.save();
      count++;
      console.log(`✅ Updated SEO for: ${img.fileName}`);
    }

    console.log(`🎉 All ${count} images updated with SEO!`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating SEO:", err);
    process.exit(1);
  }
}

// -----------------------------
// 3️⃣ Run
// -----------------------------
updateSEO();
