// bulkUpload.js
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import mime from "mime";
import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { generateSEOFromFilename } from "./lib/seoGenerator.js";

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
  .catch(err => console.error("❌ MongoDB connection error:", err));

const imageSchema = new mongoose.Schema({
  name: String,       // SEO-friendly name
  fileName: String,   // original file name
  url: String,
  category: String,
  title: String,
  description: String,
  alt: String,
  tags: [String],
  uploadedAt: { type: Date, default: Date.now },
});

const Image = mongoose.model("Image", imageSchema, "images");

// -----------------------------
// 3️⃣ Cloudflare R2 Setup (S3 Compatible)
// -----------------------------
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, // from .env
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: false
});

// fix public URL helper
function buildR2PublicUrl(fileName) {
  return `${process.env.R2_PUBLIC_BASE_URL}${encodeURIComponent(fileName)}`;
}

// -----------------------------
// 4️⃣ Deep-Scan Folder Function
// -----------------------------
function getAllImages(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(getAllImages(filePath)); // recursive
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
      results.push(filePath);
    }
  });

  return results;
}

// -----------------------------
// 5️⃣ Upload Function
// -----------------------------
async function uploadAll() {
  const files = getAllImages(FOLDER_PATH);
  if (files.length === 0) {
    console.log("No images to upload!");
    return;
  }

  console.log(`🖼️ Found ${files.length} images.`);

  for (const filePath of files) {
    const fileName = path.basename(filePath);

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).slice(1);
      const contentType = mime.getType(ext) || "application/octet-stream";

      // Upload to R2
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: fileBuffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable"
        })
      );

      // SEO generation
      const seo = generateSEOFromFilename(fileName);

      await Image.create({
        name: fileName.toLowerCase().replace(/\s+/g, "-"),
        fileName: fileName,
        url: buildR2PublicUrl(fileName),
        category: seo.category,
        title: seo.title,
        description: seo.description,
        alt: seo.alt,
        tags: seo.tags,
        uploadedAt: new Date()
      });

      // remove local file
      fs.unlinkSync(filePath);

      console.log(`✅ Uploaded & SEO saved: ${fileName}`);

    } catch (err) {
      console.error(`❌ Failed: ${fileName}`, err.message);
    }
  }

  console.log("🎉 All images uploaded to R2 successfully!");
  process.exit(0);
}

// -----------------------------
// 6️⃣ RUN
// -----------------------------
uploadAll();
