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

// SEO IMPORT
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

// ✅ FIX — IMAGE ROUTES MUST BE AT THE TOP
app.use("/api/images", imageRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ---------------------------
// Cloudflare R2 SETUP (S3-Compatible)
// ---------------------------
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, // from .env
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

function buildR2PublicUrl(fileName) {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";

  const cdnUrl = `${base}${encodeURIComponent(fileName)}`;

  // ⚡ Cloudflare CDN Optimized URL (Option B)
  return `https://pixeora.com/cdn-cgi/image/w=600,q=85,f=auto/${cdnUrl}`;
}


// Presigned private URL (if needed)
async function getR2PresignedUrl(key, expiresSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: expiresSeconds });
}

const BULK_UPLOAD_FOLDER = path.join(__dirname, "image-to-upload");

// ---------------------------
// BULK Upload to R2 (SEO + Thumb)
// ---------------------------
async function uploadLocalFolderToR2() {
  const files = fs.readdirSync(BULK_UPLOAD_FOLDER).filter(f =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );

  if (files.length === 0)
    return console.log("No files in image-to-upload");

  for (const fileName of files) {
    const filePath = path.join(BULK_UPLOAD_FOLDER, fileName);

    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).slice(1);
      const contentType = mime.getType(ext) || "application/octet-stream";

      // Main image upload
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      // Thumbnail upload
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
      console.log(`✅ Uploaded to R2: ${fileName}`);

    } catch (err) {
      console.error(`❌ Failed: ${fileName}`, err.message);
    }
  }

  console.log("🎉 ALL BULK UPLOADED TO R2.");
}

// ---------------------------
// Cloudinary config
// ---------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Popular Images Endpoint
app.get("/api/images/popular", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const images = await Image.find()
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit);

    const data = images.map(img => ({
      _id: img._id,
      name: img.name || img.fileName,
      url: `/api/images/file/${encodeURIComponent(img.fileName)}`,
      thumbnailUrl: `/api/images/file/${encodeURIComponent(img.thumbnailFileName || img.fileName)}`,
      tags: img.tags || [],
    }));

    res.json({ images: data });
  } catch (err) {
    res.status(500).json({ message: "Failed", details: err.message });
  }
});

// ---------------------------
// Single IMAGE UPLOAD → R2
// ---------------------------
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No file" });

    const buffer = req.file.buffer;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).slice(1);
    const contentType = mime.getType(ext) || req.file.mimetype;

    // Upload original
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: originalName,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    // Upload thumbnail
    const thumbBuffer = await sharp(buffer)
      .resize({ width: 400 })
      .jpeg({ quality: 70 })
      .toBuffer();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `thumb_${originalName}`,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const seo = generateSEOFromFilename(originalName);

    const imageDoc = await Image.create({
      name: seo.title,
      fileName: originalName,
      url: buildR2PublicUrl(originalName),
      thumbnailFileName: `thumb_${originalName}`,
      category: seo.category,
      tags: seo.tags,
      description: seo.description,
      altText: seo.alt,
      uploadedAt: new Date(),
    });

    res.json({
      message: "Uploaded to R2",
      fileName: originalName,
      seo,
      url: imageDoc.url
    });

  } catch (err) {
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ---------------------------
// PUBLIC IMAGE PROXY + RESIZE
// ---------------------------
app.get("/api/images/file/:fileName", async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);

    const publicUrl = buildR2PublicUrl(fileName);

    const response = await axios.get(publicUrl, {
      responseType: "arraybuffer",
    });

    const imageBuffer = Buffer.from(response.data);

    let finalBuffer = imageBuffer;

    const width = req.query.width ? parseInt(req.query.width) : null;
    const height = req.query.height ? parseInt(req.query.height) : null;
    const crop = req.query.crop;

    if (width || height || crop === "true") {
      let sharpOptions = { fit: "inside" };
      if (crop === "true")
        sharpOptions = { fit: "cover", position: "center" };

      finalBuffer = await sharp(imageBuffer)
        .resize(width, height, sharpOptions)
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.send(finalBuffer);

  } catch (err) {
    res.status(500).json({ error: "File fetch failed", details: err.message });
  }
});

// Signed URL (optional)
app.get("/api/get-file-url/:fileName", async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);
    const url = buildR2PublicUrl(fileName);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: "Failed", details: err.message });
  }
});

// Static uploads folder
const localUploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(localUploadDir)) fs.mkdirSync(localUploadDir);
app.use("/uploads", express.static(localUploadDir));

// Root
app.get("/", (req, res) =>
  res.send("Backend live with Cloudflare R2!")
);

// Compression
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

// Conversion
app.post("/api/convert", upload.single("image_file"), async (req, res) => {
  try {
    const format = req.body.format?.toLowerCase();
    if (!format)
      return res.status(400).json({ message: "No format" });

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

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));
