// routes/imageRoutes.js
import express from "express";
import Image from "../models/Image.js";
import B2 from "backblaze-b2";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// -------------------
// Backblaze B2 setup
// -------------------
const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APP_KEY
});

// Authorize once when router is loaded
await b2.authorize();
console.log("✅ Backblaze authorized in router");

// -------------------
// GET images (with pagination)
// -------------------
router.get("/", async (req, res) => {
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
        name: img.name || img.fileName,
        url: img.url,
        uploadedAt: img.uploadedAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------
// Search images
// -------------------
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const images = await Image.find({ name: { $regex: query, $options: "i" } })
      .limit(50)
      .sort({ uploadedAt: -1 });

    res.json(images.map(img => ({
      _id: img._id,
      name: img.name,
      url: img.url,
      uploadedAt: img.uploadedAt,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// -------------------
// Free-tier proxy endpoint for image files
// -------------------
router.get("/file/:fileName", async (req, res) => {
  try {
    const { fileName } = req.params;

    // Download file from B2
    const download = await b2.downloadFileByName({
      bucketName: process.env.BACKBLAZE_BUCKET_NAME,
      fileName
    });

    const buffer = Buffer.from(download.data);

    // Set proper content type based on file extension
    const ext = fileName.split(".").pop().toLowerCase();
    if (ext === "png") res.setHeader("Content-Type", "image/png");
    else if (ext === "jpg" || ext === "jpeg") res.setHeader("Content-Type", "image/jpeg");
    else res.setHeader("Content-Type", "application/octet-stream");

    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to fetch file");
  }
});

export default router;
