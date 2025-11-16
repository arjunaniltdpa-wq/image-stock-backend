import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    const regex = new RegExp(q, "i");

    const results = await Image.find({
      $or: [
        { title: regex },
        { name: regex },
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

  } catch (err) {
    console.log("Search error:", err.message);
    res.status(500).json({ error: "search failed" });
  }
});

export default router;
