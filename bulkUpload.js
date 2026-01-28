// bulkUpload.js (FINAL FIXED VERSION)
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
// 1️⃣ Config
// -------------------------------------------------
const FOLDER_PATH = "./image-to-upload";
if (!fs.existsSync(FOLDER_PATH)) {
  console.log("❌ Folder 'image-to-upload' not found!");
  process.exit(1);
}

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
// Recursive folder scan
// -------------------------------------------------
function getAllImages(dir) {
  const files = fs.readdirSync(dir);
  let results = [];

  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results = results.concat(getAllImages(full));
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
      results.push(full);
    }
  }

  return results;
}

// -------------------------------------------------
// 4️⃣ Upload All
// -------------------------------------------------
async function uploadAll() {
  const files = getAllImages(FOLDER_PATH);
  if (files.length === 0) {
    console.log("No images to upload");
    process.exit(0);
  }

  console.log(`🖼️ Found ${files.length} images.`);

    for (const filePath of files) {
    const originalName = path.basename(filePath);
    const uniqueBase = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${path.parse(originalName).name}`;

    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(originalName).slice(1).toLowerCase();
      const contentType = mime.getType(ext) || "application/octet-stream";

      /* ---------------- ORIGINAL IMAGE ---------------- */
      const originalKey = `${uniqueBase}.${ext}`;

      await s2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: originalKey,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable"
        })
      );

      /* ---------------- WEBP THUMB (400px) ---------------- */
      const thumbBuffer = await sharp(buffer)
        .resize({ width: 400 })
        .webp({ quality: 75 })
        .toBuffer();

      const thumbKey = `${uniqueBase}_thumb.webp`;

      await s2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable"
        })
      );

      /* ---------------- WEBP PREVIEW (1200px) ---------------- */
      const previewBuffer = await sharp(buffer)
        .resize({ width: 1200 })
        .webp({ quality: 85 })
        .toBuffer();

      const previewKey = `${uniqueBase}_preview.webp`;

      await s2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: previewKey,
          Body: previewBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable"
        })
      );

      /* ---------------- SEO ---------------- */
      const seo = generateSEOFromFilename(originalName);
      const meta = await sharp(buffer).metadata();

      /* ---------------- SAVE TO MONGODB ---------------- */
      await Image.create({
        title: seo.title,
        slug: seo.slug ? `${seo.slug}-${Date.now()}` : uniqueBase,

        fileName: originalKey,
        thumbnailFileName: thumbKey,
        previewFileName: previewKey,

        url: buildR2PublicUrl(originalKey),
        thumbnailUrl: buildR2PublicUrl(thumbKey),
        previewUrl: buildR2PublicUrl(previewKey),

        category: seo.category,
        secondaryCategory: seo.secondaryCategory,
        description: seo.description,
        alt: seo.alt,
        tags: seo.tags,
        keywords: seo.keywords,

        uploadedAt: new Date()
      });

      fs.unlinkSync(filePath);
      console.log(`✅ Uploaded: ${originalKey}`);
      
    } catch (err) {
      console.error(`❌ Upload failed: ${originalName}`, err);
    }
  }
  
  console.log("🎉 Bulk upload complete!");
  process.exit(0);
}

uploadAll();
