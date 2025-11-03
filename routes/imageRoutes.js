import express from "express";
import multer from "multer";
import Image from "../models/Image.js";
import { generateSEOFromFilename } from "../lib/seoGenerator.js";

const router = express.Router();

// =======================
// Multer setup for uploads
// =======================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // your uploads folder
  },
  filename: function (req, file, cb) {
    // Normalize filename for SEO
    const seoName = Date.now() + "-" + file.originalname.toLowerCase().replace(/\s+/g, "-");
    cb(null, seoName);
  }
});

const upload = multer({ storage });

// =======================
// POST /upload - Image upload with SEO
// =======================
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // Generate SEO from filename
    const seo = generateSEOFromFilename(file.originalname);

    // Save to MongoDB
    const img = new Image({
      name: file.originalname.toLowerCase().replace(/\s+/g, "-"), // optional SEO-friendly name
      fileName: file.originalname,                                 // Original file name
      url: `/uploads/${file.filename}`,                             // URL path
      category: seo.category,                                      // auto-detected category
      title: seo.title,                                            // SEO title
      description: seo.description,                                // SEO description
      alt: seo.alt,                                                // alt text
      tags: seo.tags                                               // SEO tags
    });

    await img.save();

    res.status(201).json({ message: "Image uploaded successfully", image: img });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// =======================
// GET /popular - Existing code (keep unchanged)
// =======================
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
        url: `/api/images/file/${encodeURIComponent(img.fileName)}`,
        uploadedAt: img.uploadedAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// =======================
// GET /search - Existing code (keep unchanged)
// =======================
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const images = await Image.find({ fileName: { $regex: query, $options: "i" } })
      .limit(50)
      .sort({ uploadedAt: -1 });

    res.json(images.map(img => ({
      _id: img._id,
      name: img.fileName,
      url: `/api/images/file/${encodeURIComponent(img.fileName)}`,
      uploadedAt: img.uploadedAt,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
  