import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

// ✅ Fetch all images (with pagination)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // which page to show
    const limit = parseInt(req.query.limit) || 30; // how many per page
    const skip = (page - 1) * limit;

    const total = await Image.countDocuments();
    const images = await Image.find()
      .sort({ uploadedAt: -1 }) // newest first
      .skip(skip)
      .limit(limit);

    res.json({
      page,
      total,
      totalPages: Math.ceil(total / limit),
      images,
    });
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// ✅ Search images by name
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    const images = await Image.find({ name: { $regex: q, $options: "i" } })
      .sort({ uploadedAt: -1 })
      .limit(50);

    res.json(images);
  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
