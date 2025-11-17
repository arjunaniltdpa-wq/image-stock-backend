// routes/search.js
import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    const finalResults = [];

    /* --------------------------------------------------------
     * 1. EXACT MATCH (Highest priority)
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
     * 2. FULL TEXT SEARCH (Related results like Unsplash)
     * -------------------------------------------------------- */
    let textSearch = [];
    try {
      textSearch = await Image.find(
        { $text: { $search: q } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(200);
    } catch {
      console.warn("Text search index not created.");
    }


    /* --------------------------------------------------------
     * 3. PREFIX SEARCH (flo → flower, floral, floor)
     * -------------------------------------------------------- */
    const prefixRegex = new RegExp(`^${q}`, "i");

    const prefix = await Image.find({
      $or: [
        { title: prefixRegex },
        { name: prefixRegex },
        { tags: prefixRegex },
        { keywords: prefixRegex }
      ]
    }).limit(120);


    /* --------------------------------------------------------
     * 4. FUZZY SEARCH (flwer → flower)
     * -------------------------------------------------------- */
    const fuzzyRegex = new RegExp(q.split("").join(".*"), "i");

    const fuzzy = await Image.find({
      $or: [
        { title: fuzzyRegex },
        { name: fuzzyRegex },
        { tags: fuzzyRegex },
        { keywords: fuzzyRegex }
      ]
    }).limit(120);


    /* --------------------------------------------------------
     * 5. MERGE ALL RESULTS WITHOUT DUPLICATES
     * -------------------------------------------------------- */
    const pushUnique = arr => {
      for (const img of arr) {
        if (!finalResults.find(x => x._id.toString() === img._id.toString())) {
          finalResults.push(img);
        }
      }
    };

    pushUnique(exact);      // exact match first priority
    pushUnique(textSearch); // related results
    pushUnique(prefix);     // prefix based
    pushUnique(fuzzy);      // spelling correction


    /* --------------------------------------------------------
     * 6. LIMIT & RETURN
     * -------------------------------------------------------- */
    res.json(finalResults.slice(0, 300));

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
