// routes/search.js
import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    /* --------------------------------------------------------
     * 1. EXACT MATCH (highest priority)
     * -------------------------------------------------------- */
    const exactRegex = new RegExp(`\\b${q}\\b`, "i");

    const exactResults = await Image.find({
      $or: [
        { title: exactRegex },
        { name: exactRegex },
        { description: exactRegex },
        { category: exactRegex },
        { secondaryCategory: exactRegex },
        { alt: exactRegex },
        { tags: { $regex: exactRegex } },
        { keywords: { $regex: exactRegex } }
      ]
    }).limit(150);


    /* --------------------------------------------------------
     * 2. RELATED MATCH (using full-text search)
     *    MongoDB will find related words like:
     *    travel, vehicle, transport, city, road, traffic
     * -------------------------------------------------------- */
    let relatedResults = [];

    try {
      relatedResults = await Image.find(
        { $text: { $search: q } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(200);
    } catch (err) {
      console.warn("Text search not enabled.");
    }


    /* --------------------------------------------------------
     * 3. MERGE RESULTS (remove duplicates)
     * -------------------------------------------------------- */
    const merged = [...exactResults];

    for (const img of relatedResults) {
      if (!merged.find(x => x._id.toString() === img._id.toString())) {
        merged.push(img);
      }
    }

    /* --------------------------------------------------------
     * 4. LIMIT FINAL OUTPUT
     * -------------------------------------------------------- */
    res.json(merged.slice(0, 250));

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
