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
import { fileURLToPath } from "url";
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

app.use(express.static(path.join(__dirname, "public")));


// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

import searchRoutes from "./routes/search.js";
app.use("/api/search", searchRoutes);


import ogMetaRoute from "./routes/ogMeta.js";
import ogRoute from "./routes/og.js";

app.use("/api/og-meta", ogMetaRoute);
app.use("/api/og", ogRoute);

import ogPage from "./routes/ogPage.js";

app.use("/photo", ogPage);



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

import removeBg from "./routes/removeBg.js";
app.use("/api/remove-bg", removeBg);

import popularLatest from "./routes/popularLatest.js";
app.use("/api/images/popular-latest", popularLatest);


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

import sitemapRoute from "./sitemap.js";
app.use("/", sitemapRoute);


app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.sendFile(path.join(__dirname, "robots.txt"));
});

app.get("/photo/:slug-:id", async (req, res) => {
  const ua = (req.headers["user-agent"] || "").toLowerCase();

  const isBot =
    ua.includes("facebookexternalhit") ||
    ua.includes("twitterbot") ||
    ua.includes("pinterest") ||
    ua.includes("slackbot") ||
    ua.includes("whatsapp") ||
    ua.includes("linkedinbot") ||
    ua.includes("telegrambot");

  if (isBot) {
    return res.redirect(
      302,
      `/api/og?slug=${req.params.slug}-${req.params.id}`
    );
  }

  res.sendFile("download.html", { root: "./public" });
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

// ======================================================
//  RETRY HELPER + ERROR LOGGING + MONGO FALLBACK
// ======================================================
async function retry(fn, attempts = 3, delay = 1200) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`Retry ${i + 1} failed: ${err.message}`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError;
}

function writeFallbackLog(file, data) {
  const dir = path.join(__dirname, "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const filePath = path.join(dir, file);

  let existing = [];
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  existing.push(data);

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

// ======================================================
// UPDATED — BULK UPLOAD FUNCTION WITH RETRY + LOGGING
// ======================================================
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

      // Unique name to allow duplicates
      const uniqueName = `${Date.now()}-${fileName}`;

      // Upload original with retry
      await retry(async () => {
        return await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: uniqueName,
            Body: buffer,
            ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
      });

      // Create thumbnail
      const thumbBuffer = await sharp(buffer)
        .resize({ width: 400 })
        .jpeg({ quality: 70 })
        .toBuffer();

      const thumbName = `thumb_${uniqueName}`;

      // Upload thumbnail with retry
      await retry(async () => {
        return await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: thumbName,
            Body: thumbBuffer,
            ContentType: "image/jpeg",
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
      });

      const seo = generateSEOFromFilename(fileName);

      // Save metadata to MongoDB with retry + fallback if fails
      await retry(async () => {
        return await Image.create({
          name: seo.title,
          title: seo.title,
          fileName: uniqueName,
          thumbnailFileName: thumbName,
          url: buildR2PublicUrl(uniqueName),
          thumbnailUrl: buildR2PublicUrl(thumbName),
          category: seo.category,
          secondaryCategory: seo.secondaryCategory,
          tags: seo.tags,
          keywords: seo.keywords,
          description: seo.description,
          alt: seo.alt,
          uploadedAt: new Date(),
        });
      }).catch(err => {
        writeFallbackLog("mongo_fallback.json", {
          file: uniqueName,
          error: err.message,
          time: new Date(),
        });
        throw err;
      });

      fs.unlinkSync(filePath);
      console.log(`Uploaded: ${uniqueName}`);

    } catch (err) {
      console.error("Bulk Upload Error:", err.message);

      writeFallbackLog("failed_uploads.json", {
        file: fileName,
        error: err.message,
        time: new Date(),
      });
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
    if (!valid.includes(format))
      return res.status(400).json({ message: "Invalid format" });

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
// SINGLE IMAGE UPLOAD TO R2
// ---------------------------
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const originalName = req.file.originalname;
    const buffer = req.file.buffer;

    // Create unique filename
    const uniqueName = `${Date.now()}-${originalName}`;

    // Detect content type
    const ext = path.extname(originalName).slice(1).toLowerCase();
    const contentType = mime.getType(ext) || "application/octet-stream";

    // ---- Upload to R2 with Retry ----
    await retry(async () => {
      return await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: uniqueName,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    });

    // ---- Generate thumbnail ----
    const thumbBuffer = await sharp(buffer)
      .resize({ width: 400 })
      .jpeg({ quality: 70 })
      .toBuffer();

    const thumbName = `thumb_${uniqueName}`;

    // ---- Upload thumbnail with retry ----
    await retry(async () => {
      return await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: thumbName,
          Body: thumbBuffer,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    });

    // ---- SEO Generation ----
    const seo = generateSEOFromFilename(originalName);

    // ---- Save to MongoDB (retry + fallback) ----
    await retry(async () => {
      return await Image.create({
        name: seo.title,
        title: seo.title,
        fileName: uniqueName,
        thumbnailFileName: thumbName,
        url: buildR2PublicUrl(uniqueName),
        thumbnailUrl: buildR2PublicUrl(thumbName),
        category: seo.category,
        secondaryCategory: seo.secondaryCategory,
        tags: seo.tags,
        keywords: seo.keywords,
        description: seo.description,
        alt: seo.alt,
    uploadedAt: new Date(),
      });
    }).catch(err => {
      writeFallbackLog("mongo_fallback.json", {
        file: uniqueName,
        error: err.message,
        time: new Date(),
      });
      throw err;
    });

    // SUCCESS RESPONSE
    res.json({
      success: true,
      url: buildR2PublicUrl(uniqueName),
      thumbnailUrl: buildR2PublicUrl(thumbName),
    });

  } catch (err) {
    console.error("Single Upload Error:", err.message);

    writeFallbackLog("failed_uploads.json", {
      file: req.file?.originalname,
      error: err.message,
      time: new Date(),
    });

    return res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.message
    });
  }
});


// ---------------------------
// FINAL ROOT ROUTE
// ---------------------------
app.get("/", (req, res) => {
  res.json({ status: "Pixeora API running" });
});

// ---------------------------
// START SERVER
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));
