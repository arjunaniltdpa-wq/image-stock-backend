import dotenv from "dotenv";
dotenv.config();

import express from "express";
import multer from "multer";
import Image from "../models/Image.js";
import { generateSEOFromFilename } from "../lib/seoGenerator.js";
import mime from "mime";
import sharp from "sharp";
import axios from "axios";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";

import { attachUrls } from "../lib/attachUrls.js";

const router = express.Router();

/* --------------------------------------------
   R2 CLIENT
-------------------------------------------- */
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: false
});

/* --------------------------------------------
   MULTER
-------------------------------------------- */
const upload = multer({ storage: multer.memoryStorage() });

/* --------------------------------------------
   HOME
-------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const images = await Image.find({})
      .sort({ uploadedAt: -1 })
      .limit(40)
      .lean();

    res.json(images.map(attachUrls));
  } catch (err) {
    console.error("HOME LOAD ERROR:", err);
    res.status(500).json({ error: "Failed to load images" });
  }
});

/* --------------------------------------------
   UPLOAD
-------------------------------------------- */
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const originalName = req.file.originalname
      .toLowerCase()
      .replace(/\s+/g, "-");

    const ext = originalName.split(".").pop();
    const contentType = mime.getType(ext) || req.file.mimetype;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: originalName,
        Body: req.file.buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable"
      })
    );

    const thumbBuffer = await sharp(req.file.buffer)
      .resize({ width: 500 })
      .jpeg({ quality: 75 })
      .toBuffer();

    const thumbName = `thumb_${originalName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: thumbName,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable"
      })
    );

    const seo = generateSEOFromFilename(originalName);

    const img = await Image.create({
      title: seo.title,
      fileName: originalName,
      thumbnailFileName: thumbName,
      description: seo.description,
      alt: seo.alt,
      category: seo.category,
      tags: seo.tags,
      uploadedAt: new Date()
    });

    res.json({ image: attachUrls(img.toObject()) });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* --------------------------------------------
   POPULAR
-------------------------------------------- */
router.get("/popular", async (req, res) => {
  const images = await Image.find({})
    .sort({ uploadedAt: -1 })
    .limit(20)
    .lean();

  res.json(images.map(attachUrls));
});

/* --------------------------------------------
   SEARCH
-------------------------------------------- */
router.get("/search", async (req, res) => {
  const q = req.query.q || "";
  const images = await Image.find({
    title: { $regex: q, $options: "i" }
  })
    .limit(60)
    .lean();

  res.json(images.map(attachUrls));
});

/* --------------------------------------------
   GET BY ID
-------------------------------------------- */
router.get("/id/:id", async (req, res) => {
  const img = await Image.findById(req.params.id).lean();
  if (!img) return res.status(404).json({});

  res.json(attachUrls(img));
});

/* --------------------------------------------
   RELATED
-------------------------------------------- */
router.get("/related/:cat", async (req, res) => {
  const images = await Image.find({
    category: { $regex: req.params.cat, $options: "i" }
  })
    .limit(20)
    .lean();

  res.json(images.map(attachUrls));
});

/* --------------------------------------------
   SLUG + ID
-------------------------------------------- */
router.get("/slug/:slugAndId", async (req, res) => {
  const id = req.params.slugAndId.split("-").pop();
  const img = await Image.findById(id).lean();
  if (!img) return res.status(404).json({});

  res.json(attachUrls(img));
});

/* --------------------------------------------
   DOWNLOAD (R2 REDIRECT)
-------------------------------------------- */
router.get("/download/:filename", (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ error: "Filename required" });
  }

  let base = process.env.R2_PUBLIC_BASE_URL;
  if (!base.endsWith("/")) base += "/";

  const r2Url = `${base}${filename}`;

  // Force download instead of open
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  return res.redirect(r2Url);
});

export default router;
