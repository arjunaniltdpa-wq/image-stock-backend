import mongoose from "mongoose";
import Image from "./models/Image.js";

await mongoose.connect(process.env.MONGO_URI);

const images = await Image.find({
  $or: [{ slug: null }, { slug: "undefined" }]
});

for (const img of images) {
  const base = img.title || img.fileName || `image-${img._id}`;
  img.slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  await img.save();
}

console.log("✅ Slugs fixed");
process.exit();
