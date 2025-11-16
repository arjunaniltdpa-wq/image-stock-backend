import express from "express";
import Image from "../models/Image.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json([]);

    const regex = new RegExp(q, "i");

    const results = await Image.find({
      $or: [
        { title: regex },
        { description: regex },
        { tags: regex },
        { keywords: regex },
        { category: regex },
        { secondaryCategory: regex },
        { fileName: regex },
        { alt: regex }
      ]
    })
    .limit(200)
    .sort({ uploadedAt: -1 });

    res.json(results);

  } catch (error) {
    console.error("Search API Error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
