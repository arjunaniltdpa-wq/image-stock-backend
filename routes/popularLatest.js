import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

const CDN = process.env.R2_PUBLIC_BASE_URL;

// 🔑 SAME helper used everywhere
function attachUrls(img) {
  return {
    ...img,
    url: img.url || `${CDN}/${encodeURIComponent(img.fileName)}`,
    thumbnailUrl:
      img.thumbnailUrl || `${CDN}/${encodeURIComponent(img.thumbnailFileName)}`
  };
}

// POPULAR + LATEST FIRST (SAFE VERSION)
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    // 🔒 HARD LIMIT
    const limit = Math.min(parseInt(req.query.limit) || 36, 50);
    const skip = (page - 1) * limit;

    const images = await Image.find({})
      .select(
        "title fileName thumbnailFileName url thumbnailUrl downloads width height keywords"
      )
      .sort({ downloads: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      page,
      limit,
      count: images.length,
      images: images.map(attachUrls) // 🔥 FIX
    });

  } catch (err) {
    console.error("POPULAR-LATEST ERROR:", err);
    return res.status(500).json({
      error: "Failed to load popular images"
    });
  }
});

export default router;
