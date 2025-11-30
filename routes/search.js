// routes/search.js
import express from "express";
import Image from "../models/Image.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

/* Cloudflare R2 public URL builder */
const buildR2 = (file) => {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";
  return base + encodeURIComponent(file);
};

/* Word forms helper */
function getWordForms(q) {
  const forms = new Set();
  forms.add(q);

  if (q.endsWith("s")) forms.add(q.slice(0, -1));
  if (!q.endsWith("s")) forms.add(q + "s");

  return Array.from(forms);
}

/* ============================
      ⭐ SEARCH ROUTE 
   Strict → Fallback
=============================== */
router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    const forms = getWordForms(q);

    // Strict match first (word boundary)
    const strictRegexArray = forms.map(w => new RegExp(`\\b${w}\\b`, "i"));

    let strictResults = await Image.find({
      $or: [
        ...strictRegexArray.map(r => ({ title: r })),
        ...strictRegexArray.map(r => ({ name: r })),
        ...strictRegexArray.map(r => ({ description: r })),
        ...strictRegexArray.map(r => ({ category: r })),
        ...strictRegexArray.map(r => ({ secondaryCategory: r })),
        ...strictRegexArray.map(r => ({ alt: r })),
        ...strictRegexArray.map(r => ({ tags: r })),
        ...strictRegexArray.map(r => ({ keywords: r }))
      ]
    }).lean().limit(200);

    /* ============================
          ⭐ Fallback Search
       (Loose contains match)
       Only if strict = 0 results
    ============================= */
    let finalResults = strictResults;

    if (strictResults.length === 0) {
      const looseRegexArray = forms.map(w => new RegExp(w, "i"));

      const fallback = await Image.find({
        $or: [
          ...looseRegexArray.map(r => ({ title: r })),
          ...looseRegexArray.map(r => ({ name: r })),
          ...looseRegexArray.map(r => ({ description: r })),
          ...looseRegexArray.map(r => ({ alt: r })),
          ...looseRegexArray.map(r => ({ tags: r })),
          ...looseRegexArray.map(r => ({ keywords: r }))
        ]
      }).lean().limit(200);

      finalResults = fallback;
    }

    /* =============================
         ⭐ Remove duplicates
    ============================== */
    const unique = [];
    const seen = new Set();

    finalResults.forEach(img => {
      const id = img._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(img);
      }
    });

    /* =============================
        ⭐ Ensure thumbnail + URLs
    ============================== */
    const response = unique.slice(0, 200).map(img => {
      if (!img.thumbnailFileName) {
        img.thumbnailFileName = `thumb_${img.fileName}`;
      }

      img.thumbnailUrl = buildR2(img.thumbnailFileName);
      img.fileUrl = buildR2(img.fileName);

      return img;
    });

    return res.json(response);

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
