// routes/search.js
import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    const results = [];

    /* --------------------------------------------------------
     * EXACT MATCH
     * -------------------------------------------------------- */
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


    /* --------------------------------------------------------
     * PREFIX MATCH  (flo → flower, floor)
     * -------------------------------------------------------- */
    const prefixRegex = new RegExp(`^${q}`, "i");

    const prefix = await Image.find({
      $or: [
        { title: prefixRegex },
        { name: prefixRegex },
        { tags: prefixRegex },
        { keywords: prefixRegex }
      ]
    }).limit(150);


    /* --------------------------------------------------------
     * FUZZY MATCH  (flwer → flower)
     * -------------------------------------------------------- */
    const fuzzyRegex = new RegExp(q.split("").join(".*"), "i");

    const fuzzy = await Image.find({
      $or: [
        { title: fuzzyRegex },
        { name: fuzzyRegex },
        { tags: fuzzyRegex },
        { keywords: fuzzyRegex }
      ]
    }).limit(150);


    /* --------------------------------------------------------
     * MERGE (NO DUPLICATES)
     * -------------------------------------------------------- */
    const addUnique = arr => {
      for (const i of arr) {
        if (!results.find(x => x._id.toString() === i._id.toString())) {
          results.push(i);
        }
      }
    };

    addUnique(exact);
    addUnique(prefix);
    addUnique(fuzzy);

    res.json(results.slice(0, 300));

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
