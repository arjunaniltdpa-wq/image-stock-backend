import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

/**
 * GET /api/images/popular-latest
 * Used by homepage + infinite scroll
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const skip = (page - 1) * limit;

    const images = await Image.find({})
      .select(
        "_id slug fileName thumbnailFileName title alt"
      )
      .sort({ uploadedAt: -1 })   // latest first (SAFE)
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
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
