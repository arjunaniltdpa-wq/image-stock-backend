// bulkUpload.js (FULL FIXED VERSION — MATCHES server.js)
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import mime from "mime";
import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";

import { generateSEOFromFilename } from "./lib/seoGenerator.js";
import Image from "./models/Image.js";

dotenv.config();

// -----------------------------
// 1️⃣ Config
// -----------------------------
const FOLDER_PATH = "./image-to-upload";
if (!fs.existsSync(FOLDER_PATH)) {
  console.log("❌ Folder 'image-to-upload' not found!");
  process.exit(1);
}

// -----------------------------
// 2️⃣ MongoDB Setup
// -----------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// -----------------------------
// 3️⃣ R2 Setup
// -----------------------------
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

function buildR2PublicUrl(fileName) {
  return `${process.env.R2_PUBLIC_BASE_URL}${encodeURIComponent(fileName)}`;
}

// -----------------------------
// Recursive folder scan
// -----------------------------
function getAllImages(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(getAllImages(filePath));
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
      results.push(filePath);
    }
  });

  return results;
}

// -----------------------------
// 4️⃣ Upload All
// -----------------------------
async function uploadAll() {
  const files = getAllImages(FOLDER_PATH);
  if (files.length === 0) {
    console.log("No images to upload");
    process.exit(0);
  }

  console.log(`🖼️ Found ${files.length} images.`);

  for (const filePath of files) {
    const originalName = path.basename(filePath);
    const uniqueName = `${Date.now()}-${originalName}`;

    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(originalName).slice(1);
      const contentType = mime.getType(ext) || "application/octet-stream";

      // Upload main file
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: uniqueName,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable"
        })
      );

      // Generate thumbnail
      const thumbBuffer = await sharp(buffer)
        .resize({ width: 400 })
        .jpeg({ quality: 70 })
        .toBuffer();

      const thumbName = `thumb_${uniqueName}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: thumbName,
          Body: thumbBuffer,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable"
        })
      );

      // SEO
      const seo = generateSEOFromFilename(originalName);

      // Save to MongoDB (correct fields!)
      await Image.create({
        name: seo.title,
        fileName: uniqueName,
        thumbnailFileName: thumbName,
        url: buildR2PublicUrl(uniqueName),
        category: seo.category,
        tags: seo.tags,
        description: seo.description,
        altText: seo.alt,
        uploadedAt: new Date(),
      });

      fs.unlinkSync(filePath);
      console.log(`✅ Uploaded: ${uniqueName}`);

    } catch (err) {
      console.error(`❌ Upload failed: ${originalName}`, err.message);
    }
  }

  console.log("🎉 Bulk upload complete!");
  process.exit(0);
}

uploadAll();
