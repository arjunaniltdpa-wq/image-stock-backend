import mongoose from "mongoose";
import dotenv from "dotenv";
import Image from "./models/Image.js";

dotenv.config(); // ✅ LOAD .env

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is missing. Check your .env file.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

console.log("✅ MongoDB connected");

const images = await Image.find({
  $or: [{ slug: null }, { slug: "undefined" }]
});

console.log(`🔍 Found ${images.length} images with missing slug`);

for (const img of images) {
  const base = img.title || img.fileName || `image-${img._id}`;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  img.slug = slug;
  await img.save();
}

console.log("✅ Slugs fixed successfully");
process.exit(0);
