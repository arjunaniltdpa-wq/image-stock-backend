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
   PUBLIC URL BUILDER
-------------------------------------------- */
function buildR2PublicUrl(fileName) {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";
  return `${base}${encodeURIComponent(fileName)}`;
}

/* --------------------------------------------
   MULTER STORAGE
-------------------------------------------- */
const upload = multer({ storage: multer.memoryStorage() });



/* --------------------------------------------
   UPLOAD ROUTE
-------------------------------------------- */
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const file = req.file;
    const originalName = file.originalname.toLowerCase().replace(/\s+/g, "-");
    const ext = originalName.split(".").pop();
    const contentType = mime.getType(ext) || file.mimetype;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: originalName,
        Body: file.buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable"
      })
    );

    const thumbBuffer = await sharp(file.buffer)
      .resize({ width: 500 })
      .jpeg({ quality: 75 })
      .toBuffer();

    const thumbnailName = `thumb_${originalName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: thumbnailName,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable"
      })
    );

    const seo = generateSEOFromFilename(originalName);

    const img = await Image.create({
      name: originalName,
      fileName: originalName,
      thumbnailFileName: thumbnailName,
      url: buildR2PublicUrl(originalName),
      title: seo.title,
      description: seo.description,
      alt: seo.alt,
      category: seo.category,
      tags: seo.tags,
      uploadedAt: new Date()
    });

    res.status(201).json({ message: "Uploaded successfully", image: img });
  } catch (err) {
    console.error("❌ Upload Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* --------------------------------------------
   POPULAR IMAGES
-------------------------------------------- */
router.get("/popular", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const images = await Image.find()
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      page,
      images: images.map(img => ({
        _id: img._id,
        title: img.title,
        fileName: img.fileName,
        thumbnailFileName: img.thumbnailFileName,
        url: `/api/images/file/${encodeURIComponent(img.thumbnailFileName)}`
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Popular fetch failed" });
  }
});

/* --------------------------------------------
   SEARCH
-------------------------------------------- */
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q || "";

    const images = await Image.find({
      title: { $regex: q, $options: "i" }
    }).limit(60);

    res.json({
      images: images.map(img => ({
        _id: img._id,
        title: img.title,
        fileName: img.fileName,
        thumbnailFileName: img.thumbnailFileName,
        url: `/api/images/file/${encodeURIComponent(img.thumbnailFileName)}`
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

/* --------------------------------------------
   GET IMAGE BY ID
-------------------------------------------- */
router.get("/id/:id", async (req, res) => {
  try {
    const img = await Image.findById(req.params.id);
    if (!img) return res.status(404).json({ error: "Image not found" });

    res.json({
      _id: img._id,
      title: img.title,
      name: img.name,
      description: img.description,
      fileName: img.fileName,
      thumbnailFileName: img.thumbnailFileName,
      tags: img.tags,
      category: img.category,
      url: buildR2PublicUrl(img.fileName),
      thumbnailUrl: buildR2PublicUrl(img.thumbnailFileName)
    });
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

/* --------------------------------------------
   RELATED IMAGES
-------------------------------------------- */
router.get("/related/:cat", async (req, res) => {
  try {
    const cat = req.params.cat;

    const images = await Image.find({
      category: { $regex: cat, $options: "i" }
    }).limit(20);

    res.json({
      images: images.map(img => ({
        _id: img._id,
        title: img.title,
        fileName: img.fileName,
        thumbnailFileName: img.thumbnailFileName,
        url: `/api/images/file/${encodeURIComponent(img.thumbnailFileName)}`
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/download/:fileName", async (req, res) => {
  try {
    let incoming = decodeURIComponent(req.params.fileName).trim();

    console.log("\n🔥 Incoming =", incoming);

    // Allowed extensions
    const extensions = ["jpg", "jpeg", "png", "webp"];

    // Detect extension
    const ext = incoming.split(".").pop().toLowerCase();
    const hasExt = extensions.includes(ext);
    const base = hasExt ? incoming.slice(0, -(ext.length + 1)) : incoming;

    // Generate base variations
    const baseVariations = [
      base,
      base.toLowerCase(),
      base.toUpperCase(),
      base.replace(/-/g, "_"),
      base.replace(/_/g, "-"),
      base.replace(/[^a-zA-Z0-9]/g, "_"),
      base.replace(/[^a-zA-Z0-9]/g, "-")
    ];

    // Generate full filename variations with extension
    const fullVariations = [];
    for (const b of baseVariations) {
      for (const e of extensions) {
        fullVariations.push(`${b}.${e}`);
      }
    }

    const variations = [
      incoming,
      incoming.toLowerCase(),
      incoming.toUpperCase(),
      ...fullVariations
    ];

    console.log("🔍 Variations:", variations);

    // 1. Try exact match
    let image = await Image.findOne({ fileName: { $in: variations } });

    // 2. Fuzzy regex fallback
    if (!image) {
      const regex = new RegExp(base.replace(/[^a-zA-Z0-9]/g, ".?"), "i");
      image = await Image.findOne({ fileName: regex });
    }

    if (!image) {
      console.log("❌ No match found");
      return res.status(404).json({ error: "File not found" });
    }

    console.log("✅ MATCH FOUND =", image.fileName);

    // Fetch file from R2
    const fileUrl = `${process.env.R2_PUBLIC_BASE_URL}/${encodeURIComponent(image.fileName)}`;
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });

    res.set({
      "Content-Type": response.headers["content-type"],
      "Content-Disposition": `attachment; filename="${image.fileName}"`,
    });

    res.send(response.data);

  } catch (err) {
    console.error("🔥 Download error:", err.message);
    res.status(500).json({ error: "Download failed" });
  }
});


/* --------------------------------------------
   STREAM FILE FROM R2
-------------------------------------------- */
router.get("/file/:name", async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.name);

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName
    });

    const data = await s3Client.send(command);

    res.setHeader("Content-Type", data.ContentType || "image/jpeg");
    data.Body.pipe(res);
  } catch (err) {
    console.error("❌ File fetch failed:", err);
    res.status(404).json({ error: "File not found" });
  }
});

/* --------------------------------------------
   GET IMAGE BY SLUG + ID  (Correct version)
-------------------------------------------- */
router.get("/slug/:slugAndId", async (req, res) => {
  try {
    const raw = req.params.slugAndId;

    // ID = last part after last "-"
    const id = raw.split("-").pop();

    // Fetch using ID (100% accurate)
    const img = await Image.findById(id);

    if (!img) return res.status(404).json({ error: "Image not found" });

    res.json(img);
  } catch (err) {
    console.error("Slug/ID fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
