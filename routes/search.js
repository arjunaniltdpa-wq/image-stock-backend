// routes/search.js
import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    const results = [];

    /*Exact match*/
    const exactRegex = new RegExp(`\\b${q}\\b`, "i");

    const exact = await Image.find({
      $or: [
        { title: exactRegex },
        { name: exactRegex },
        { description: exactRegex },
        { category: exactRegex },
        { secondaryCategory: exactRegex },
        { alt: exactRegex },
        { tags: exactRegex },
        { keywords: exactRegex }
      ]
    }).limit(150);

    /*Prefix match ("bus" → bus, bus-stop, bus-road)*/
    const prefixRegex = new RegExp(`^${q}`, "i");

    const prefix = await Image.find({
      $or: [
        { title: prefixRegex },
        { name: prefixRegex },
        { tags: prefixRegex },
        { keywords: prefixRegex }
      ]
    }).limit(150);

    /*Merge results*/
    const addUnique = arr => {
      arr.forEach(i => {
        if (!results.find(x => x._id.toString() === i._id.toString())) {
          results.push(i);
        }
      });
    };

    addUnique(exact);
    addUnique(prefix);

    res.json(results.slice(0, 200));

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
