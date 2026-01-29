import mongoose from "mongoose";
import sharp from "sharp";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import Image from "./models/Image.js";

dotenv.config();

/* ---------------- R2 CLIENT ---------------- */
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY
  }
});

/* ---------------- UPLOAD FUNCTION ---------------- */
async function uploadToR2(buffer, key) {
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: "image/webp"
  }));
}

/* ---------------- MAIN ---------------- */
await mongoose.connect(process.env.MONGO_URI);

const BATCH_SIZE = 30;

const images = await Image.find({
  $or: [
    { previewWebpUrl: { $exists: false } },
    { thumbnailWebpUrl: { $exists: false } }
  ]
}).limit(BATCH_SIZE);

for (const img of images) {
  try {
    const slug = img.slug || img._id.toString();

    /* -------- PREVIEW SOURCE -------- */
    const previewSource = img.previewUrl || img.url;

    const previewBuffer = await (await fetch(previewSource)).buffer();

    const previewWebp = await sharp(previewBuffer)
      .resize(1200)
      .webp({ quality: 80 })
      .toBuffer();

    const previewKey = `preview-webp/${slug}.webp`;
    await uploadToR2(previewWebp, previewKey);

    /* -------- THUMB WEBP -------- */
    const thumbBuffer = await (await fetch(img.thumbnailUrl)).buffer();

    const thumbWebp = await sharp(thumbBuffer)
      .resize(400)
      .webp({ quality: 75 })
      .toBuffer();

    const thumbKey = `thumb-webp/${slug}.webp`;
    await uploadToR2(thumbWebp, thumbKey);

    /* -------- UPDATE DB -------- */
    await Image.updateOne(
      { _id: img._id },
      {
        $set: {
          previewWebpUrl: `${process.env.R2_PUBLIC_URL}/${previewKey}`,
          previewWebpFileName: `${slug}.webp`,
          thumbnailWebpUrl: `${process.env.R2_PUBLIC_URL}/${thumbKey}`,
          thumbnailWebpFileName: `${slug}.webp`,
          webpStatus: "done"
        }
      }
    );

    console.log(`✅ Done: ${slug}`);
  } catch (err) {
    console.error(`❌ Error: ${img._id}`, err.message);
  }
}

console.log("🎉 Batch complete");
process.exit();
