// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import imageRoutes from "./routes/imageRoutes.js";
import Image from "./models/Image.js";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import fetch from "node-fetch";
import FormData from "form-data";
import { fileURLToPath } from "url";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import mime from "mime";

import { generateSEOFromFilename } from "./lib/seoGenerator.js";

// AWS SDK v3 for Cloudflare R2
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ES Module __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dotenv
dotenv.config();

// Express app
const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------
// MongoDB connection
// ---------------------------
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ---------------------------
// API ROUTES
// ---------------------------
app.use("/api/images", imageRoutes);

// ---------------------------
// Cloudflare R2 SETUP
// ---------------------------
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

// Build public R2 URL
function buildR2PublicUrl(fileName) {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";
  return `${base}${encodeURIComponent(fileName)}`;
}

async function getR2PresignedUrl(key, expiresSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: expiresSeconds });
}

const BULK_UPLOAD_FOLDER = path.join(__dirname, "image-to-upload");

// Bulk Upload Function
async function uploadLocalFolderToR2() {
  if (!fs.existsSync(BULK_UPLOAD_FOLDER)) return;

  const files = fs.readdirSync(BULK_UPLOAD_FOLDER).filter(f =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );

  for (const fileName of files) {
    const filePath = path.join(BULK_UPLOAD_FOLDER, fileName);

    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).slice(1);
      const contentType = mime.getType(ext) || "application/octet-stream";

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      const thumbBuffer = await sharp(buffer)
        .resize({ width: 400 })
        .jpeg({ quality: 70 })
        .toBuffer();

      const thumbName = `thumb_${fileName}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: thumbName,
          Body: thumbBuffer,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      const seo = generateSEOFromFilename(fileName);

      await Image.create({
        name: seo.title,
        fileName,
        thumbnailFileName: thumbName,
        url: buildR2PublicUrl(fileName),
        category: seo.category,
        tags: seo.tags,
        description: seo.description,
        altText: seo.alt,
        uploadedAt: new Date(),
      });

      fs.unlinkSync(filePath);
      console.log(`Uploaded: ${fileName}`);

    } catch (err) {
      console.error("Bulk Upload Error:", err.message);
    }
  }
}

// ---------------------------
// Cloudinary Config
// ---------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------------------
// Static uploads folder
// ---------------------------
const localUploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(localUploadDir)) fs.mkdirSync(localUploadDir);
app.use("/uploads", express.static(localUploadDir));

// ---------------------------
// Compression API
// ---------------------------
app.post("/api/compress", upload.single("image_file"), async (req, res) => {
  try {
    const buffer = await sharp(req.file.buffer)
      .jpeg({ quality: 60 })
      .toBuffer();
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: "Failed", details: err.message });
  }
});

// ---------------------------
// Conversion API
// ---------------------------
app.post("/api/convert", upload.single("image_file"), async (req, res) => {
  try {
    const format = req.body.format?.toLowerCase();
    if (!format) return res.status(400).json({ message: "No format" });

    const valid = ["jpg", "jpeg", "png", "webp", "tiff", "pdf"];
    if (!valid.includes(format)) return res.status(400).json({ message: "Invalid format" });

    if (format === "pdf") {
      const pdfDoc = await PDFDocument.create();
      const metadata = await sharp(req.file.buffer).metadata();

      const img =
        metadata.format === "png"
          ? await pdfDoc.embedPng(req.file.buffer)
          : await pdfDoc.embedJpg(req.file.buffer);

      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      return res.send(Buffer.from(pdfBytes));
    }

    const converted = await sharp(req.file.buffer)
      .toFormat(format)
      .toBuffer();

    res.setHeader("Content-Type", mime.getType(format));
    res.send(converted);

  } catch (err) {
    res.status(500).json({ message: "Conversion failed", details: err.message });
  }
});

// ---------------------------
// FINAL ROOT ROUTE (only one)
// ---------------------------
app.get("/", (req, res) => {
  res.json({ status: "Pixeora API running" });
});

// ---------------------------
// START SERVER
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));
