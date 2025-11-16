// routes/search.js
import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim().toLowerCase();
    if (!q) return res.json([]);

    const results = await Image.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { secondaryCategory: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
        { keywords: { $regex: q, $options: "i" } },
        { alt: { $regex: q, $options: "i" } }       // 🔥 missing earlier
      ]
    })
      .limit(200)
      .sort({ uploadedAt: -1 }); // newest first

    res.json(results);

  } catch (err) {
    res.status(500).json({ error: "Search failed", details: err.message });
  }
});

export default router;
