// fix-slugs.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Image from "./models/Image.js";

dotenv.config();

async function fixSlugs() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const brokenImages = await Image.find({
    slug: { $not: /-[a-f0-9]{24}$/i }
  });

  console.log(`🔍 Found ${brokenImages.length} images with missing ID`);

  for (const img of brokenImages) {
    const newSlug = `${img.slug}-${img._id}`;

    await Image.updateOne(
      { _id: img._id },
      { $set: { slug: newSlug } }
    );

    console.log("✔ Fixed:", newSlug);
  }

  console.log("🎉 Slug migration completed");
  process.exit(0);
}

fixSlugs().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
