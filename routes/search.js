// routes/search.js
import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

/* ----------------------------------------------
   Generate variations like:
   car → car, cars
   cars → car, cars
   flower → flower, flowers
   flowers → flower, flowers
-----------------------------------------------*/
function getWordForms(q) {
  const forms = new Set();
  forms.add(q);

  // plural → singular (cars → car)
  if (q.endsWith("s")) {
    forms.add(q.slice(0, -1));
  }

  // singular → plural (car → cars)
  if (!q.endsWith("s")) {
    forms.add(q + "s");
  }

  return Array.from(forms);
}

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    const results = [];

    const forms = getWordForms(q); 
    // Example: "cars" → ["cars", "car"]

    /* ----------------------------------------------------
       Build regex arrays for exact and prefix search
    ---------------------------------------------------- */
    const exactRegexArray = forms.map(word => new RegExp(`\\b${word}\\b`, "i"));
    const prefixRegexArray = forms.map(word => new RegExp(`^${word}`, "i"));

    /* ----------------------------------------------------
       Exact matches (highest priority)
    ---------------------------------------------------- */
    const exact = await Image.find({
      $or: [
        ...exactRegexArray.map(r => ({ title: r })),
        ...exactRegexArray.map(r => ({ name: r })),
        ...exactRegexArray.map(r => ({ description: r })),
        ...exactRegexArray.map(r => ({ category: r })),
        ...exactRegexArray.map(r => ({ secondaryCategory: r })),
        ...exactRegexArray.map(r => ({ alt: r })),
        ...exactRegexArray.map(r => ({ tags: r })),
        ...exactRegexArray.map(r => ({ keywords: r }))
      ]
    }).limit(150);

    /* ----------------------------------------------------
       Prefix matches (car → car-road, car-image)
    ---------------------------------------------------- */
    const prefix = await Image.find({
      $or: [
        ...prefixRegexArray.map(r => ({ title: r })),
        ...prefixRegexArray.map(r => ({ name: r })),
        ...prefixRegexArray.map(r => ({ tags: r })),
        ...prefixRegexArray.map(r => ({ keywords: r }))
      ]
    }).limit(150);

    /* ----------------------------------------------------
       Merge without duplicates
    ---------------------------------------------------- */
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
