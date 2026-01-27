// bulkUpload.js (SAFE WEBP FOR NEW UPLOADS)
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import mime from "mime";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import { generateSEOFromFilename } from "./lib/seoGenerator.js";
import Image from "./models/Image.js";

dotenv.config();

// -------------------------------------------------
// Config
// -------------------------------------------------
const FOLDER_PATH = "./image-to-upload";

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// -------------------------------------------------
// Cloudflare R2
// -------------------------------------------------
const s2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

function buildR2PublicUrl(fileName) {
  let base = process.env.R2_PUBLIC_BASE_URL;
  if (!base.endsWith("/")) base += "/";
  return `${base}${encodeURIComponent(fileName)}`;
}

// -------------------------------------------------
// Upload
// -------------------------------------------------
async function uploadAll() {
  const files = fs.readdirSync(FOLDER_PATH)
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f));

  for (const file of files) {
    const filePath = path.join(FOLDER_PATH, file);
    const buffer = fs.readFileSync(filePath);

    const uniqueName = `${Date.now()}-${file}`;
    const ext = path.extname(file).slice(1);
    const contentType = mime.getType(ext);

    try {
      // 1️⃣ Upload ORIGINAL (unchanged)
      await s2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: uniqueName,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable"
      }));

      // ⭐ 2️⃣ PREVIEW WEBP (1200px)
      const previewBuffer = await sharp(buffer)
        .resize({ width: 1200 })
        .webp({ quality: 82 })
        .toBuffer();

      const baseName = uniqueName.replace(/\.(jpe?g|png|webp)$/i, "");

      const previewName = `preview_${baseName}.webp`;
      
      await s2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: previewName,
        Body: previewBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable"
      }));

      // ⭐ 3️⃣ THUMB WEBP (400px)
      const thumbBuffer = await sharp(buffer)
        .resize({ width: 400 })
        .webp({ quality: 75 })
        .toBuffer();

      const thumbName = `thumb_${uniqueName}.webp`;

      await s2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: thumbName,
        Body: thumbBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable"
      }));

      // SEO
      const seo = generateSEOFromFilename(file);

      // 4️⃣ Save to DB (new fields added safely)
      await Image.create({
        name: seo.title,
        title: seo.title,
        fileName: uniqueName,
        url: buildR2PublicUrl(uniqueName),              // original
        previewWebpUrl: buildR2PublicUrl(previewName), // ⭐ new
        thumbWebpUrl: buildR2PublicUrl(thumbName),     // ⭐ new
        category: seo.category,
        secondaryCategory: seo.secondaryCategory,
        description: seo.description,
        alt: seo.alt,
        tags: seo.tags,
        keywords: seo.keywords,
        slug: seo.slug,
        uploadedAt: new Date()
      });

      fs.unlinkSync(filePath);
      console.log(`✅ Uploaded (WebP ready): ${file}`);

    } catch (err) {
      console.error(`❌ Upload failed: ${file}`, err);
    }
  }

  console.log("🎉 Done");
  process.exit(0);
}

uploadAll();
