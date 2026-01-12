import mongoose from "mongoose";
import dotenv from "dotenv";
import Image from "./models/Image.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const images = await Image.find({});
console.log(`🔍 Fixing ${images.length} images`);

for (const img of images) {
  const base = (img.title || img.fileName || "image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  img.slug = `${base}-${img._id.toString()}`;
  await img.save();
}

console.log("✅ Slugs rebuilt correctly");
process.exit(0);
