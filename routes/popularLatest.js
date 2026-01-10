import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

// POPULAR + LATEST FIRST (SAFE VERSION)
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    // 🔒 HARD LIMIT to prevent abuse & OOM
    const limit = Math.min(parseInt(req.query.limit) || 36, 50);

    const skip = (page - 1) * limit;

    const images = await Image.find({})
      // 🔑 return only required fields (reduce memory)
      .select(
        "title fileName thumbnailFileName url thumbnailUrl downloads width height keywords"
      )
      // 📈 Popular + Latest
      .sort({ downloads: -1, _id: -1 })
      // 📄 Pagination
      .skip(skip)
      .limit(limit)
      // 🚀 Faster + lower memory
      .lean();

    return res.json({
      page,
      limit,
      count: images.length,
      images
    });

  } catch (err) {
    console.error("POPULAR-LATEST ERROR:", err);
    return res.status(500).json({
      error: "Failed to load popular images"
    });
  }
});

export default router;
