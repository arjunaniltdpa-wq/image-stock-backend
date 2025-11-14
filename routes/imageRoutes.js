import express from "express";
import multer from "multer";
import Image from "../models/Image.js";
import { generateSEOFromFilename } from "../lib/seoGenerator.js";
import mime from "mime";
import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";

const router = express.Router();

// ----------------------------------
// Cloudflare R2 S3 Client
// ----------------------------------
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: false
});

// Public URL helper
function buildR2PublicUrl(fileName) {
  return `${process.env.R2_PUBLIC_BASE_URL}${encodeURIComponent(fileName)}`;
}

// ----------------------------------
// Multer memory storage
// ----------------------------------
const upload = multer({ storage: multer.memoryStorage() });

// ----------------------------------
// POST /upload → Upload to R2 + Thumbnail + SEO + MongoDB
// ----------------------------------
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file)
      return res.status(400).json({ error: "No file uploaded" });

    const originalName = file.originalname.toLowerCase().replace(/\s+/g, "-");
    const ext = originalName.split(".").pop();
    const contentType = mime.getType(ext) || file.mimetype;

    // ----------------------------------
    // 1️⃣ Upload ORIGINAL image to R2
    // ----------------------------------
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: originalName,
        Body: file.buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable"
      })
    );

    // ----------------------------------
    // 2️⃣ Create THUMBNAIL (400px)
    // ----------------------------------
    const thumbBuffer = await sharp(file.buffer)
      .resize({ width: 400 })
      .jpeg({ quality: 70 })
      .toBuffer();

    const thumbnailName = `thumb_${originalName}`;

    // ----------------------------------
    // 3️⃣ Upload THUMBNAIL to R2
    // ----------------------------------
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: thumbnailName,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable"
      })
    );

    // ----------------------------------
    // 4️⃣ Generate SEO
    // ----------------------------------
    const seo = generateSEOFromFilename(originalName);

    // ----------------------------------
    // 5️⃣ Save to MongoDB
    // ----------------------------------
    const img = new Image({
      name: originalName,
      fileName: originalName,
      thumbnailFileName: thumbnailName,
      url: buildR2PublicUrl(originalName),
      category: seo.category,
      title: seo.title,
      description: seo.description,
      alt: seo.alt,
      tags: seo.tags,
      uploadedAt: new Date()
    });

    await img.save();

    res.status(201).json({
      message: "Image + Thumbnail uploaded to Cloudflare R2 successfully",
      image: img
    });

  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({
      error: "Upload failed",
      details: err.message
    });
  }
});

// ----------------------------------
// GET /popular (unchanged)
// ----------------------------------
router.get("/popular", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await Image.countDocuments();
    const images = await Image.find()
      .skip(skip)
      .limit(limit)
      .sort({ uploadedAt: -1 });

    res.json({
      page,
      total,
      totalPages: Math.ceil(total / limit),
      images: images.map(img => ({
        _id: img._id,
        name: img.fileName,
        url: `/api/images/file/${encodeURIComponent(img.thumbnailFileName || img.fileName)}`,
        uploadedAt: img.uploadedAt
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------------
// GET /search (unchanged)
// ----------------------------------
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || "";

    const images = await Image.find({
      fileName: { $regex: query, $options: "i" }
    })
      .limit(50)
      .sort({ uploadedAt: -1 });

    res.json(
      images.map(img => ({
        _id: img._id,
        name: img.fileName,
        url: `/api/images/file/${encodeURIComponent(img.thumbnailFileName || img.fileName)}`,
        uploadedAt: img.uploadedAt
      }))
    );

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
