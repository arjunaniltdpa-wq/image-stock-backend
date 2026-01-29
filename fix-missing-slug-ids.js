// fix-missing-slug-ids.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Image from "./models/Image.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  // Find images where slug DOES NOT end with ObjectId
  const images = await Image.find({
    slug: { $not: /-[a-f0-9]{24}$/i }
  });

  console.log(`🔍 Found ${images.length} broken slugs`);

  for (const img of images) {
    if (!img._id || !img.slug) continue;

    const fixedSlug = `${img.slug}-${img._id}`;

    await Image.updateOne(
      { _id: img._id },
      { $set: { slug: fixedSlug } }
    );

    console.log("✔ Fixed:", fixedSlug);
  }

  console.log("🎉 DONE — all slugs repaired");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
